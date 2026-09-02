import pandas as pd
import numpy as np
import os
import json
from cleaning import load_dataset, DATASET_DIR


def _detect_target_column(df: pd.DataFrame) -> dict:
    candidates = []
    for col in df.columns:
        col_data = df[col].dropna()
        if len(col_data) < 2:
            continue
        unique_ratio = col_data.nunique() / len(col_data)
        if unique_ratio <= 0.05 and col_data.nunique() <= 30:
            candidates.append({"column": col, "score": round((1 - unique_ratio) * 10, 2), "reason": "Low cardinality, likely categorical target"})
        elif col_data.dtype in ("int64", "float64") and col_data.nunique() <= 20:
            candidates.append({"column": col, "score": round((1 - unique_ratio) * 10, 2), "reason": "Numeric with few unique values, likely classification target"})
        elif col_data.dtype == "object" and col_data.nunique() <= 30:
            candidates.append({"column": col, "score": round((1 - unique_ratio) * 8, 2), "reason": "Categorical column, possible target"})
    name_hints = ["target", "label", "class", "diagnosis", "outcome", "result", "y", "approved", "churn", "default", "fraud", "survived", "price", "cost", "score", "rating"]
    for c in candidates:
        for hint in name_hints:
            if hint in c["column"].lower():
                c["score"] = min(10, c["score"] + 2)
                c["reason"] += f" (column name matches '{hint}')"
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return {"candidates": candidates[:5], "suggested": candidates[0]["column"] if candidates else None}


def _detect_feature_types(df: pd.DataFrame) -> dict:
    types = {"numeric": [], "categorical": [], "text": [], "datetime": [], "boolean": [], "id": []}
    for col in df.columns:
        col_data = df[col].dropna()
        if len(col_data) == 0:
            types["categorical"].append(col)
            continue
        dtype = str(df[col].dtype)
        if "datetime" in dtype or "timestamp" in dtype.lower():
            types["datetime"].append(col)
        elif dtype == "bool" or col_data.nunique() == 2:
            types["boolean"].append(col)
        elif "int" in dtype or "float" in dtype:
            nunique = col_data.nunique()
            if nunique == len(col_data) and "id" in col.lower():
                types["id"].append(col)
            elif nunique <= 10:
                types["categorical"].append(col)
            else:
                types["numeric"].append(col)
        elif dtype == "object":
            nunique = col_data.nunique()
            avg_len = col_data.astype(str).str.len().mean()
            if nunique <= 30:
                types["categorical"].append(col)
            elif avg_len > 50:
                types["text"].append(col)
            else:
                types["categorical"].append(col)
        else:
            types["categorical"].append(col)
    return {k: v for k, v in types.items() if v}


def _missing_analysis(df: pd.DataFrame) -> dict:
    total_cells = df.shape[0] * df.shape[1]
    total_missing = int(df.isnull().sum().sum())
    missing_pct = round(total_missing / total_cells * 100, 2) if total_cells else 0
    columns = []
    for col in df.columns:
        missing = int(df[col].isnull().sum())
        pct = round(missing / len(df) * 100, 2) if len(df) else 0
        if missing > 0:
            columns.append({"column": col, "missing": missing, "pct": pct, "dtype": str(df[col].dtype)})
    columns.sort(key=lambda x: x["missing"], reverse=True)
    severity = "low" if missing_pct < 5 else "medium" if missing_pct < 20 else "high"
    return {"total_missing": total_missing, "missing_pct": missing_pct, "severity": severity, "columns": columns}


def _duplicate_analysis(df: pd.DataFrame) -> dict:
    dup_count = int(df.duplicated().sum())
    dup_pct = round(dup_count / len(df) * 100, 2) if len(df) else 0
    severity = "low" if dup_pct < 1 else "medium" if dup_pct < 10 else "high"
    return {"count": dup_count, "pct": dup_pct, "severity": severity}


def _outlier_analysis(df: pd.DataFrame) -> dict:
    columns = []
    total_outliers = 0
    for col in df.select_dtypes(include=[np.number]).columns:
        col_data = df[col].dropna()
        if len(col_data) < 4:
            continue
        q1 = col_data.quantile(0.25)
        q3 = col_data.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outliers = int(((col_data < lower) | (col_data > upper)).sum())
        pct = round(outliers / len(col_data) * 100, 2)
        total_outliers += outliers
        columns.append({"column": col, "outliers": outliers, "pct": pct, "lower_bound": round(lower, 2), "upper_bound": round(upper, 2)})
    columns.sort(key=lambda x: x["outliers"], reverse=True)
    return {"total_outliers": total_outliers, "columns": columns, "mean_pct": round(np.mean([c["pct"] for c in columns]), 2) if columns else 0}


