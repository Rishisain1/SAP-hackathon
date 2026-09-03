export default function KpiCard({ label, value, detail, accent = 'slate' }) {
  const accents = {
    slate: 'border-slate-200 bg-white text-slate-950',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    red: 'border-rose-200 bg-rose-50 text-rose-950',
    blue: 'border-sky-200 bg-sky-50 text-sky-950'
  };

  return (
    <section className={`rounded-lg border p-4 shadow-sm ${accents[accent] ?? accents.slate}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-3 text-2xl font-semibold tracking-normal">{value}</div>
      <p className="mt-2 min-h-5 text-sm text-slate-600">{detail}</p>
    </section>
  );
}
