from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(exist_ok=True)


def train_defective_model() -> None:
    df = pd.read_csv(ROOT / "deffective" / "Deffective.csv")
    df = df.dropna(subset=["Defective_Units"]).copy()
    df["Order_Date"] = pd.to_datetime(df["Order_Date"])
    df["Delivery_Date"] = pd.to_datetime(df["Delivery_Date"])
    df["Delivery_Time_Days"] = (df["Delivery_Date"] - df["Order_Date"]).dt.days.clip(lower=1)

    features = [
        "Supplier",
        "Item_Category",
        "Order_Status",
        "Quantity",
        "Delivery_Time_Days",
        "Unit_Price",
    ]
    X = df[features]
    y = df["Defective_Units"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), ["Quantity", "Delivery_Time_Days", "Unit_Price"]),
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["Supplier", "Item_Category", "Order_Status"]),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("regressor", RandomForestRegressor(n_estimators=160, random_state=42, min_samples_leaf=2)),
        ]
    )

    X_train, _, y_train, _ = train_test_split(X, y, test_size=0.2, random_state=42)
    model.fit(X_train, y_train)
    joblib.dump(model, MODEL_DIR / "defective_model.pkl")


def train_delay_model() -> None:
    df = pd.read_csv(ROOT / "delay" / "delay.csv")
    speed_map = {"Air": 500.0, "Road": 60.0, "Rail": 40.0, "Sea": 25.0}
    df["transit_time_hours"] = df["shipping_distance_km"] / df["shipping_method"].map(speed_map)
    threshold = df["transit_time_hours"].median()
    df["transit_delay_risk"] = (df["transit_time_hours"] > threshold).astype(int)

    features = [
        "shipping_distance_km",
        "shipping_method",
        "weather_condition",
        "order_quantity",
        "warehouse_inventory_level",
    ]
    X = df[features]
    y = df["transit_delay_risk"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), ["shipping_distance_km", "order_quantity", "warehouse_inventory_level"]),
            ("cat", OneHotEncoder(drop="first", handle_unknown="ignore"), ["shipping_method", "weather_condition"]),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", HistGradientBoostingClassifier(random_state=42)),
        ]
    )

    X_train, _, y_train, _ = train_test_split(X, y, test_size=0.2, random_state=42)
    model.fit(X_train, y_train)
    joblib.dump(model, MODEL_DIR / "delay_model.pkl")


if __name__ == "__main__":
    train_defective_model()
    train_delay_model()
    print(f"Models written to {MODEL_DIR}")