def _class_imbalance(df: pd.DataFrame, target: str = None) -> dict:
    if not target or target not in df.columns:
        return {"detected": False}
    col_data = df[target].dropna()
    if col_data.nunique() > 20:
        return {"detected": False}
    counts = col_data.value_counts()
    total = len(col_data)
    distribution = {str(k): {"count": int(v), "pct": round(v / total * 100, 2)} for k, v in counts.items()}
    max_pct = max(c["pct"] for c in distribution.values())
    min_pct = min(c["pct"] for c in distribution.values())
    imbalance_ratio = round(max_pct / min_pct, 2) if min_pct > 0 else 99
    severity = "low" if imbalance_ratio < 2 else "medium" if imbalance_ratio < 5 else "high"
    return {"detected": True, "target": target, "distribution": distribution, "imbalance_ratio": imbalance_ratio, "severity": severity, "classes": len(counts)}


def _correlation_analysis(df: pd.DataFrame) -> dict:
    numeric_df = df.select_dtypes(include=[np.number]).dropna(axis=1, how="all")
    if numeric_df.shape[1] < 2:
        return {"matrix": [], "top_correlations": [], "message": "Need at least 2 numeric columns for correlation analysis"}
    corr_matrix = numeric_df.corr(numeric_only=True).round(3)
    matrix_data = []
    for col in corr_matrix.columns:
        row = {"column": col}
        for c2 in corr_matrix.index:
            val = corr_matrix.loc[c2, col]
            if pd.notna(val):
                row[c2] = val
        matrix_data.append(row)
    pairs = []
    cols = list(corr_matrix.columns)
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            val = corr_matrix.iloc[i, j]
            if pd.notna(val):
                pairs.append({"x": cols[i], "y": cols[j], "value": round(val, 3)})
    pairs.sort(key=lambda x: abs(x["value"]), reverse=True)
    return {"matrix": matrix_data, "columns": list(corr_matrix.columns), "top_correlations": pairs[:20], "size": len(cols)}


def _distribution_analysis(df: pd.DataFrame) -> dict:
    histograms = []
    for col in df.select_dtypes(include=[np.number]).columns:
        col_data = df[col].dropna()
        if len(col_data) < 3:
            continue
        hist, bin_edges = np.histogram(col_data, bins="auto")
        histograms.append({
            "column": col,
            "bins": hist.tolist(),
            "bin_edges": [round(float(e), 2) for e in bin_edges],
            "min": float(col_data.min()),
            "max": float(col_data.max()),
            "mean": float(col_data.mean()),
            "median": float(col_data.median()),
            "std": float(col_data.std()),
            "skewness": round(float(col_data.skew()), 3) if len(col_data) > 2 else 0,
        })
    return {"columns": histograms}


def _quality_score(df: pd.DataFrame, target: str = None) -> dict:
    scores = {}
    deductions = []
    missing_analysis = _missing_analysis(df)
    dup_analysis = _duplicate_analysis(df)
    missing_score = max(0, 100 - missing_analysis["missing_pct"] * 2)
    if missing_analysis["missing_pct"] > 0:
        deductions.append(f"-{round(missing_analysis['missing_pct'] * 2, 1)} points for missing data ({missing_analysis['missing_pct']}%)")
    scores["missing_data"] = round(missing_score, 1)
    dup_score = max(0, 100 - dup_analysis["pct"] * 5)
    if dup_analysis["pct"] > 0:
        deductions.append(f"-{round(dup_analysis['pct'] * 5, 1)} points for duplicates ({dup_analysis['pct']}%)")
    scores["duplicates"] = round(dup_score, 1)
    outlier_analysis = _outlier_analysis(df)
    outlier_score = max(0, 100 - outlier_analysis["mean_pct"] * 2)
    if outlier_analysis["mean_pct"] > 0:
        deductions.append(f"-{round(outlier_analysis['mean_pct'] * 2, 1)} points for outliers ({outlier_analysis['mean_pct']}% avg)")
    scores["outliers"] = round(outlier_score, 1)
    imbalance = _class_imbalance(df, target)
    imbalance_score = 100
    if imbalance["detected"] and imbalance["severity"] == "high":
        imbalance_score = 60
        deductions.append("-40 points for severe class imbalance")
    elif imbalance["detected"] and imbalance["severity"] == "medium":
        imbalance_score = 80
        deductions.append("-20 points for moderate class imbalance")
    scores["class_balance"] = imbalance_score
    total = round((missing_score + dup_score + outlier_score + imbalance_score) / 4, 1)
    if total >= 90:
        grade = "A"
    elif total >= 80:
        grade = "B"
    elif total >= 65:
        grade = "C"
    elif total >= 50:
        grade = "D"
    else:
        grade = "F"
    return {"total": total, "grade": grade, "components": scores, "deductions": deductions}


