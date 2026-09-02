import os
import json
import re
import pandas as pd
import numpy as np
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")


def load_json(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []


def load_experiments():
    return load_json(os.path.join(BASE_DIR, "experiments.json"))


def list_datasets():
    files = []
    for f in os.listdir(DATASET_DIR):
        if f.endswith((".csv", ".xlsx", ".parquet", ".json")):
            fpath = os.path.join(DATASET_DIR, f)
            try:
                df = pd.read_csv(fpath)
                files.append({
                    "name": f,
                    "rows": len(df),
                    "columns": list(df.columns),
                    "dtypes": {c: str(dt) for c, dt in df.dtypes.items()},
                    "size_kb": round(os.path.getsize(fpath) / 1024, 1),
                })
            except Exception:
                pass
    return files


def _find_dataset_in_question(question, datasets):
    q = question.lower()
    for d in datasets:
        base = d["name"].split(".")[0].replace("-", " ").replace("_", " ").lower()
        if d["name"].lower() in q or base in q:
            return d
    return datasets[0] if datasets else None


def _get_dataset_profile(name):
    fpath = os.path.join(DATASET_DIR, name)
    if not os.path.exists(fpath):
        return None
    df = pd.read_csv(fpath)
    profile = {
        "name": name,
        "rows": len(df),
        "columns": list(df.columns),
        "dtypes": {c: str(dt) for c, dt in df.dtypes.items()},
        "numeric_cols": [c for c in df.columns if df[c].dtype in ("int64", "float64")],
        "text_cols": [c for c in df.columns if df[c].dtype.name in ("object", "str", "category")],
        "missing": {c: int(df[c].isna().sum()) for c in df.columns if df[c].isna().sum() > 0},
        "duplicates": int(df.duplicated().sum()),
        "describe": {},
    }
    for c in profile["numeric_cols"]:
        profile["describe"][c] = {
            "mean": round(float(df[c].mean()), 2),
            "std": round(float(df[c].std()), 2),
            "min": round(float(df[c].min()), 2),
            "max": round(float(df[c].max()), 2),
            "median": round(float(df[c].median()), 2),
        }
    return profile


def _load_model_meta():
    metas = []
    if not os.path.exists(MODELS_DIR):
        return metas
    for f in os.listdir(MODELS_DIR):
        if f.endswith("_meta.json"):
            try:
                with open(os.path.join(MODELS_DIR, f)) as fh:
                    metas.append(json.load(fh))
            except Exception:
                pass
    return metas


def answer_question(question: str) -> str:
    q = question.lower().strip()
    datasets = list_datasets()
    experiments = load_experiments()

    # ── SQL generation ──
    if re.search(r"(generate|write|create|show).*(sql|query)", q):
        return _answer_sql(question, q, datasets)

    # ── Confusion matrix explanation ──
    if re.search(r"(confusion|matrix|false positive|false negative|precision|recall)", q):
        return _answer_confusion_matrix(q, experiments)

    # ── Preprocessing steps ──
    if re.search(r"(preprocess|preprocessing|pre-process|pre-processing|pipeline|transform)", q):
        return _answer_preprocessing(q, datasets)

    # ── Feature removal / feature selection ──
    if re.search(r"(remove|drop|feature.*remov|remov.*feature|feature.*select|which.*column|which.*feature|correlat|redundant)", q):
        return _answer_feature_removal(q, datasets)

    # ── Experiment summary ──
    if re.search(r"(summar|recap|overview|summary|experiment.*result|result.*experiment|compare.*model|model.*compar)", q):
        return _answer_experiment_summary(q, experiments, datasets)

    # ── Why is accuracy low ──
    if re.search(r"(why|low|poor|bad|worse|drop|decrease|accuracy|score|performance)", q):
        return _answer_low_accuracy(q, experiments, datasets)

    # ── Dataset listing ──
    if re.search(r"(what|list|show).*(dataset|csv|file|data)", q):
        return _answer_dataset_listing(datasets)

    # ── Model recommendation ──
    if re.search(r"(which|what|recommend|best).*(model|algorithm|estimator)", q) or \
       re.search(r"(model|algorithm).*(should|recommend|suggest|best)", q):
        return _answer_model_recommendation(datasets, experiments)

    # ── Feature engineering ──
    if re.search(r"(feature|column|engineer|transform)", q) and \
       re.search(r"(suggest|recommend|generate|create|engineer)", q):
        return _answer_feature_engineering(q, datasets)

    # ── Cleaning ──
    if re.search(r"(clean|cleaning|missing|null|impute)", q):
        return _answer_cleaning(q, datasets)

    # ── Deploy ──
    if re.search(r"(deploy|production|serve|api.*endpoint|docker)", q):
        return _answer_deploy(experiments)

    # ── Greeting / help ──
    if re.search(r"(hello|hi|hey|what can you do|help|capabilities|menu)", q):
        return _answer_help()

    # ── Fallback ──
    return _answer_fallback(question, datasets, experiments)


# ─────────────────────────── SQL Generation ───────────────────────────

def _answer_sql(question, q, datasets):
    d = _find_dataset_in_question(question, datasets)
    if not d:
        return "Upload a dataset first, then ask me to generate SQL for it."
    cols = d["columns"]
    table = d["name"].split(".")[0].replace("-", "_").replace(" ", "_")
    numeric = [c for c, t in d.get("dtypes", {}).items() if "float" in t or "int" in t]
    text = [c for c, t in d.get("dtypes", {}).items() if "object" in t or "str" in t]

    lines = [f"Here are SQL queries for **{d['name']}** ({d['rows']} rows):\n"]

    # Detect intent
    if re.search(r"(select|all|everything|show.*all|list.*all|top|first)", q):
        if re.search(r"(top|first|limit)", q):
            n = re.search(r"(\d+)", q)
            limit = int(n.group(1)) if n else 10
            lines.append(f"```sql\nSELECT * FROM {table}\nLIMIT {limit};\n```\n")
        else:
            lines.append(f"```sql\nSELECT * FROM {table}\nLIMIT 100;\n```\n")
    elif re.search(r"(count|how many|total)", q):
        lines.append(f"```sql\nSELECT COUNT(*) AS total_rows FROM {table};\n```\n")
        if text:
            lines.append(f"By **{text[0]}**:\n```sql\nSELECT {text[0]}, COUNT(*) AS cnt\nFROM {table}\nGROUP BY {text[0]}\nORDER BY cnt DESC;\n```\n")
    elif re.search(r"(average|mean|avg|sum|total|min|max|stat)", q):
        if numeric:
            agg_cols = numeric[:5]
            agg = ", ".join([f"ROUND(AVG({c}), 2) AS avg_{c}, ROUND(SUM({c}), 2) AS sum_{c}" for c in agg_cols])
            lines.append(f"```sql\nSELECT {agg}\nFROM {table};\n```\n")
        else:
            lines.append("No numeric columns found for aggregation.\n")
    elif re.search(r"(group|groupby|group by|breakdown|distribution|frequency)", q):
        grp_col = text[0] if text else (numeric[0] if numeric else None)
        if grp_col:
            lines.append(f"```sql\nSELECT {grp_col}, COUNT(*) AS cnt\nFROM {table}\nGROUP BY {grp_col}\nORDER BY cnt DESC;\n```\n")
    elif re.search(r"(join|merge|combine)", q):
        lines.append(f"```sql\n-- Example JOIN (adjust table names as needed)\nSELECT a.*, b.*\nFROM {table} a\nINNER JOIN other_table b ON a.id = b.{table}_id;\n```\n")
    elif re.search(r"(filter|where|condition|greater|less|between)", q):
        if numeric:
            col = numeric[0]
            lines.append(f"```sql\nSELECT *\nFROM {table}\nWHERE {col} > (SELECT AVG({col}) FROM {table});\n```\n")
        else:
            lines.append(f"```sql\nSELECT *\nFROM {table}\nWHERE {cols[0]} IS NOT NULL;\n```\n")
    elif re.search(r"(distinct|unique|distinct values)", q):
        col = text[0] if text else (cols[0] if cols else None)
        if col:
            lines.append(f"```sql\nSELECT DISTINCT {col}, COUNT(*) AS cnt\nFROM {table}\nGROUP BY {col}\nORDER BY cnt DESC;\n```\n")
    else:
        lines.append(f"```sql\nSELECT {', '.join(cols[:8])}\nFROM {table}\nLIMIT 10;\n```\n")

    lines.append(f"\n*Table: `{table}` | {len(cols)} columns: {', '.join(cols[:6])}{'...' if len(cols) > 6 else ''}*")
    return "\n".join(lines)


# ─────────────────────── Confusion Matrix ───────────────────────

def _answer_confusion_matrix(q, experiments):
    successful = [e for e in experiments if e.get("status") == "success" and e.get("task_type", "classification") == "classification"]
    if not successful:
        return "No classification experiments found. Run a training job first, then I can explain confusion matrices."

    lines = ["**Understanding Your Confusion Matrix**\n"]
    lines.append("A confusion matrix shows how well your classifier predicts each class:\n")
    lines.append("| | Predicted A | Predicted B |")
    lines.append("|---|---|---|")
    lines.append("| **Actual A** | True Positive (TP) | False Negative (FN) |")
    lines.append("| **Actual B** | False Positive (FP) | True Negative (TN) |")

    lines.append("\n**Key Metrics Derived:**\n")
    lines.append("- **Accuracy** = (TP + TN) / Total — overall correct predictions")
    lines.append("- **Precision** = TP / (TP + FP) — of all predicted positives, how many are correct")
    lines.append("- **Recall** = TP / (TP + FN) — of all actual positives, how many were found")
    lines.append("- **F1 Score** = 2 × (Precision × Recall) / (Precision + Recall) — balanced metric\n")

    lines.append("**Common Issues & Fixes:**\n")
    lines.append("- **High FP (low precision)** → model is too aggressive; increase decision threshold or add more negative examples")
    lines.append("- **High FN (low recall)** → model is missing positives; lower threshold, add more data, or try a more sensitive model")
    lines.append("- **Diagonal weakness** → model struggles with certain classes; try class balancing (SMOTE), more features, or a different algorithm")

    if successful:
        best = max(successful, key=lambda e: e.get("cv_score", 0))
        m = best.get("metrics", {})
        if m:
            lines.append(f"\n**Your best classifier** ({best.get('model', 'N/A')}):")
            if "accuracy" in m:
                lines.append(f"- Accuracy: {m['accuracy']}")
            if "f1" in m:
                lines.append(f"- F1 Score: {m['f1']}")

    lines.append("\n*Go to the **Explain** page (`/app/explain`) to visualize your confusion matrix with color-coded heatmaps.*")
    return "\n".join(lines)


# ─────────────────────── Preprocessing ───────────────────────

def _answer_preprocessing(q, datasets):
    d = _find_dataset_in_question(q, datasets)
    if not d:
        return "Upload a dataset first and ask about preprocessing steps."

    profile = _get_dataset_profile(d["name"]) if datasets else None
    numeric = profile["numeric_cols"] if profile else []
    text = profile["text_cols"] if profile else []
    missing = profile["missing"] if profile else {}

    lines = [f"**Preprocessing Pipeline for {d['name']}**\n"]
    lines.append("Recommended steps based on your data:\n")

    step = 1
    if missing:
        lines.append(f"**Step {step}: Handle Missing Values**")
        for col, count in list(missing.items())[:5]:
            pct = round(count / d["rows"] * 100, 1)
            dtype = d.get("dtypes", {}).get(col, "")
            if "float" in dtype or "int" in dtype:
                lines.append(f"- `{col}`: {count} missing ({pct}%) → **impute with median** (robust to outliers)")
            else:
                lines.append(f"- `{col}`: {count} missing ({pct}%) → **impute with mode** or create 'Missing' category")
        lines.append("")
        step += 1

    if text:
        lines.append(f"**Step {step}: Encode Categorical Features**")
        for col in text[:5]:
            nunique = d.get("dtypes", {})
            lines.append(f"- `{col}`: apply **one-hot encoding** (if <10 categories) or **target encoding** (if high cardinality)")
        lines.append("")
        step += 1

    if numeric:
        lines.append(f"**Step {step}: Scale Numeric Features**")
        lines.append(f"- Apply **StandardScaler** to: {', '.join(numeric[:6])}")
        lines.append("- This ensures features contribute equally to distance-based models (KNN, SVM)")
        lines.append("")
        step += 1

    lines.append(f"**Step {step}: Train-Test Split**")
    lines.append("- Use `test_size=0.2, random_state=42` with stratification for classification tasks")
    lines.append("")
    step += 1

    if d["rows"] > 10000:
        lines.append(f"**Step {step}: Consider Sampling**")
        lines.append(f"- Dataset has {d['rows']:,} rows — use a sample for quick iteration, full data for final training")

    lines.append(f"\n**Quick Code:**\n```python\nfrom sklearn.pipeline import Pipeline\nfrom sklearn.preprocessing import StandardScaler, OneHotEncoder\nfrom sklearn.impute import SimpleImputer\nfrom sklearn.compose import ColumnTransformer\n\n# Numeric pipeline\nnum_pipe = Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler())])\n\n# Categorical pipeline\ncat_pipe = Pipeline([('imputer', SimpleImputer(strategy='most_frequent')), ('encoder', OneHotEncoder(handle_unknown='ignore'))])\n\npreprocessor = ColumnTransformer([\n    ('num', num_pipe, {json.dumps(numeric[:6])}),\n    ('cat', cat_pipe, {json.dumps(text[:6])})\n])\n```")
    return "\n".join(lines)


# ─────────────────────── Feature Removal ───────────────────────

def _answer_feature_removal(q, datasets):
    d = _find_dataset_in_question(q, datasets)
    if not d:
        return "Upload a dataset first to get feature recommendations."

    profile = _get_dataset_profile(d["name"])
    if not profile:
        return f"Could not load profile for {d['name']}."

    lines = [f"**Feature Analysis for {d['name']}**\n"]

    # Check for high-missing features
    high_missing = []
    for col, count in profile["missing"].items():
        pct = round(count / d["rows"] * 100, 1)
        if pct > 50:
            high_missing.append((col, pct))
    if high_missing:
        lines.append("**Consider removing (high missing > 50%):**")
        for col, pct in high_missing:
            lines.append(f"- `{col}`: {pct}% missing — too incomplete to be useful")
        lines.append("")

    # Check for low-variance numeric features
    low_var = []
    for col in profile["numeric_cols"]:
        desc = profile["describe"].get(col, {})
        if desc.get("std", 0) < 0.01 and desc.get("std", 0) > 0:
            low_var.append(col)
    if low_var:
        lines.append("**Consider removing (near-zero variance):**")
        for col in low_var:
            lines.append(f"- `{col}`: almost constant — provides no signal")
        lines.append("")

    # Check for potential ID columns
    id_cols = [c for c in d["columns"] if re.match(r"(id|index|_id|row_num|serial)", c, re.I)]
    if id_cols:
        lines.append("**Likely ID columns (drop before training):**")
        for col in id_cols:
            lines.append(f"- `{col}`: unique identifier — not predictive")
        lines.append("")

    # Check for high-cardinality text
    high_card = [c for c in profile["text_cols"] if d["dtypes"].get(c, "") == "object"]
    if high_card:
        lines.append("**High-cardinality text columns (consider target encoding or dropping):**")
        for col in high_card[:3]:
            lines.append(f"- `{col}`: many unique values — one-hot would explode feature space")
        lines.append("")

    # Recommendation
    lines.append("**Feature Selection Methods:**")
    lines.append("1. **Correlation analysis**: remove features with >0.95 pairwise correlation")
    lines.append("2. **Tree-based importance**: use RandomForest feature_importances_")
    lines.append("3. **Mutual information**: sklearn's `mutual_info_classif`")
    lines.append("4. **PCA**: reduce to top-k components explaining 95% variance")

    if not high_missing and not low_var and not id_cols:
        lines.append("\n*Your features look reasonable! No obvious candidates for removal. Consider using feature importance from a trained model to identify less useful features.*")

    return "\n".join(lines)


# ─────────────────── Experiment Summary ───────────────────

def _answer_experiment_summary(q, experiments, datasets):
    if not experiments:
        return "No experiments yet. Run a training job from the **Training** page to get started."

    successful = [e for e in experiments if e.get("status") == "success"]
    failed = [e for e in experiments if e.get("status") != "success"]

    lines = [f"**Experiment Summary** ({len(experiments)} total)\n"]
    lines.append(f"- **{len(successful)}** successful | **{len(failed)}** failed\n")

    if successful:
        # Group by dataset
        grouped = {}
        for e in successful:
            key = e.get("dataset", "unknown")
            grouped.setdefault(key, []).append(e)

        for ds, runs in grouped.items():
            target = runs[0].get("target", "N/A")
            lines.append(f"**Dataset: {ds}** (target: `{target}`)")
            lines.append("")

            # Sort by score
            scored = [r for r in runs if r.get("cv_score") is not None]
            scored.sort(key=lambda x: x.get("cv_score", 0), reverse=True)

            for i, r in enumerate(scored[:8]):
                medal = ["🥇", "🥈", "🥉"][i] if i < 3 else f"#{i+1}"
                score = r.get("cv_score", 0)
                m = r.get("metrics", {})
                acc = m.get("accuracy", "N/A")
                time_s = r.get("training_time", "?")
                lines.append(f"  {medal} **{r.get('model', 'Unknown')}** — CV: {score} | Accuracy: {acc} | {time_s}s")

            # Spread analysis
            if len(scored) >= 2:
                scores = [s.get("cv_score", 0) for s in scored]
                spread = round(max(scores) - min(scores), 4)
                avg = round(sum(scores) / len(scores), 4)
                lines.append(f"\n  Spread: {spread} | Average: {avg}")
                if spread < 0.02:
                    lines.append("  *Models are performing similarly — try feature engineering or hyperparameter tuning to break out.*")
                elif spread > 0.1:
                    lines.append("  *Large performance gap — simpler models may be underfitting, complex ones may be overfitting.*")

            # Best model recommendation
            best = scored[0] if scored else None
            if best:
                lines.append(f"\n  **Recommendation:** Deploy **{best.get('model', 'N/A')}** or retrain with different hyperparameters.")
            lines.append("")

    if failed:
        lines.append(f"**{len(failed)} Failed Runs:**")
        for e in failed[:3]:
            lines.append(f"- {e.get('model', 'Unknown')}: {e.get('error', 'Unknown error')}")

    return "\n".join(lines)


# ─────────────────── Low Accuracy ───────────────────

def _answer_low_accuracy(q, experiments, datasets):
    lines = ["**Why Might Accuracy Be Low?**\n"]

    successful = [e for e in experiments if e.get("status") == "success"]
    if successful:
        worst = min(successful, key=lambda e: e.get("cv_score", 1))
        lines.append(f"Your lowest-scoring model: **{worst.get('model', 'N/A')}** (score: {worst.get('cv_score', 'N/A')})\n")

    lines.append("**Common Causes & Fixes:**\n")

    lines.append("**1. Insufficient Data**")
    lines.append("- Fewer than 1000 rows may not be enough for complex models")
    lines.append("- Fix: collect more data, or use simpler models (LogisticRegression, DecisionTree)\n")

    lines.append("**2. Poor Feature Quality**")
    lines.append("- Too many irrelevant features create noise")
    lines.append("- Fix: use feature selection, remove high-missing columns, or engineer better features\n")

    lines.append("**3. Class Imbalance**")
    lines.append("- If 95% of samples are class A, a dummy classifier gets 95% accuracy")
    lines.append("- Fix: use SMOTE, class weights, or F1-score as metric instead of accuracy\n")

    lines.append("**4. Data Leakage**")
    lines.append("- Target information accidentally included in features")
    lines.append("- Fix: review feature correlations with target, remove suspicious columns\n")

    lines.append("**5. Wrong Task Type**")
    lines.append("- Regression on classification data (or vice versa)")
    lines.append("- Fix: check target column type in the Datasets page\n")

    lines.append("**6. Need Hyperparameter Tuning**")
    lines.append("- Default params may not be optimal")
    lines.append("- Fix: enable HPO in the Training workflow, increase CV folds\n")

    lines.append("**Quick Wins:**")
    lines.append("- Try **GradientBoosting** or **RandomForest** — they're robust to most issues")
    lines.append("- Run the **Explain** page to see feature importance — drop the bottom 20%")
    lines.append("- Check for missing values and outliers before retraining")

    return "\n".join(lines)


# ─────────────────── Dataset Listing ───────────────────

def _answer_dataset_listing(datasets):
    if not datasets:
        return "No datasets uploaded yet. Head to the **Datasets** page to upload one."
    lines = [f"**Your Datasets** ({len(datasets)} total)\n"]
    for d in datasets:
        kinds = []
        for c, t in d.get("dtypes", {}).items():
            if "float" in t or "int" in t:
                kinds.append("numeric")
                break
        for c, t in d.get("dtypes", {}).items():
            if "object" in t or "str" in t:
                kinds.append("text")
                break
        lines.append(f"- **{d['name']}** — {d['rows']:,} rows × {len(d['columns'])} columns ({', '.join(kinds) if kinds else 'mixed'})")
        lines.append(f"  Columns: {', '.join(d['columns'][:6])}{'...' if len(d['columns']) > 6 else ''}")
    return "\n".join(lines)


# ─────────────────── Model Recommendation ───────────────────

def _answer_model_recommendation(datasets, experiments):
    if not datasets:
        return "Upload a dataset first, then I can recommend the best model."
    d = datasets[0]
    text_cols = [c for c, t in d.get("dtypes", {}).items() if "object" in t or "str" in t]
    numeric_cols = [c for c, t in d.get("dtypes", {}).items() if "float" in t or "int" in t]

    lines = [f"**Model Recommendations for {d['name']}**\n"]

    if experiments:
        successful = [e for e in experiments if e.get("status") == "success"]
        if successful:
            best = max(successful, key=lambda e: e.get("cv_score", 0))
            lines.append(f"Based on your experiments, **{best.get('model', 'N/A')}** performed best (score: {best.get('cv_score', 'N/A')}).\n")

    has_text_target = len(text_cols) > 0
    if has_text_target:
        lines.append("This looks like a **classification** task. Recommended:\n")
        lines.append("| Model | When to Use | Pros |")
        lines.append("|-------|------------|------|")
        lines.append("| **LogisticRegression** | Baseline, linearly separable data | Fast, interpretable |")
        lines.append("| **RandomForest** | Non-linear patterns, mixed features | Robust, handles missing values |")
        lines.append("| **GradientBoosting** | Maximum accuracy needed | Best performance, handles imbalanced data |")
        lines.append("| **XGBoost** | Large datasets, competitions | State-of-the-art, regularized |")
        lines.append("| **LightGBM** | Very large datasets | Fast training, low memory |")
    else:
        lines.append("This looks like a **regression** task. Recommended:\n")
        lines.append("| Model | When to Use | Pros |")
        lines.append("|-------|------------|------|")
        lines.append("| **Ridge / Lasso** | Linear relationships | Fast, Lasso does feature selection |")
        lines.append("| **RandomForest** | Non-linear patterns | Robust, few assumptions |")
        lines.append("| **GradientBoosting** | Best accuracy | Handles complex interactions |")
        lines.append("| **XGBoost** | Large-scale data | State-of-the-art |")

    lines.append(f"\n**Dataset info:** {d['rows']:,} rows, {len(numeric_cols)} numeric, {len(text_cols)} text features")
    lines.append("\n*Go to the **Training** page and select these algorithms to compare.*")
    return "\n".join(lines)


# ─────────────────── Feature Engineering ───────────────────

def _answer_feature_engineering(q, datasets):
    d = _find_dataset_in_question(q, datasets)
    if not d:
        return "Upload a dataset first to get feature engineering suggestions."
    profile = _get_dataset_profile(d["name"])
    if not profile:
        return f"Could not load {d['name']}."

    numeric = profile["numeric_cols"]
    text = profile["text_cols"]
    lines = [f"**Feature Engineering Suggestions for {d['name']}**\n"]

    if len(numeric) >= 2:
        pairs = [f"`{numeric[i]}` × `{numeric[j]}`" for i in range(min(3, len(numeric))) for j in range(i+1, min(4, len(numeric)))]
        lines.append(f"**Interaction Features:** {', '.join(pairs[:3])}")
    if numeric:
        lines.append(f"**Polynomial Features:** square and cube of `{numeric[0]}`")
        lines.append(f"**Binned Features:** discretize `{numeric[0]}` into quartiles")
    if len(numeric) >= 2:
        lines.append(f"**Ratio Features:** `{numeric[0]}` / `{numeric[1]}`")
    if text:
        lines.append(f"**Text Encoding:** one-hot or target encode {', '.join(text[:3])}")
    lines.append(f"\n*Go to **Training** to use the AutoML pipeline — it handles most of these automatically.*")
    return "\n".join(lines)


# ─────────────────── Cleaning ───────────────────

def _answer_cleaning(q, datasets):
    d = _find_dataset_in_question(q, datasets)
    if not d:
        return "Upload a dataset first to get cleaning recommendations."
    profile = _get_dataset_profile(d["name"])
    if not profile:
        return f"Could not load {d['name']}."

    lines = [f"**Data Cleaning Report for {d['name']}**\n"]
    missing = profile["missing"]
    if missing:
        lines.append(f"**{len(missing)} column(s)** with missing values:")
        for col, count in sorted(missing.items(), key=lambda x: x[1], reverse=True)[:10]:
            pct = round(count / d["rows"] * 100, 1)
            dtype = d.get("dtypes", {}).get(col, "")
            strategy = "median" if "float" in dtype or "int" in dtype else "mode"
            lines.append(f"- `{col}`: {count} missing ({pct}%) → impute with **{strategy}**")
    else:
        lines.append("No missing values found.")

    if profile["duplicates"] > 0:
        lines.append(f"\n**{profile['duplicates']} duplicate rows** detected → remove with `df.drop_duplicates()`")

    lines.append(f"\n*Go to **Training** — the AutoML pipeline handles missing values and encoding automatically.*")
    return "\n".join(lines)


# ─────────────────── Deploy ───────────────────

def _answer_deploy(experiments):
    successful = [e for e in experiments if e.get("status") == "success"]
    lines = ["**Model Deployment Guide**\n"]
    if successful:
        best = max(successful, key=lambda e: e.get("cv_score", 0))
        lines.append(f"Your best model: **{best.get('model', 'N/A')}** (score: {best.get('cv_score', 'N/A')})\n")

    lines.append("**Steps to Deploy:**\n")
    lines.append("1. Go to the **Models** page")
    lines.append("2. Find your model and click **Deploy**")
    lines.append("3. Choose environment (staging / production)")
    lines.append("4. The model will be exposed as a REST API endpoint\n")

    lines.append("**API Usage:**\n```python\nimport requests\n\nresponse = requests.post(\n    'http://your-server:8000/api/v1/predict',\n    files={'model_name': 'your_model.pkl'},\n    data={'payload': '{\"feature1\": 1.5, \"feature2\": \"value\"}'}\n)\nprint(response.json())\n```\n")

    lines.append("**Best Practices:**")
    lines.append("- Start with **staging** environment for testing")
    lines.append("- Monitor prediction latency and accuracy in **Monitoring** page")
    lines.append("- Set up retraining schedule for data drift")
    return "\n".join(lines)


# ─────────────────── Help ───────────────────

def _answer_help():
    return """**AutoML AI Assistant — Capabilities**

I can help you with every step of your ML workflow:

| Category | Example Questions |
|----------|------------------|
| **Algorithm Selection** | "Which algorithm should I choose?", "Recommend a model for my data" |
| **Low Accuracy Debugging** | "Why is my accuracy low?", "How do I improve my F1 score?" |
| **SQL Generation** | "Generate SQL to count rows by category", "Write a query for top 10 values" |
| **Preprocessing** | "Suggest preprocessing steps", "How should I encode categorical data?" |
| **Confusion Matrix** | "Explain this confusion matrix", "What does false positive mean?" |
| **Feature Selection** | "Which features should I remove?", "Find correlated columns" |
| **Experiment Summary** | "Summarize my experiments", "Compare my model results" |
| **Data Cleaning** | "How should I clean my data?", "Handle missing values" |
| **Deployment** | "How do I deploy a model?" |

*Tip: Mention a specific dataset name for more targeted advice!*"""


# ─────────────────── Fallback ───────────────────

def _answer_fallback(question, datasets, experiments):
    lines = [f"I understand you're asking about \"{question}\". Here's what I know:\n"]
    if datasets:
        lines.append(f"You have **{len(datasets)} dataset(s)** loaded.")
    if experiments:
        successful = [e for e in experiments if e.get("status") == "success"]
        lines.append(f"**{len(successful)}** successful experiments completed.")
        if successful:
            best = max(successful, key=lambda e: e.get("cv_score", 0))
            lines.append(f"Best model: **{best.get('model', 'N/A')}** (score: {best.get('cv_score', 'N/A')}).")
    else:
        lines.append("No experiments yet — start from the **Training** page.")
    lines.append("\n💡 **Try asking:**")
    lines.append('- "Which algorithm should I choose?"')
    lines.append('- "Why is my accuracy low?"')
    lines.append('- "Generate SQL for my dataset"')
    lines.append('- "Suggest preprocessing steps"')
    lines.append('- "Explain confusion matrix"')
    lines.append('- "Recommend features to remove"')
    lines.append('- "Summarize my experiments"')
    return "\n".join(lines)


# ─────────────────── Suggestions ───────────────────

def generate_suggestions():
    datasets = list_datasets()
    experiments = load_experiments()

    suggestions = []
    if not datasets:
        return [
            "What can you do?",
            "How do I get started?",
        ]

    d = datasets[0]
    text_cols = [c for c, t in d.get("dtypes", {}).items() if "object" in t]
    numeric_cols = [c for c, t in d.get("dtypes", {}).items() if "float" in t or "int" in t]

    suggestions.append(f"Which algorithm should I choose for {d['name']}?")
    suggestions.append(f"Generate SQL for {d['name']}")
    suggestions.append("Suggest preprocessing steps")
    if experiments:
        suggestions.append("Summarize my experiments")
        suggestions.append("Why is my accuracy low?")
    suggestions.append("Explain confusion matrix")
    if numeric_cols:
        suggestions.append(f"Recommend features to remove from {d['name']}")

    return suggestions[:6]
