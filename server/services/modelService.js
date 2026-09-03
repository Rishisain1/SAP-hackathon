import { addDays, clamp, daysBetween, haversineKm, round } from '../utils/math.js';
import {
  getCategoryProfile,
  getSupplierProfile,
  lookupCityCoordinates,
  profiles
} from './dataProfiles.js';
import { hasPythonModels, runPythonModels } from './pythonModelBridge.js';
import { generateRecommendations } from './recommendationService.js';

const speedKmPerDay = {
  Air: 1450,
  Road: 520,
  Rail: 740,
  Sea: 360
};

const shippingRisk = {
  Air: 0.07,
  Road: 0.17,
  Rail: 0.12,
  Sea: 0.24
};

function estimateDistanceKm(input, weather) {
  const originCoords =
    weather.locations.origin.coordinates ?? lookupCityCoordinates(input.originLocation);
  const destinationCoords =
    weather.locations.destination.coordinates ?? lookupCityCoordinates(input.destinationLocation);
  const calculated = haversineKm(originCoords, destinationCoords);
  if (calculated) return round(calculated, 1);

  const seed = `${input.originLocation}-${input.destinationLocation}`.toLowerCase();
  const hash = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 250 + (hash % 2400);
}

function predictDefects(input, weather) {
  const supplierProfile = getSupplierProfile(input.supplier);
  const categoryProfile = getCategoryProfile(input.itemCategory);
  const deliveryDays = daysBetween(input.orderDate, input.expectedDeliveryDate);
  const discount = Math.max(0, input.unitPrice - input.negotiatedPrice);
  const discountPct = input.unitPrice > 0 ? discount / input.unitPrice : 0;

  const historicalRate =
    supplierProfile.defectRate * 0.56 +
    categoryProfile.defectRate * 0.28 +
    profiles.overallDefectRate * 0.16;

  const quantityAdjustment = clamp(Math.log10(input.quantity) / 34, 0, 0.105);
  const pricePressure = clamp(discountPct * 0.32, 0, 0.12);
  const timelinePressure = deliveryDays < 7 ? 0.035 : deliveryDays > 25 ? -0.012 : 0;
  const weatherPressure = weather.severity * 0.025;

  const rate = clamp(
    historicalRate + categoryProfile.riskOffset + quantityAdjustment + pricePressure + timelinePressure + weatherPressure,
    0.003,
    0.38
  );
  const defectiveUnits = Math.min(input.quantity, Math.round(input.quantity * rate));
  const financialImpact = defectiveUnits * input.negotiatedPrice;

  return {
    modelSource: 'dataset-calibrated-js-fallback',
    estimatedDefectiveUnits: defectiveUnits,
    defectRatePct: round((defectiveUnits / input.quantity) * 100, 2),
    expectedFinancialImpact: round(financialImpact, 2),
    supplierHistoricalDefectRatePct: round(supplierProfile.defectRate * 100, 2),
    categoryHistoricalDefectRatePct: round(categoryProfile.defectRate * 100, 2),
    supplierDefectLiftPct: supplierProfile.defectLift,
    confidence: round(clamp(0.68 + (supplierProfile.sampleSize ?? 20) / 500, 0.68, 0.91), 2)
  };
}

function predictDelay(input, weather, distanceKm) {
  const plannedDays = daysBetween(input.orderDate, input.expectedDeliveryDate);
  const supplierProfile = getSupplierProfile(input.supplier);
  const speed = speedKmPerDay[input.shippingMode] ?? speedKmPerDay.Road;
  const transitDays = distanceKm / speed;
  const handlingDays = input.quantity > 1500 ? 1.9 : input.quantity > 800 ? 1.1 : 0.6;
  const reliabilityPenalty = (1 - supplierProfile.reliability) * 4.8;
  const weatherPenalty = weather.severity * 4.2;
  const modePenalty = shippingRisk[input.shippingMode] * 3;
  const predictedTransitWindow = transitDays + handlingDays + reliabilityPenalty + weatherPenalty + modePenalty;
  const rawDelay = predictedTransitWindow - plannedDays;
  const delayDays = Math.max(0, Math.round(rawDelay + weather.severity * 1.2));
  const delayProbability = clamp(
    0.12 +
      shippingRisk[input.shippingMode] +
      weather.severity * 0.36 +
      (1 - supplierProfile.reliability) * 0.31 +
      clamp(rawDelay / 10, -0.09, 0.28),
    0.03,
    0.96
  );

  const riskLevel = delayProbability >= 0.66 || delayDays >= 5 ? 'High' : delayProbability >= 0.36 || delayDays >= 2 ? 'Medium' : 'Low';

  return {
    modelSource: 'dataset-calibrated-js-fallback',
    predictedDelayDays: delayDays,
    expectedArrivalDate: addDays(input.expectedDeliveryDate, delayDays),
    delayProbabilityPct: round(delayProbability * 100, 1),
    riskLevel,
    plannedTransitDays: plannedDays,
    estimatedRouteDistanceKm: distanceKm,
    confidence: round(clamp(0.7 + plannedDays / 100 - weather.severity / 8, 0.62, 0.9), 2)
  };
}