def _recommendations(df: pd.DataFrame, target: str = None) -> list:
    recs = []
    missing_analysis = _missing_analysis(df)
    if missing_analysis["missing_pct"] > 0:
        recs.append({"action": "impute_missing", "priority": "high" if missing_analysis["missing_pct"] > 10 else "medium", "message": f"Impute {missing_analysis['total_missing']} missing values across {len(missing_analysis['columns'])} columns", "columns": [c["column"] for c in missing_analysis["columns"][:5]]})
    dup_analysis = _duplicate_analysis(df)
    if dup_analysis["count"] > 0:
        recs.append({"action": "remove_duplicates", "priority": "high" if dup_analysis["pct"] > 5 else "low", "message": f"Remove {dup_analysis['count']} duplicate rows ({dup_analysis['pct']}%)"})
    outlier_analysis = _outlier_analysis(df)
    high_outlier_cols = [c for c in outlier_analysis["columns"] if c["pct"] > 5][:5]
    if high_outlier_cols:
        recs.append({"action": "remove_outliers", "priority": "medium", "message": f"Remove outliers from {len(high_outlier_cols)} columns with >5% outliers", "columns": [c["column"] for c in high_outlier_cols]})
    feature_types = _detect_feature_types(df)
    if "categorical" in feature_types:
        cat_cols = [c for c in feature_types["categorical"] if c != target][:5]
        if cat_cols:
            recs.append({"action": "encode_categorical", "priority": "medium", "message": f"Encode {len(cat_cols)} categorical columns for ML", "columns": cat_cols})
    if target and target in df.columns and df[target].dtype == "object":
        recs.append({"action": "encode_target", "priority": "high", "message": f"Encode target column '{target}' for classification"})
    imbalance = _class_imbalance(df, target)
    if imbalance["detected"] and imbalance["severity"] in ("medium", "high"):
        recs.append({"action": "handle_imbalance", "priority": "high", "message": f"Class imbalance detected (ratio {imbalance['imbalance_ratio']}x). Consider SMOTE or class weights."})
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        recs.append({"action": "scale_numeric", "priority": "low", "message": f"Scale {len(numeric_cols)} numeric columns for distance-based models", "columns": numeric_cols[:5]})
    return recs


def _generate_insights(df: pd.DataFrame, target: str = None) -> list:
    insights = []
    rows, cols = df.shape
    insights.append(f"Dataset contains {rows:,} rows and {cols} columns.")
    missing_analysis = _missing_analysis(df)
    if missing_analysis["missing_pct"] == 0:
        insights.append("No missing values detected — dataset is complete.")
    else:
        insights.append(f"{missing_analysis['missing_pct']}% of cells are missing ({missing_analysis['total_missing']} values).")
    dup_analysis = _duplicate_analysis(df)
    if dup_analysis["count"] > 0:
        insights.append(f"Found {dup_analysis['count']} duplicate rows ({dup_analysis['pct']}% of data).")
    else:
        insights.append("No duplicate rows detected.")
    feature_types = _detect_feature_types(df)
    parts = []
    if "numeric" in feature_types:
        parts.append(f"{len(feature_types['numeric'])} numeric")
    if "categorical" in feature_types:
        parts.append(f"{len(feature_types['categorical'])} categorical")
    if "text" in feature_types:
        parts.append(f"{len(feature_types['text'])} text")
    if "datetime" in feature_types:
        parts.append(f"{len(feature_types['datetime'])} datetime")
    if parts:
        insights.append(f"Features: {', '.join(parts)}.")
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) >= 2:
        high_corr = _correlation_analysis(df)
        if high_corr["top_correlations"]:
            top = high_corr["top_correlations"][0]
            insights.append(f"Strongest correlation: {top['x']} vs {top['y']} ({top['value']}).")
    outlier_analysis = _outlier_analysis(df)
    if outlier_analysis["total_outliers"] > 0:
        insights.append(f"{outlier_analysis['total_outliers']} outliers detected ({outlier_analysis['mean_pct']}% avg per column).")
    if target and target in df.columns:
        imbalance = _class_imbalance(df, target)
        if imbalance["detected"]:
            classes = list(imbalance["distribution"].keys())
            insights.append(f"Target '{target}' has {imbalance['classes']} classes: {', '.join(classes[:5])}{'...' if imbalance['classes'] > 5 else ''}.")
            if imbalance["severity"] == "high":
                insights.append("Dataset has severe class imbalance — consider resampling techniques.")
    qs = _quality_score(df, target)
    insights.append(f"Overall data quality: {qs['grade']} ({qs['total']}/100).")
    return insights


def analyze_dataset(file_name: str, target: str = None) -> dict:
    df = load_dataset(file_name)
    if target is None:
        target_detection = _detect_target_column(df)
        target = target_detection["suggested"]
    else:
        target_detection = None
    return {
        "name": file_name,
        "rows": len(df),
        "columns": len(df.columns),
        "target": target,
        "target_detection": target_detection,
        "feature_types": _detect_feature_types(df),
        "missing": _missing_analysis(df),
        "duplicates": _duplicate_analysis(df),
        "outliers": _outlier_analysis(df),
        "class_imbalance": _class_imbalance(df, target),
        "correlation": _correlation_analysis(df),
        "distributions": _distribution_analysis(df),
        "quality_score": _quality_score(df, target),
        "recommendations": _recommendations(df, target),
        "insights": _generate_insights(df, target),
    }
