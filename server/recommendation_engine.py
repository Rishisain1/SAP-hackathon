import json
import math
import sys
from datetime import date, timedelta
from typing import Optional


HIGH_SUPPLIER_DEFECT_RATE = 0.10
HIGH_WEATHER_SEVERITY = 0.40
MAX_BATCH_SIZE = 1500


def add_days(date_value: str, days: int) -> str:
    return (date.fromisoformat(date_value) + timedelta(days=days)).isoformat()


def round_money(value: float) -> float:
    return round(value + 1e-9, 2)


def supplier_quality_recommendation(payload: dict) -> Optional[dict]:
    input_data = payload["input"]
    defect = payload["defect"]
    profiles = payload.get("profiles", {})
    supplier_rates = profiles.get("supplierRates", {})
    current_supplier = input_data["supplier"]
    current_rate = supplier_rates.get(current_supplier, defect.get("supplierHistoricalDefectRatePct", 0) / 100)

    if current_rate < HIGH_SUPPLIER_DEFECT_RATE and defect.get("defectRatePct", 0) < 12:
        return None

    alternatives = [
        (supplier, rate)
        for supplier, rate in supplier_rates.items()
        if supplier != current_supplier and isinstance(rate, (int, float))
    ]
    if not alternatives:
        return None

    best_supplier, best_rate = min(alternatives, key=lambda item: item[1])
    quantity = int(input_data["quantity"])
    unit_price = float(input_data["unitPrice"])
    current_predicted_rate = defect.get("defectRatePct", current_rate * 100) / 100
    adjusted_target_rate = max(best_rate, current_predicted_rate - max(0, current_rate - best_rate))
    reduced_units = max(0, round(quantity * (current_predicted_rate - adjusted_target_rate)))

    if reduced_units <= 0:
        reduced_units = max(1, round(quantity * max(0, current_rate - best_rate)))

    return {
        "category": "Supplier Quality",
        "action": (
            f"Switch this PO from {current_supplier} to {best_supplier}; historical defect rate "
            f"drops from {current_rate * 100:.2f}% to {best_rate * 100:.2f}%."
        ),
        "impact": (
            f"Estimated reduction of {reduced_units} defective units "
            f"({round_money(reduced_units * unit_price)} USD protected)."
        ),
        "priority": "High" if reduced_units >= 50 else "Medium",
        "applyPatch": {
            "supplier": best_supplier
        },
        "metrics": {
            "estimatedDefectReductionUnits": reduced_units,
            "estimatedFinancialProtection": round_money(reduced_units * unit_price),
            "currentSupplierDefectRatePct": round(current_rate * 100, 2),
            "recommendedSupplierDefectRatePct": round(best_rate * 100, 2),
        },
    }


def batch_splitting_recommendation(payload: dict) -> Optional[dict]:
    input_data = payload["input"]
    quantity = int(input_data["quantity"])
    if quantity <= MAX_BATCH_SIZE:
        return None

    shipment_count = math.ceil(quantity / MAX_BATCH_SIZE)
    per_shipment_quantity = math.ceil(quantity / shipment_count)
    defect = payload["defect"]
    delay = payload["delay"]
    estimated_defect_reduction = max(1, round(defect.get("estimatedDefectiveUnits", 0) * 0.08))
    estimated_delay_reduction = 1 if delay.get("predictedDelayDays", 0) >= 2 else 0

    return {
        "category": "Volume Control",
        "action": (
            f"Split {quantity:,} units into {shipment_count} shipments of about "
            f"{per_shipment_quantity:,} units to reduce handling concentration."
        ),
        "impact": (
            f"Estimated reduction of {estimated_defect_reduction} defective units"
            + (f" and {estimated_delay_reduction} delay day." if estimated_delay_reduction else ".")
        ),
        "priority": "Medium",
        "applyPatch": {
            "quantity": per_shipment_quantity
        },
        "metrics": {
            "shipmentCount": shipment_count,
            "perShipmentQuantity": per_shipment_quantity,
            "estimatedDefectReductionUnits": estimated_defect_reduction,
            "estimatedDelayReductionDays": estimated_delay_reduction,
        },
    }


def buffer_time_recommendation(payload: dict) -> Optional[dict]:
    input_data = payload["input"]
    weather = payload["weather"]
    delay = payload["delay"]
    severity = float(weather.get("severity", 0))
    high_weather = severity >= HIGH_WEATHER_SEVERITY or any(
        alert.get("severity", 0) >= HIGH_WEATHER_SEVERITY for alert in weather.get("alerts", [])
    )

    if not high_weather:
        return None

    buffer_days = max(2, min(7, math.ceil(severity * 6 + delay.get("predictedDelayDays", 0) * 0.35)))
    new_delivery_date = add_days(input_data["expectedDeliveryDate"], buffer_days)

    return {
        "category": "Logistics",
        "action": (
            f"Add a {buffer_days}-day delivery buffer because route weather severity is "
            f"{round(severity * 100)}%."
        ),
        "impact": f"Estimated reduction of {min(buffer_days, delay.get('predictedDelayDays', buffer_days))} delay days.",
        "priority": "High" if severity >= 0.75 else "Medium",
        "applyPatch": {
            "expectedDeliveryDate": new_delivery_date
        },
        "metrics": {
            "bufferDays": buffer_days,
            "adjustedExpectedDeliveryDate": new_delivery_date,
            "estimatedDelayReductionDays": min(buffer_days, delay.get("predictedDelayDays", buffer_days)),
        },
    }


def generate_recommendations(payload: dict) -> list[dict]:
    recommendation_builders = [
        supplier_quality_recommendation,
        batch_splitting_recommendation,
        buffer_time_recommendation,
    ]
    recommendations = []

    for builder in recommendation_builders:
        recommendation = builder(payload)
        if recommendation:
            recommendations.append(recommendation)

    return recommendations


def main() -> None:
    payload = json.load(sys.stdin)
    print(json.dumps(generate_recommendations(payload)))


if __name__ == "__main__":
    main()
