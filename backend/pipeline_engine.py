import os
import pandas as pd
import numpy as np
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")


def execute_pipeline_steps(pipeline, run_id):
    steps = pipeline.steps or []
    state = {"_run_id": run_id, "_pipeline_id": pipeline.id}
    total = len(steps)

    for i, step in enumerate(steps):
        step_type = step.get("type", "")
        params = step.get("params", {})
        step_label = f"{i+1}/{total}: {step_type}"

        yield {"step": step_label, "status": "running", "state_keys": list(state.keys())}

        try:
            state = _dispatch(step_type, params, state)
            yield {"step": step_label, "status": "done", "state_keys": list(state.keys())}
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            yield {
                "step": step_label,
                "status": "failed",
                "error": str(e),
                "error_type": type(e).__name__,
                "step_type": step_type,
                "traceback": tb,
            }
            return

    yield {"step": "complete", "status": "done", "state_keys": list(state.keys())}


def _dispatch(step_type, params, state):
    handlers = {
        "load_dataset": _step_load_dataset,
        "split": _step_split,
        "train": _step_train,
        "evaluate": _step_evaluate,
        "predict": _step_predict,
        "deploy": _step_deploy,
    }
    handler = handlers.get(step_type)
    if not handler:
        raise ValueError(f"Unknown step type: {step_type}")
    return handler(params, state)


def _step_load_dataset(params, state):
    file_name = params.get("dataset") or params.get("file_name")
    if not file_name:
        raise ValueError("load_dataset requires 'dataset' or 'file_name' param")
    fpath = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(fpath):
        raise FileNotFoundError(f"Dataset '{file_name}' not found")
    df = pd.read_csv(fpath)
    target = params.get("target_column")
    state["file_name"] = file_name
    state["rows"] = len(df)
    state["columns"] = list(df.columns)
    state["dtypes"] = {c: str(dt) for c, dt in df.dtypes.items()}
    if target and target in df.columns:
        state["target_column"] = target
    return state


def _step_split(params, state):
    from sklearn.model_selection import train_test_split
    file_name = state.get("file_name")
    target = state.get("target_column") or params.get("target_column")
    if not file_name:
        raise ValueError("No dataset loaded. Add a load_dataset step first.")
    fpath = os.path.join(DATASET_DIR, file_name)
    df = pd.read_csv(fpath)
    if not target or target not in df.columns:
        raise ValueError(f"Target column '{target}' not found")
    y = df[target]
    X = df.drop(columns=[target])
    test_size = params.get("test_size", 0.2)
    stratify = y if params.get("stratify", True) and y.nunique() <= 20 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )
    state["X_train_rows"] = len(X_train)
    state["X_test_rows"] = len(X_test)
    state["features"] = list(X.columns)
    state["target_column"] = target
    state["task_type"] = "classification" if y.nunique() <= 20 else "regression"
    return state


def _step_train(params, state):
    from preprocess import auto_preprocess
    from train import run_automl_training
    file_name = state.get("file_name")
    target = state.get("target_column")
    if not file_name or not target:
        raise ValueError("No dataset/target configured. Add load_dataset + split steps first.")
    result = auto_preprocess(file_name, target)
    training_result = run_automl_training(
        result["X"], result["y"],
        task_type=result["task_type"],
        model_name_prefix=f"pipeline_{state.get('_run_id', 'run')[:8]}",
        preprocessor=result.get("preprocessor"),
        cv_folds=params.get("cv", 5),
    )
    state["best_model"] = training_result["best_model"]
    state["cv_score"] = training_result["cv_score"]
    state["model_file"] = training_result.get("saved_at", "")
    state["training_time"] = training_result.get("training_time", 0)
    state["n_classes"] = result.get("n_classes")
    return state


def _step_evaluate(params, state):
    if not state.get("model_file"):
        raise ValueError("No trained model. Add a train step first.")
    meta_path = os.path.join(MODELS_DIR, state["model_file"].replace(".pkl", "_meta.json"))
    if os.path.exists(meta_path):
        import json
        with open(meta_path) as f:
            meta = json.load(f)
        state["metrics"] = meta.get("metrics", {})
        state["feature_importance"] = meta.get("feature_importance", [])
        state["test_size"] = meta.get("test_size", 0)
        state["train_size"] = meta.get("train_size", 0)
    state["evaluated_at"] = datetime.now(timezone.utc).isoformat()
    return state


def _step_predict(params, state):
    from predict import make_prediction, load_model_metadata
    model_file = state.get("model_file")
    if not model_file:
        raise ValueError("No trained model. Add a train step first.")
    meta = load_model_metadata(model_file)
    sample_input = params.get("sample_input", {})
    if not sample_input and meta and meta.get("feature_names"):
        sample_input = {f: 0 for f in meta["feature_names"]}
    if not sample_input:
        raise ValueError("No sample_input provided and no feature_names found in model metadata.")
    prediction = make_prediction(model_file, sample_input)
    state["prediction"] = prediction
    state["predict_model"] = model_file
    return state


def _step_deploy(params, state):
    from crud import create_deployment
    model_file = state.get("model_file")
    if not model_file:
        raise ValueError("No trained model. Add a train step first.")
    endpoint_name = params.get("endpoint_name") or f"pipeline-{state.get('_run_id', 'run')[:8]}"
    state["deployment_endpoint"] = endpoint_name
    state["deployment_status"] = "created"
    return state
