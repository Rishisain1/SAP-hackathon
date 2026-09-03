import { useMemo, useState } from 'react';
import { Activity, Banknote, CalendarClock, ShieldAlert } from 'lucide-react';
import KpiCard from './components/KpiCard.jsx';
import OrderForm from './components/OrderForm.jsx';
import ProbabilityChart from './components/ProbabilityChart.jsx';
import RecommendationCards from './components/RecommendationCards.jsx';
import RiskBreakdown from './components/RiskBreakdown.jsx';
import WeatherWidget from './components/WeatherWidget.jsx';
import { predictPurchaseOrderRisk } from './lib/api.js';
import { supplierLocations } from './lib/supplierLocations.js';

const today = new Date();
const initialOrderDate = today.toISOString().slice(0, 10);
const initialDeliveryDate = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const defaultForm = {
  supplier: 'Delta_Logistics',
  itemCategory: 'Raw Materials',
  quantity: 1180,
  unitPrice: 64.07,
  orderDate: initialOrderDate,
  expectedDeliveryDate: initialDeliveryDate,
  originLocation: supplierLocations.Delta_Logistics,
  destinationLocation: 'Chicago',
  shippingMode: 'Sea'
};

function currency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

function statusAccent(status) {
  if (status === 'Red') return 'red';
  if (status === 'Amber') return 'amber';
  return 'green';
}

function validate(form) {
  if (form.quantity <= 0 || form.unitPrice <= 0) {
    return 'Quantity and unit price must be positive.';
  }
  if (new Date(form.expectedDeliveryDate) < new Date(form.orderDate)) {
    return 'Expected delivery date must be on or after the order date.';
  }
  return '';
}

export default function App() {
  const [form, setForm] = useState(defaultForm);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appliedRecommendation, setAppliedRecommendation] = useState(null);

  const orderValue = useMemo(() => form.quantity * form.unitPrice, [form.quantity, form.unitPrice]);

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await predictPurchaseOrderRisk(form);
      setPrediction(result);
      setAppliedRecommendation(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function applyRecommendation(recommendation, index) {
    if (!recommendation.applyPatch) return;
    setForm((current) => ({ ...current, ...recommendation.applyPatch }));
    setAppliedRecommendation(index);
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[390px_1fr]">
        <OrderForm form={form} setForm={setForm} onSubmit={handleSubmit} loading={loading} error={error} />

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Procurement Control Tower</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Purchase Order Risk Forecast</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <HeaderMetric icon={Activity} label="Order Value" value={currency(orderValue)} />
                <HeaderMetric icon={CalendarClock} label="Mode" value={form.shippingMode} />
                <HeaderMetric icon={ShieldAlert} label="Supplier" value={form.supplier.replace('_', ' ')} />
                <HeaderMetric icon={Banknote} label="Unit Price" value={currency(form.unitPrice)} />
              </div>
            </header>

            {prediction ? (
              <Dashboard
                prediction={prediction}
                onApplyRecommendation={applyRecommendation}
                appliedRecommendation={appliedRecommendation}
              />
            ) : (
              <section className="mt-8 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Awaiting Forecast</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
                    Submit a purchase order to calculate delay, defect, weather, and financial exposure.
                  </h3>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Dashboard({ prediction, onApplyRecommendation, appliedRecommendation }) {
  const { defect, delay, combinedRisk, weather } = prediction;
  const accent = statusAccent(combinedRisk.status);

  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Predicted Defective Units"
          value={defect.estimatedDefectiveUnits.toLocaleString()}
          detail={`${defect.defectRatePct}% defect rate`}
          accent={defect.defectRatePct >= 12 ? 'red' : defect.defectRatePct >= 7 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Predicted Delay"
          value={`${delay.predictedDelayDays} days`}
          detail={`Arrival ${delay.expectedArrivalDate}`}
          accent={delay.predictedDelayDays >= 5 ? 'red' : delay.predictedDelayDays >= 2 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Financial At Risk"
          value={currency(defect.expectedFinancialImpact)}
          detail={`${Math.round(defect.confidence * 100)}% model confidence`}
          accent="blue"
        />
        <KpiCard
          label="Overall Risk Status"
          value={combinedRisk.label}
          detail={`${combinedRisk.score}% unified score`}
          accent={accent}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <WeatherWidget weather={weather} />
        <ProbabilityChart data={prediction.chartData} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <RiskBreakdown items={prediction.riskBreakdown} status={combinedRisk.status} />
        <RecommendationCards
          recommendations={prediction.recommendations}
          onApply={onApplyRecommendation}
          appliedIndex={appliedRecommendation}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold tracking-normal text-slate-950">Model Trace</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Trace label="Runtime" value={prediction.modelStatus} />
            <Trace label="Delay Risk" value={`${delay.riskLevel} (${delay.delayProbabilityPct}%)`} />
            <Trace label="Route Distance" value={`${delay.estimatedRouteDistanceKm} km`} />
            <Trace label="Weather Severity" value={`${Math.round(weather.severity * 100)}%`} />
            <Trace label="Defect Model" value={defect.modelSource} />
            <Trace label="Delay Model" value={delay.modelSource} />
          </div>
        </section>
      </div>
    </div>
  );
}

function HeaderMetric({ icon, label, value }) {
  const MetricIcon = icon;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <MetricIcon className="h-3.5 w-3.5 text-teal-700" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Trace({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