function buildRiskBreakdown(input, defect, delay, weather) {
  const breakdown = [];
  const supplierProfile = getSupplierProfile(input.supplier);

  if (supplierProfile.defectLift > 8) {
    breakdown.push(
      `${input.supplier} runs ${supplierProfile.defectLift}% above the portfolio defect baseline in the historical dataset.`
    );
  } else {
    breakdown.push(
      `${input.supplier} historical quality risk is near baseline at ${defect.supplierHistoricalDefectRatePct}%.`
    );
  }

  if (defect.defectRatePct >= 12) {
    breakdown.push(`Predicted defect exposure is elevated at ${defect.defectRatePct}% of ordered units.`);
  }

  if (delay.predictedDelayDays > 0) {
    breakdown.push(
      `${input.shippingMode} shipping over roughly ${delay.estimatedRouteDistanceKm} km is projected to arrive ${delay.predictedDelayDays} day(s) late.`
    );
  } else {
    breakdown.push(`${input.shippingMode} shipping plan has sufficient schedule buffer for the estimated route distance.`);
  }

  for (const alert of weather.alerts.filter((item) => item.severity >= 0.18).slice(0, 3)) {
    breakdown.push(alert.message);
  }

  if (input.unitPrice > input.negotiatedPrice) {
    const discountPct = ((input.unitPrice - input.negotiatedPrice) / input.unitPrice) * 100;
    if (discountPct >= 8) {
      breakdown.push(`Negotiated discount of ${round(discountPct, 1)}% increases supplier fulfillment pressure.`);
    }
  }

  return breakdown;
}

function combineRisk(input, defect, delay, weather) {
  const orderValue = input.quantity * input.negotiatedPrice;
  const financialExposurePct = orderValue > 0 ? defect.expectedFinancialImpact / orderValue : 0;
  const defectComponent = clamp(defect.defectRatePct / 25, 0, 1) * 36;
  const delayComponent = clamp(delay.predictedDelayDays / 7, 0, 1) * 28;
  const delayProbabilityComponent = (delay.delayProbabilityPct / 100) * 18;
  const weatherComponent = weather.severity * 12;
  const financialComponent = clamp(financialExposurePct / 0.25, 0, 1) * 6;
  const score = round(
    clamp(defectComponent + delayComponent + delayProbabilityComponent + weatherComponent + financialComponent, 0, 100),
    1
  );

  return {
    score,
    status: score >= 70 ? 'Red' : score >= 40 ? 'Amber' : 'Green',
    label: score >= 70 ? 'Critical' : score >= 40 ? 'Watch' : 'Controlled'
  };
}

export async function predictPurchaseOrderRisk(input, weather) {
  const distanceKm = estimateDistanceKm(input, weather);
  const pythonPrediction = await runPythonModels(input, weather, distanceKm);

  const defect = pythonPrediction?.defect ?? predictDefects(input, weather);
  const delay = pythonPrediction?.delay ?? predictDelay(input, weather, distanceKm);
  const combinedRisk = combineRisk(input, defect, delay, weather);
  const riskBreakdown = buildRiskBreakdown(input, defect, delay, weather);
  const recommendations = await generateRecommendations(input, defect, delay, weather);

  return {
    generatedAt: new Date().toISOString(),
    modelStatus: hasPythonModels() && pythonPrediction ? 'python-pkl-models' : 'js-fallback-models',
    input,
    defect,
    delay,
    weather,
    combinedRisk,
    riskBreakdown,
    recommendations,
    chartData: [
      { name: 'Defect', probability: clamp(defect.defectRatePct, 0, 100), exposure: defect.expectedFinancialImpact },
      { name: 'Delay', probability: delay.delayProbabilityPct, exposure: delay.predictedDelayDays },
      { name: 'Weather', probability: round(weather.severity * 100, 1), exposure: weather.alerts.length }
    ]
  };
}
