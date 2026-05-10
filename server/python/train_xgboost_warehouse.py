from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor


RANDOM_STATE = 42
FORECAST_HORIZON_DAYS = 7
HOT_DEMAND_THRESHOLD = 7
LAG_WINDOWS = [1, 2, 3, 7, 14]
ROLLING_WINDOWS = [3, 7, 14, 28]

@dataclass(frozen=True)
class SplitFrames:
    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame
    full_train: pd.DataFrame


def get_column_map(columns: list[str]) -> dict[str, str]:
    return {
        "order_created_at": columns[2],
        "status": columns[4],
        "product_name": columns[9],
        "sku": columns[10],
        "seller_price": columns[12],
        "buyer_paid": columns[14],
        "quantity": columns[16],
        "discount_pct": columns[21],
        "discount_rub": columns[22],
        "promotions": columns[23],
    }


def read_orders(csv_path: Path) -> tuple[pd.DataFrame, dict[str, str]]:
    orders = pd.read_csv(csv_path, sep=";", encoding="utf-8-sig")
    column_map = get_column_map(list(orders.columns))

    orders = orders[orders[column_map["status"]] != "Отменён"].copy()
    orders[column_map["order_created_at"]] = pd.to_datetime(
        orders[column_map["order_created_at"]],
        errors="coerce",
    )
    orders[column_map["quantity"]] = pd.to_numeric(
        orders[column_map["quantity"]],
        errors="coerce",
    ).fillna(0.0)
    orders[column_map["seller_price"]] = pd.to_numeric(
        orders[column_map["seller_price"]],
        errors="coerce",
    ).fillna(0.0)
    orders[column_map["buyer_paid"]] = pd.to_numeric(
        orders[column_map["buyer_paid"]],
        errors="coerce",
    ).fillna(0.0)
    orders[column_map["discount_rub"]] = pd.to_numeric(
        orders[column_map["discount_rub"]],
        errors="coerce",
    ).fillna(0.0)
    orders[column_map["discount_pct"]] = pd.to_numeric(
        orders[column_map["discount_pct"]].astype(str).str.replace("%", "", regex=False),
        errors="coerce",
    ).fillna(0.0)
    orders[column_map["sku"]] = orders[column_map["sku"]].astype(str)
    orders = orders.dropna(subset=[column_map["order_created_at"]]).copy()

    return orders, column_map


def build_daily_sku_dataset(orders: pd.DataFrame, columns: dict[str, str]) -> pd.DataFrame:
    daily = (
        orders.groupby(
            [orders[columns["order_created_at"]].dt.date, columns["sku"]],
            as_index=False,
        )
        .agg(
            qty=(columns["quantity"], "sum"),
            avg_price=(columns["seller_price"], "mean"),
            avg_paid=(columns["buyer_paid"], "mean"),
            avg_discount_pct=(columns["discount_pct"], "mean"),
            avg_discount_rub=(columns["discount_rub"], "mean"),
            promo_count=(columns["promotions"], lambda s: s.fillna("").astype(str).str.len().gt(0).sum()),
            product_name=(columns["product_name"], "first"),
        )
    )

    daily["date"] = pd.to_datetime(daily[columns["order_created_at"]])
    all_dates = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
    all_skus = sorted(orders[columns["sku"]].unique())
    full_index = pd.MultiIndex.from_product([all_dates, all_skus], names=["date", "SKU"])

    dense = (
        daily.rename(columns={columns["sku"]: "SKU"})
        .set_index(["date", "SKU"])
        .reindex(full_index)
        .reset_index()
    )

    dense["product_name"] = dense.groupby("SKU")["product_name"].ffill().bfill()
    for numeric_column in [
        "qty",
        "avg_price",
        "avg_paid",
        "avg_discount_pct",
        "avg_discount_rub",
        "promo_count",
    ]:
        dense[numeric_column] = pd.to_numeric(dense[numeric_column], errors="coerce").fillna(0.0)

    return dense.sort_values(["SKU", "date"]).reset_index(drop=True)


