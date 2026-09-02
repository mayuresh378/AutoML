import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from crud import list_experiments, list_models, list_dataset_records
from models import PredictionLog, AuditLog, Dataset, UserSession


def dashboard_analytics(db: Session, days: int = 30) -> dict:
    experiments = list_experiments(db)
    models = list_models(db)
    datasets = list_dataset_records(db)

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    recent_exps = [e for e in experiments if e.created_at and e.created_at >= cutoff]

    daily_counts: dict = {}
    for e in recent_exps:
        day = e.created_at.strftime("%Y-%m-%d") if e.created_at else "unknown"
        daily_counts[day] = daily_counts.get(day, 0) + 1

    training_trends = sorted(
        [{"date": d, "count": c} for d, c in daily_counts.items()],
        key=lambda x: x["date"]
    )

    model_scores = [
        {"name": e.name or f"Exp-{e.id[:8]}", "model": e.model or "unknown", "score": e.cv_score or 0, "time": e.training_time or 0}
        for e in experiments if e.cv_score is not None
    ]

    accuracy_trends = [
        {"date": e.created_at.strftime("%Y-%m-%d") if e.created_at else "unknown", "score": (e.cv_score or 0) * 100}
        for e in experiments if e.cv_score is not None
    ]

    model_type_counts: dict = {}
    for m in models:
        mt = m.model_type or "unknown"
        model_type_counts[mt] = model_type_counts.get(mt, 0) + 1
    model_distribution = [{"name": k, "count": v} for k, v in sorted(model_type_counts.items(), key=lambda x: -x[1])]

    total_training_hours = sum((e.training_time or 0) for e in experiments) / 3600
    total_storage_mb = sum((d.file_size_kb or 0) for d in datasets) / 1024

    prediction_logs = db.query(PredictionLog).filter(PredictionLog.created_at >= cutoff).all()
    total_predictions = len(prediction_logs)

    pred_daily: dict = {}
    for p in prediction_logs:
        day = p.created_at.strftime("%Y-%m-%d") if p.created_at else "unknown"
        pred_daily[day] = pred_daily.get(day, 0) + 1
    prediction_trends = sorted(
        [{"date": d, "count": c} for d, c in pred_daily.items()],
        key=lambda x: x["date"]
    )

    model_usage: dict = {}
    for p in prediction_logs:
        mn = p.model_name or "unknown"
        model_usage[mn] = model_usage.get(mn, 0) + 1
    model_usage_chart = [{"name": k, "count": v} for k, v in sorted(model_usage.items(), key=lambda x: -x[1])[:10]]

    dataset_growth: dict = {}
    for d in datasets:
        if d.created_at and d.created_at >= cutoff:
            day = d.created_at.strftime("%Y-%m-%d")
            dataset_growth[day] = dataset_growth.get(day, 0) + 1
    dataset_growth_chart = sorted(
        [{"date": d, "count": c} for d, c in dataset_growth.items()],
        key=lambda x: x["date"]
    )

    audit_logs = db.query(AuditLog).filter(AuditLog.created_at >= cutoff).all()
    user_activity_daily: dict = {}
    for a in audit_logs:
        day = a.created_at.strftime("%Y-%m-%d") if a.created_at else "unknown"
        user_activity_daily[day] = user_activity_daily.get(day, 0) + 1
    user_activity_chart = sorted(
        [{"date": d, "count": c} for d, c in user_activity_daily.items()],
        key=lambda x: x["date"]
    )

    active_sessions = db.query(UserSession).filter(
        UserSession.is_active == True,
        UserSession.last_used_at >= cutoff
    ).count()

    success_rate = round(
        sum(1 for e in experiments if e.status == "success") / max(len(experiments), 1) * 100, 1
    )

    avg_latency_ms = round(
        sum(p.latency_ms or 0 for p in prediction_logs) / max(len(prediction_logs), 1), 1
    ) if prediction_logs else 0

    total_dataset_rows = sum(d.rows or 0 for d in datasets)

    return {
        "training_trends": training_trends,
        "model_scores": model_scores,
        "accuracy_trends": accuracy_trends,
        "model_distribution": model_distribution,
        "prediction_trends": prediction_trends,
        "model_usage": model_usage_chart,
        "dataset_growth": dataset_growth_chart,
        "user_activity": user_activity_chart,
        "total_experiments": len(experiments),
        "total_models": len(models),
        "total_datasets": len(datasets),
        "total_training_hours": round(total_training_hours, 2),
        "total_storage_mb": round(total_storage_mb, 2),
        "total_predictions": total_predictions,
        "success_rate": success_rate,
        "active_sessions": active_sessions,
        "avg_latency_ms": avg_latency_ms,
        "total_dataset_rows": total_dataset_rows,
    }
