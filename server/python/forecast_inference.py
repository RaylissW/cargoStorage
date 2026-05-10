from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from train_xgboost_warehouse import (
    HOT_DEMAND_THRESHOLD,
    build_daily_sku_dataset,
    get_column_map,
    get_feature_columns,
    read_orders,
)


def load_artifacts(artifacts_dir: Path | str = "artifacts") -> tuple[xgb.Booster, dict]:
    artifacts_path = Path(artifacts_dir)
    booster = xgb.Booster()
    booster.load_model(str(artifacts_path / "xgboost_warehouse_model.json"))
    metadata = json.loads((artifacts_path / "model_metadata.json").read_text(encoding="utf-8"))
    return booster, metadata


def _encode_value(value: str, mapping: dict[str, int]) -> int:
    return int(mapping.get(str(value), -1))


def _prepare_daily_frame_from_orders(orders: pd.DataFrame, column_map: dict[str, str]) -> pd.DataFrame:
    daily = build_daily_sku_dataset(orders, column_map)
    daily = daily.sort_values(["SKU", "date"]).reset_index(drop=True)
    return daily


def _add_inference_features(daily: pd.DataFrame) -> pd.DataFrame:
    frame = daily.copy()
    grouped = frame.groupby("SKU", group_keys=False)

    for lag in [1, 2, 3, 7, 14]:
        frame[f"lag_{lag}"] = grouped["qty"].shift(lag)

    shifted_qty = grouped["qty"].shift(1)
    for window in [3, 7, 14, 28]:
        rolling_group = shifted_qty.groupby(frame["SKU"])
        frame[f"roll_mean_{window}"] = (
            rolling_group.rolling(window, min_periods=1).mean().reset_index(level=0, drop=True)
        )
        frame[f"roll_std_{window}"] = (
            rolling_group.rolling(window, min_periods=2).std().reset_index(level=0, drop=True).fillna(0.0)
        )
        frame[f"roll_sum_{window}"] = (
            rolling_group.rolling(window, min_periods=1).sum().reset_index(level=0, drop=True)
        )

    recency_values: list[float] = []
    for _, sku_frame in frame.groupby("SKU"):
        last_sale_index: int | None = None
        for row_index, sold_qty in enumerate(sku_frame["qty"].tolist()):
            recency_values.append(np.nan if last_sale_index is None else float(row_index - last_sale_index))
            if sold_qty > 0:
                last_sale_index = row_index
    frame["days_since_sale"] = recency_values

    frame["dow"] = frame["date"].dt.dayofweek
    frame["dom"] = frame["date"].dt.day
    frame["weekofyear"] = frame["date"].dt.isocalendar().week.astype(int)
    frame["month"] = frame["date"].dt.month
    frame["is_weekend"] = frame["dow"].isin([5, 6]).astype(int)
    return frame


def _build_latest_feature_row(
    daily_with_features: pd.DataFrame,
    sku: str,
    metadata: dict,
    forecast_date: str | None = None,
) -> pd.DataFrame:
    feature_columns = metadata["feature_columns"]
    sku_frame = daily_with_features[daily_with_features["SKU"].astype(str) == str(sku)].copy()
    if sku_frame.empty:
        raise ValueError(f"SKU {sku} not found in input history.")

    if forecast_date is not None:
        target_date = pd.Timestamp(forecast_date)
        sku_frame = sku_frame[sku_frame["date"] <= target_date].copy()
        if sku_frame.empty:
            raise ValueError(f"No history for SKU {sku} on or before {forecast_date}.")

    latest = sku_frame.iloc[[-1]].copy()

    for col in feature_columns:
        if col not in latest.columns:
            latest[col] = np.nan

    for numeric_col in [
        "avg_price",
        "avg_paid",
        "avg_discount_pct",
        "avg_discount_rub",
        "promo_count",
        "days_since_sale",
        "dow",
        "dom",
        "weekofyear",
        "month",
        "is_weekend",
        "lag_1",
        "lag_2",
        "lag_3",
        "lag_7",
        "lag_14",
        "roll_mean_3",
        "roll_mean_7",
        "roll_mean_14",
        "roll_mean_28",
        "roll_std_3",
        "roll_std_7",
        "roll_std_14",
        "roll_std_28",
        "roll_sum_3",
        "roll_sum_7",
        "roll_sum_14",
        "roll_sum_28",
    ]:
        if numeric_col in latest.columns:
            latest[numeric_col] = pd.to_numeric(latest[numeric_col], errors="coerce")

    latest = latest.fillna(0.0)

    latest["SKU"] = latest["SKU"].astype(str).map(metadata["categorical_mappings"]["SKU"]).fillna(-1).astype(int)
    latest["product_name"] = (
        latest["product_name"]
        .astype(str)
        .map(metadata["categorical_mappings"]["product_name"])
        .fillna(-1)
        .astype(int)
    )

    return latest[feature_columns]


def _zone_from_prediction(predicted_units_next_7_days: float) -> str:
    if predicted_units_next_7_days >= 14:
        return "hot_zone"
    if predicted_units_next_7_days >= HOT_DEMAND_THRESHOLD:
        return "warm_zone"
    return "cold_zone"


def predict_for_sku_from_orders(
    sku: str,
    orders_csv_path: Path | str = "orders.csv",
    artifacts_dir: Path | str = "artifacts",
    forecast_date: str | None = None,
) -> dict:
    booster, metadata = load_artifacts(artifacts_dir)
    orders, column_map = read_orders(Path(orders_csv_path))
    daily = _prepare_daily_frame_from_orders(orders, column_map)
    daily_with_features = _add_inference_features(daily)

    sku_raw = daily_with_features[daily_with_features["SKU"].astype(str) == str(sku)].copy()
    if sku_raw.empty:
        raise ValueError(f"SKU {sku} not found in {orders_csv_path}.")

    if forecast_date is not None:
        sku_raw = sku_raw[sku_raw["date"] <= pd.Timestamp(forecast_date)].copy()
        if sku_raw.empty:
            raise ValueError(f"No history for SKU {sku} on or before {forecast_date}.")

    latest_raw = sku_raw.iloc[-1]
    feature_row = _build_latest_feature_row(daily_with_features, sku, metadata, forecast_date)
    dmatrix = xgb.DMatrix(feature_row)
    prediction = float(max(0.0, booster.predict(dmatrix)[0]))

    return {
        "sku": str(sku),
        "product_name": str(latest_raw["product_name"]),
        "history_last_date": pd.Timestamp(latest_raw["date"]).strftime("%Y-%m-%d"),
        "forecast_horizon_days": int(metadata["forecast_horizon_days"]),
        "predicted_units_next_7_days": prediction,
        "recommended_zone": _zone_from_prediction(prediction),
    }


def predict_all_skus_from_orders(
    orders_csv_path: Path | str = "orders.csv",
    artifacts_dir: Path | str = "artifacts",
    forecast_date: str | None = None,
) -> list[dict]:
    orders, column_map = read_orders(Path(orders_csv_path))
    sku_values = sorted(orders[column_map["sku"]].astype(str).unique())
    return [
        predict_for_sku_from_orders(
            sku=sku,
            orders_csv_path=orders_csv_path,
            artifacts_dir=artifacts_dir,
            forecast_date=forecast_date,
        )
        for sku in sku_values
    ]


if __name__ == "__main__":
    sample = predict_all_skus_from_orders()
    print(json.dumps(sample[:5], ensure_ascii=False, indent=2))