def add_history_features(dataset: pd.DataFrame) -> pd.DataFrame:
    enriched = dataset.copy()
    grouped = enriched.groupby("SKU", group_keys=False)

    for lag in LAG_WINDOWS:
        enriched[f"lag_{lag}"] = grouped["qty"].shift(lag)

    shifted_qty = grouped["qty"].shift(1)
    for window in ROLLING_WINDOWS:
        rolling_group = shifted_qty.groupby(enriched["SKU"])
        enriched[f"roll_mean_{window}"] = (
            rolling_group.rolling(window, min_periods=1).mean().reset_index(level=0, drop=True)
        )
        enriched[f"roll_std_{window}"] = (
            rolling_group.rolling(window, min_periods=2).std().reset_index(level=0, drop=True).fillna(0.0)
        )
        enriched[f"roll_sum_{window}"] = (
            rolling_group.rolling(window, min_periods=1).sum().reset_index(level=0, drop=True)
        )

    recency_values: list[float] = []
    for _, sku_frame in enriched.groupby("SKU"):
        last_sale_index: int | None = None
        for row_index, sold_qty in enumerate(sku_frame["qty"].tolist()):
            recency_values.append(np.nan if last_sale_index is None else float(row_index - last_sale_index))
            if sold_qty > 0:
                last_sale_index = row_index
    enriched["days_since_sale"] = recency_values

    enriched["dow"] = enriched["date"].dt.dayofweek
    enriched["dom"] = enriched["date"].dt.day
    enriched["weekofyear"] = enriched["date"].dt.isocalendar().week.astype(int)
    enriched["month"] = enriched["date"].dt.month
    enriched["is_weekend"] = enriched["dow"].isin([5, 6]).astype(int)

    enriched["future_7d_qty"] = grouped["qty"].transform(
        lambda series: series.shift(-1).iloc[::-1].rolling(FORECAST_HORIZON_DAYS, min_periods=1).sum().iloc[::-1]
    )
    enriched["target"] = (enriched["future_7d_qty"] >= HOT_DEMAND_THRESHOLD).astype(int)
    return enriched


def encode_categorical_columns(
    dataset: pd.DataFrame,
    mappings: dict[str, dict[str, int]] | None = None,
) -> tuple[pd.DataFrame, dict[str, dict[str, int]]]:
    encoded = dataset.copy()
    learned_mappings = {} if mappings is None else mappings

    for column in ["SKU", "product_name"]:
        if mappings is None:
            unique_values = sorted(encoded[column].dropna().astype(str).unique())
            learned_mappings[column] = {value: idx for idx, value in enumerate(unique_values)}
        encoded[column] = encoded[column].astype(str).map(learned_mappings[column]).fillna(-1).astype(int)

    return encoded, learned_mappings


def get_feature_columns() -> list[str]:
    return [
        "SKU",
        "product_name",
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
        *[f"lag_{lag}" for lag in LAG_WINDOWS],
        *[f"roll_mean_{window}" for window in ROLLING_WINDOWS],
        *[f"roll_std_{window}" for window in ROLLING_WINDOWS],
        *[f"roll_sum_{window}" for window in ROLLING_WINDOWS],
    ]


def build_model_frame(dataset: pd.DataFrame) -> pd.DataFrame:
    feature_columns = get_feature_columns()
    model_frame = dataset.dropna(subset=["future_7d_qty"]).copy()
    model_frame = model_frame.dropna(subset=feature_columns).copy()
    return model_frame


def time_split(dataset: pd.DataFrame) -> SplitFrames:
    unique_dates = sorted(dataset["date"].unique())
    train_cut = unique_dates[int(len(unique_dates) * 0.70)]
    validation_cut = unique_dates[int(len(unique_dates) * 0.85)]

    train = dataset[dataset["date"] < train_cut].copy()
    validation = dataset[(dataset["date"] >= train_cut) & (dataset["date"] < validation_cut)].copy()
    test = dataset[dataset["date"] >= validation_cut].copy()
    full_train = dataset[dataset["date"] < validation_cut].copy()
    return SplitFrames(train=train, validation=validation, test=test, full_train=full_train)


