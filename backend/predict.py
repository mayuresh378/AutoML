import os
import json
import logging
import joblib
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")


def load_model_metadata(model_filename: str):
    meta_path = os.path.join(MODELS_DIR, model_filename.replace(".pkl", "_meta.json"))
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            return json.load(f)
    return None


def make_prediction(model_filename: str, input_data: dict):
    pipeline_path = os.path.join(MODELS_DIR, model_filename)
    if not os.path.exists(pipeline_path):
        raise FileNotFoundError(f"Model '{model_filename}' not found in models directory.")

    pipeline = joblib.load(pipeline_path)
    metadata = load_model_metadata(model_filename)

    df_input = pd.DataFrame([input_data])

    if metadata and "feature_names" in metadata:
        expected_features = metadata["feature_names"]
        missing = [f for f in expected_features if f not in df_input.columns]
        extra = [f for f in df_input.columns if f not in expected_features]
        if missing:
            logger.warning("Missing features filled with 0: %s", missing)
            for col in missing:
                df_input[col] = 0
        if extra:
            logger.warning("Extra features dropped: %s", extra)
            df_input = df_input.drop(columns=extra)
        df_input = df_input[expected_features]

    try:
        prediction = pipeline.predict(df_input)
        task_type = metadata.get("task_type") if metadata else None

        raw_pred = _format_prediction(prediction[0])
        label_map = metadata.get("label_map") if metadata else None
        if label_map is not None:
            raw_pred = label_map.get(str(raw_pred), raw_pred)

        result = {
            "prediction": raw_pred,
            "task_type": task_type,
        }

        if hasattr(pipeline, "predict_proba") and task_type == "classification":
            try:
                proba = pipeline.predict_proba(df_input)
                probs = proba[0].tolist()
                result["probabilities"] = [round(p, 4) for p in probs]
                result["confidence"] = round(float(max(probs)), 4)

                if metadata and metadata.get("n_classes") == 2:
                    classes = pipeline.classes_.tolist() if hasattr(pipeline, "classes_") else [0, 1]
                    result["probability_map"] = {str(c): round(float(p), 4) for c, p in zip(classes, probs)}
            except Exception:
                pass

        return result
    except Exception as e:
        raise ValueError(f"Prediction failed: {str(e)}")


def _format_prediction(value):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value
