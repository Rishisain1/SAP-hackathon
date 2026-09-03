import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import joblib
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / os.getenv("MODEL_DIR", "models")


def days_between(start: str, end: str) -> int:
    start_date = date.fromisoformat(start)
    end_date = date.fromisoformat(end)
    return max(1, (end_date - start_date).days)


def weather_condition_from_severity(weather: dict) -> str:
    alerts = " ".join(alert.get("message", "") for alert in weather.get("alerts", [])).lower()
    severity = float(weather.get("severity", 0))
    if "snow" in alerts or "ice" in alerts:
        return "Snow"
    if "rain" in alerts or "storm" in alerts or severity >= 0.55:
        return "Storm"
    if "wind" in alerts:
        return "Fog"
    return "Clear"


def risk_level(probability: float, delay_days: int) -> str:
    if probability >= 0.66 or delay_days >= 5:
        return "High"
    if probability >= 0.36 or delay_days >= 2:
        return "Medium"
    return "Low"


def main() -> None:
    payload = json.load(sys.stdin)
    input_data = payload["input"]
    weather = payload["weather"]
    distance_km = float(payload["distanceKm"])

    defective_model = joblib.load(MODEL_DIR / "defective_model.pkl")
    delay_model = joblib.load(MODEL_DIR / "delay_model.pkl")

    delivery_days = days_between(input_data["orderDate"], input_data["expectedDeliveryDate"])
    quantity = int(input_data["quantity"])
    unit_price = float(input_data["unitPrice"])

    defect_frame = pd.DataFrame(
        [
            {
                "Supplier": input_data["supplier"],
                "Item_Category": input_data["itemCategory"],
                "Order_Status": "Delivered",
                "Quantity": quantity,
                "Delivery_Time_Days": delivery_days,
                "Unit_Price": unit_price,
            }
        ]
    )
    estimated_defective = max(0, min(quantity, int(round(float(defective_model.predict(defect_frame)[0])))))
    defect_rate_pct = (estimated_defective / quantity) * 100

    weather_condition = weather_condition_from_severity(weather)
    delay_frame = pd.DataFrame(
        [
            {
                "shipping_distance_km": distance_km,
                "shipping_method": input_data["shippingMode"],
                "weather_condition": weather_condition,
                "order_quantity": quantity,
                "warehouse_inventory_level": max(100, 6000 - quantity),
            }
        ]
    )

    delay_probability = 0.35
    if hasattr(delay_model, "predict_proba"):
        delay_probability = float(delay_model.predict_proba(delay_frame)[0][1])
    else:
        delay_probability = float(delay_model.predict(delay_frame)[0])

    predicted_delay_days = max(0, int(round(delay_probability * 6 + float(weather.get("severity", 0)) * 3 - delivery_days / 14)))
    expected_arrival = datetime.fromisoformat(input_data["expectedDeliveryDate"]) + timedelta(days=predicted_delay_days)

    result = {
        "defect": {
            "modelSource": "python-pkl-model",
            "estimatedDefectiveUnits": estimated_defective,
            "defectRatePct": round(defect_rate_pct, 2),
            "expectedFinancialImpact": round(estimated_defective * unit_price, 2),
            "supplierHistoricalDefectRatePct": round(defect_rate_pct, 2),
            "categoryHistoricalDefectRatePct": round(defect_rate_pct, 2),
            "supplierDefectLiftPct": 0,
            "confidence": 0.88,
        },
        "delay": {
            "modelSource": "python-pkl-model",
            "predictedDelayDays": predicted_delay_days,
            "expectedArrivalDate": expected_arrival.date().isoformat(),
            "delayProbabilityPct": round(delay_probability * 100, 1),
            "riskLevel": risk_level(delay_probability, predicted_delay_days),
            "plannedTransitDays": delivery_days,
            "estimatedRouteDistanceKm": round(distance_km, 1),
            "confidence": 0.86,
        },
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