def get_candidate_params() -> list[dict[str, float | int]]:
    return [
        {
            "max_depth": 3,
            "learning_rate": 0.05,
            "n_estimators": 300,
            "subsample": 0.90,
            "colsample_bytree": 0.90,
            "min_child_weight": 1,
        },
        {
            "max_depth": 4,
            "learning_rate": 0.05,
            "n_estimators": 400,
            "subsample": 0.90,
            "colsample_bytree": 0.80,
            "min_child_weight": 1,
        },
        {
            "max_depth": 5,
            "learning_rate": 0.03,
            "n_estimators": 500,
            "subsample": 0.90,
            "colsample_bytree": 0.80,
            "min_child_weight": 2,
        },
        {
            "max_depth": 4,
            "learning_rate": 0.08,
            "n_estimators": 250,
            "subsample": 1.00,
            "colsample_bytree": 0.90,
            "min_child_weight": 1,
        },
    ]


def fit_model(
    train_frame: pd.DataFrame,
    feature_columns: list[str],
    params: dict[str, float | int],
    eval_frame: pd.DataFrame | None = None,
) -> XGBRegressor:
    model = XGBRegressor(
        objective="reg:squarederror",
        eval_metric="rmse",
        tree_method="hist",
        random_state=RANDOM_STATE,
        **params,
    )

    fit_kwargs = {}
    if eval_frame is not None:
        fit_kwargs["eval_set"] = [(eval_frame[feature_columns], eval_frame["future_7d_qty"])]
        fit_kwargs["verbose"] = False

    model.fit(train_frame[feature_columns], train_frame["future_7d_qty"], **fit_kwargs)
    return model


def select_best_params(splits: SplitFrames, feature_columns: list[str]) -> tuple[dict[str, float | int], list[dict[str, float]]]:
    ranking: list[dict[str, float]] = []
    best_key: tuple[float, float] | None = None
    best_params: dict[str, float | int] | None = None

    for params in get_candidate_params():
        model = fit_model(splits.train, feature_columns, params, eval_frame=splits.validation)
        predictions = model.predict(splits.validation[feature_columns])
        predictions = np.clip(predictions, a_min=0.0, a_max=None)
        mae = float(mean_absolute_error(splits.validation["future_7d_qty"], predictions))
        rmse = float(np.sqrt(mean_squared_error(splits.validation["future_7d_qty"], predictions)))
        ranking.append(
            {
                "mae": mae,
                "rmse": rmse,
                **params,
            }
        )
        key = (-mae, -rmse)
        if best_key is None or key > best_key:
            best_key = key
            best_params = params

    if best_params is None:
        raise RuntimeError("Hyperparameter selection failed.")

    ranking.sort(key=lambda row: (row["mae"], row["rmse"]))
    return best_params, ranking


def evaluate_model(model: XGBRegressor, frame: pd.DataFrame, feature_columns: list[str]) -> dict[str, object]:
    actual = frame["future_7d_qty"].to_numpy()
    predictions = model.predict(frame[feature_columns])
    predictions = np.clip(predictions, a_min=0.0, a_max=None)
    rmse = float(np.sqrt(mean_squared_error(actual, predictions)))
    return {
        "mae": float(mean_absolute_error(actual, predictions)),
        "rmse": rmse,
        "r2": float(r2_score(actual, predictions)),
        "actual_mean": float(np.mean(actual)),
        "predicted_mean": float(np.mean(predictions)),
        "sample_predictions": [
            {
                "actual": float(a),
                "predicted": float(p),
            }
            for a, p in list(zip(actual[:15], predictions[:15]))
        ],
    }


