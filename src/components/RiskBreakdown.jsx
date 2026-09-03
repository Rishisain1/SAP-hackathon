import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function RiskBreakdown({ items, status }) {
  const Icon = status === 'Green' ? CheckCircle2 : AlertTriangle;
  const color = status === 'Green' ? 'text-emerald-700' : status === 'Amber' ? 'text-amber-700' : 'text-rose-700';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <h2 className="text-base font-semibold tracking-normal text-slate-950">Risk Breakdown</h2>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
