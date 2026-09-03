import { Check, PackageCheck, Route, ShieldCheck } from 'lucide-react';

const categoryIcon = {
  'Supplier Quality': ShieldCheck,
  Logistics: Route,
  'Volume Control': PackageCheck
};

const priorityStyle = {
  High: 'bg-rose-50 text-rose-700 border-rose-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export default function RecommendationCards({ recommendations, onApply, appliedIndex }) {
  if (!recommendations?.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <h2 className="text-base font-semibold tracking-normal text-slate-950">Prescriptive Actions</h2>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          No immediate supplier, weather, or batch changes are recommended for this purchase order.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-semibold tracking-normal text-slate-950">Prescriptive Actions</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {recommendations.length} open
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {recommendations.map((recommendation, index) => (
          <RecommendationCard
            key={`${recommendation.category}-${recommendation.action}`}
            recommendation={recommendation}
            applied={appliedIndex === index}
            onApply={() => onApply(recommendation, index)}
          />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({ recommendation, applied, onApply }) {
  const Icon = categoryIcon[recommendation.category] ?? ShieldCheck;
  const canApply = recommendation.applyPatch && Object.keys(recommendation.applyPatch).length > 0;

  return (
    <article className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-slate-950">{recommendation.category}</span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                priorityStyle[recommendation.priority] ?? priorityStyle.Low
              }`}
            >
              {recommendation.priority ?? 'Low'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">{recommendation.action}</p>
          <p className="mt-2 text-sm font-medium text-slate-950">{recommendation.impact}</p>
        </div>

        <button
          type="button"
          disabled={!canApply || applied}
          onClick={onApply}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition hover:border-teal-600 hover:text-teal-700 disabled:cursor-not-allowed disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700"
        >
          {applied ? <Check className="h-4 w-4" /> : null}
          {applied ? 'Applied' : 'Apply Recommendation'}
        </button>
      </div>
    </article>
  );
}
