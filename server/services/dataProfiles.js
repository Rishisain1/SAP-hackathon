import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clamp, round } from '../utils/math.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const defectCsvPath = path.join(rootDir, 'deffective', 'Deffective.csv');

const supplierReliability = {
  Alpha_Inc: 0.88,
  Beta_Supplies: 0.82,
  Gamma_Co: 0.91,
  Delta_Logistics: 0.68,
  Epsilon_Group: 0.77
};

const categoryRiskOffset = {
  'Office Supplies': -0.01,
  MRO: 0.01,
  Packaging: 0.02,
  'Raw Materials': 0.035,
  Electronics: 0.03,
  Chemicals: 0.04,
  Hardware: 0.018
};

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function loadDefectProfiles() {
  const fallback = {
    overallDefectRate: 0.085,
    supplierRates: {
      Alpha_Inc: 0.055,
      Beta_Supplies: 0.082,
      Gamma_Co: 0.063,
      Delta_Logistics: 0.165,
      Epsilon_Group: 0.095
    },
    categoryRates: {
      'Office Supplies': 0.068,
      MRO: 0.077,
      Packaging: 0.091,
      'Raw Materials': 0.126,
      Electronics: 0.103,
      Chemicals: 0.118,
      Hardware: 0.083
    }
  };

  if (!fs.existsSync(defectCsvPath)) {
    return fallback;
  }

  const [headerLine, ...rows] = fs.readFileSync(defectCsvPath, 'utf8').trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const supplierAgg = new Map();
  const categoryAgg = new Map();
  let totalQuantity = 0;
  let totalDefective = 0;

  for (const row of rows) {
    const values = parseCsvLine(row);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const quantity = Number(record.Quantity);
    const defective = Number(record.Defective_Units);

    if (!Number.isFinite(quantity) || !Number.isFinite(defective) || quantity <= 0) continue;

    totalQuantity += quantity;
    totalDefective += defective;

    for (const [map, key] of [
      [supplierAgg, record.Supplier],
      [categoryAgg, record.Item_Category]
    ]) {
      const existing = map.get(key) ?? { defective: 0, quantity: 0, count: 0 };
      existing.defective += defective;
      existing.quantity += quantity;
      existing.count += 1;
      map.set(key, existing);
    }
  }

  const mapToRates = (map) =>
    Object.fromEntries(
      [...map.entries()].map(([key, value]) => [
        key,
        round(clamp(value.defective / value.quantity, 0.003, 0.4), 4)
      ])
    );

  return {
    overallDefectRate: round(totalDefective / totalQuantity, 4) || fallback.overallDefectRate,
    supplierRates: { ...fallback.supplierRates, ...mapToRates(supplierAgg) },
    categoryRates: { ...fallback.categoryRates, ...mapToRates(categoryAgg) },
    supplierCounts: Object.fromEntries([...supplierAgg.entries()].map(([key, value]) => [key, value.count]))
  };
}

const cityCoordinates = {
  'new york': { lat: 40.7128, lon: -74.006 },
  london: { lat: 51.5072, lon: -0.1276 },
  mumbai: { lat: 19.076, lon: 72.8777 },
  delhi: { lat: 28.6139, lon: 77.209 },
  bengaluru: { lat: 12.9716, lon: 77.5946 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  pune: { lat: 18.5204, lon: 73.8567 },
  chennai: { lat: 13.0827, lon: 80.2707 },
  hyderabad: { lat: 17.385, lon: 78.4867 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  singapore: { lat: 1.3521, lon: 103.8198 },
  shanghai: { lat: 31.2304, lon: 121.4737 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  dubai: { lat: 25.2048, lon: 55.2708 },
  hamburg: { lat: 53.5511, lon: 9.9937 },
  rotterdam: { lat: 51.9244, lon: 4.4777 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  dallas: { lat: 32.7767, lon: -96.797 },
  seattle: { lat: 47.6062, lon: -122.3321 },
  'los angeles': { lat: 34.0522, lon: -118.2437 }
};

export const profiles = loadDefectProfiles();

export function getSupplierProfile(supplier) {
  const rate = profiles.supplierRates[supplier] ?? profiles.overallDefectRate;
  const reliability = supplierReliability[supplier] ?? 0.8;
  return {
    defectRate: rate,
    reliability,
    defectLift: round((rate / profiles.overallDefectRate - 1) * 100, 1),
    sampleSize: profiles.supplierCounts?.[supplier] ?? null
  };
}

export function getCategoryProfile(category) {
  return {
    defectRate: profiles.categoryRates[category] ?? profiles.overallDefectRate,
    riskOffset: categoryRiskOffset[category] ?? 0
  };
}

export function lookupCityCoordinates(location) {
  if (!location) return null;
  const normalized = location.toLowerCase();
  const matchedKey = Object.keys(cityCoordinates).find((key) => normalized.includes(key));
  return matchedKey ? cityCoordinates[matchedKey] : null;
}