def generate_latest_recommendations(
    full_feature_frame: pd.DataFrame,
    encoded_feature_frame: pd.DataFrame,
    feature_columns: list[str],
    model: XGBRegressor,
) -> pd.DataFrame:
    latest_date = encoded_feature_frame["date"].max()
    latest_encoded = encoded_feature_frame[encoded_feature_frame["date"] == latest_date].copy()
    latest_raw = full_feature_frame.loc[latest_encoded.index, ["date", "SKU", "product_name", "qty", "future_7d_qty"]].copy()

    predictions = model.predict(latest_encoded[feature_columns])
    predictions = np.clip(predictions, a_min=0.0, a_max=None)

    latest_raw["predicted_units_next_7_days"] = predictions
    latest_raw["recommended_zone"] = np.select(
        [
            latest_raw["predicted_units_next_7_days"] >= 14,
            latest_raw["predicted_units_next_7_days"] >= HOT_DEMAND_THRESHOLD,
        ],
        [
            "hot_zone",
            "warm_zone",
        ],
        default="cold_zone",
    )
    latest_raw = latest_raw.sort_values(
        ["predicted_units_next_7_days", "qty"],
        ascending=[False, False],
    )
    return latest_raw.reset_index(drop=True)


def save_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    project_dir = Path(__file__).resolve().parent
    data_path = project_dir / "orders.csv"
    artifacts_dir = project_dir / "artifacts"
    artifacts_dir.mkdir(exist_ok=True)

    orders, column_map = read_orders(data_path)
    daily_dataset = build_daily_sku_dataset(orders, column_map)
    feature_dataset = add_history_features(daily_dataset)
    encoded_dataset, category_mappings = encode_categorical_columns(feature_dataset)
    model_frame = build_model_frame(encoded_dataset)

    feature_columns = get_feature_columns()
    splits = time_split(model_frame)
    best_params, ranking = select_best_params(splits, feature_columns)

    evaluation_model = fit_model(splits.full_train, feature_columns, best_params)
    evaluation = evaluate_model(evaluation_model, splits.test, feature_columns)

    deployment_model = fit_model(model_frame, feature_columns, best_params)
    recommendations = generate_latest_recommendations(
        full_feature_frame=feature_dataset.loc[model_frame.index],
        encoded_feature_frame=model_frame,
        feature_columns=feature_columns,
        model=deployment_model,
    )

    deployment_model.get_booster().save_model(str(artifacts_dir / "xgboost_warehouse_model.json"))

    save_json(
        artifacts_dir / "model_metadata.json",
        {
            "random_state": RANDOM_STATE,
            "forecast_horizon_days": FORECAST_HORIZON_DAYS,
            "hot_demand_threshold": HOT_DEMAND_THRESHOLD,
            "target_definition": "future_7d_qty",
            "recommendation_thresholds": {
                "hot_zone_units_gte": 14,
                "warm_zone_units_gte": HOT_DEMAND_THRESHOLD,
            },
            "feature_columns": feature_columns,
            "categorical_mappings": category_mappings,
            "best_params": best_params,
            "dataset_summary": {
                "raw_orders_after_cancel_filter": int(len(orders)),
                "daily_rows_dense": int(len(feature_dataset)),
                "model_rows": int(len(model_frame)),
                "date_min": feature_dataset["date"].min().strftime("%Y-%m-%d"),
                "date_max": feature_dataset["date"].max().strftime("%Y-%m-%d"),
                "unique_sku": int(feature_dataset["SKU"].nunique()),
            },
        },
    )

    save_json(
        artifacts_dir / "evaluation.json",
        {
            "validation_search_ranking": ranking,
            "holdout_test_metrics": evaluation,
        },
    )

    feature_importance = pd.DataFrame(
        {
            "feature": feature_columns,
            "importance": deployment_model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)

    feature_dataset.to_csv(artifacts_dir / "processed_daily_dataset.csv", index=False, encoding="utf-8-sig")
    recommendations.to_csv(artifacts_dir / "latest_placement_recommendations.csv", index=False, encoding="utf-8-sig")
    feature_importance.to_csv(artifacts_dir / "feature_importance.csv", index=False, encoding="utf-8-sig")

    print("Best params:", best_params)
    print("Holdout MAE:", round(evaluation["mae"], 4))
    print("Holdout RMSE:", round(evaluation["rmse"], 4))
    print("Artifacts saved to:", artifacts_dir)


if __name__ == "__main__":
    main()
