import path from 'node:path';
import { spawn } from 'node:child_process';
import { addDays, round } from '../utils/math.js';
import { profiles } from './dataProfiles.js';

const HIGH_SUPPLIER_DEFECT_RATE = 0.1;
const HIGH_WEATHER_SEVERITY = 0.4;
const MAX_BATCH_SIZE = 1500;

function fallbackRecommendations(input, defect, delay, weather) {
  const recommendations = [];
  const currentSupplierRate =
    profiles.supplierRates[input.supplier] ?? defect.supplierHistoricalDefectRatePct / 100;

  if (currentSupplierRate >= HIGH_SUPPLIER_DEFECT_RATE || defect.defectRatePct >= 12) {
    const alternatives = Object.entries(profiles.supplierRates)
      .filter(([supplier]) => supplier !== input.supplier)
      .sort((a, b) => a[1] - b[1]);
    const [bestSupplier, bestRate] = alternatives[0] ?? [];

    if (bestSupplier) {
      const reducedUnits = Math.max(1, Math.round(input.quantity * Math.max(0, currentSupplierRate - bestRate)));
      recommendations.push({
        category: 'Supplier Quality',
        action: `Switch this PO from ${input.supplier} to ${bestSupplier}; historical defect rate drops from ${round(currentSupplierRate * 100, 2)}% to ${round(bestRate * 100, 2)}%.`,
        impact: `Estimated reduction of ${reducedUnits} defective units (${round(reducedUnits * input.unitPrice, 2)} USD protected).`,
        priority: reducedUnits >= 50 ? 'High' : 'Medium',
        applyPatch: { supplier: bestSupplier },
        metrics: {
          estimatedDefectReductionUnits: reducedUnits,
          estimatedFinancialProtection: round(reducedUnits * input.unitPrice, 2),
          currentSupplierDefectRatePct: round(currentSupplierRate * 100, 2),
          recommendedSupplierDefectRatePct: round(bestRate * 100, 2)
        }
      });
    }
  }

  if (input.quantity > MAX_BATCH_SIZE) {
    const shipmentCount = Math.ceil(input.quantity / MAX_BATCH_SIZE);
    const perShipmentQuantity = Math.ceil(input.quantity / shipmentCount);
    const reducedUnits = Math.max(1, Math.round(defect.estimatedDefectiveUnits * 0.08));
    const delayDays = delay.predictedDelayDays >= 2 ? 1 : 0;
    recommendations.push({
      category: 'Volume Control',
      action: `Split ${input.quantity.toLocaleString()} units into ${shipmentCount} shipments of about ${perShipmentQuantity.toLocaleString()} units to reduce handling concentration.`,
      impact: `Estimated reduction of ${reducedUnits} defective units${delayDays ? ` and ${delayDays} delay day.` : '.'}`,
      priority: 'Medium',
      applyPatch: { quantity: perShipmentQuantity },
      metrics: {
        shipmentCount,
        perShipmentQuantity,
        estimatedDefectReductionUnits: reducedUnits,
        estimatedDelayReductionDays: delayDays
      }
    });
  }

  const severeWeather = weather.severity >= HIGH_WEATHER_SEVERITY;
  if (severeWeather) {
    const bufferDays = Math.max(2, Math.min(7, Math.ceil(weather.severity * 6 + delay.predictedDelayDays * 0.35)));
    recommendations.push({
      category: 'Logistics',
      action: `Add a ${bufferDays}-day delivery buffer because route weather severity is ${Math.round(weather.severity * 100)}%.`,
      impact: `Estimated reduction of ${Math.min(bufferDays, delay.predictedDelayDays || bufferDays)} delay days.`,
      priority: weather.severity >= 0.75 ? 'High' : 'Medium',
      applyPatch: { expectedDeliveryDate: addDays(input.expectedDeliveryDate, bufferDays) },
      metrics: {
        bufferDays,
        adjustedExpectedDeliveryDate: addDays(input.expectedDeliveryDate, bufferDays),
        estimatedDelayReductionDays: Math.min(bufferDays, delay.predictedDelayDays || bufferDays)
      }
    });
  }

  return recommendations;
}

function runPythonRecommendationEngine(payload) {
  const scriptPath = path.resolve(process.cwd(), 'server', 'recommendation_engine.py');
  const serialized = JSON.stringify(payload);

  return new Promise((resolve) => {
    const child = spawn('python', [scriptPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      console.warn(`Recommendation engine unavailable: ${error.message}`);
      resolve(null);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        console.warn(`Recommendation engine failed: ${stderr}`);
        resolve(null);
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : null);
      } catch (error) {
        console.warn(`Recommendation engine returned invalid JSON: ${error.message}`);
        resolve(null);
      }
    });

    child.stdin.write(serialized);
    child.stdin.end();
  });
}

export async function generateRecommendations(input, defect, delay, weather) {
  const payload = {
    input,
    defect,
    delay,
    weather,
    profiles: {
      supplierRates: profiles.supplierRates,
      overallDefectRate: profiles.overallDefectRate
    }
  };

  const pythonRecommendations = await runPythonRecommendationEngine(payload);
  return pythonRecommendations ?? fallbackRecommendations(input, defect, delay, weather);
}
