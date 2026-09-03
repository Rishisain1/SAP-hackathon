import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export default function ProbabilityChart({ data }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-normal text-slate-950">Risk Distribution</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Probability</span>
      </div>
      <div className="mt-5 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#475569', fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              formatter={(value) => [`${value}%`, 'Probability']}
              contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
            <Bar dataKey="probability" radius={[6, 6, 0, 0]} fill="#0f766e" maxBarSize={58}>
              <LabelList dataKey="probability" position="top" formatter={(value) => `${value}%`} fill="#0f172a" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
