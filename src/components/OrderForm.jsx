import { CalendarDays, Factory, MapPin, Package, Send } from 'lucide-react';

const suppliers = ['Alpha_Inc', 'Beta_Supplies', 'Gamma_Co', 'Delta_Logistics', 'Epsilon_Group'];
const categories = ['Office Supplies', 'MRO', 'Packaging', 'Raw Materials', 'Electronics', 'Chemicals', 'Hardware'];
const shippingModes = ['Air', 'Road', 'Rail', 'Sea'];

const fieldBase =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

export default function OrderForm({ form, setForm, onSubmit, loading, error }) {
  const update = (field) => (event) => {
    const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <aside className="border-r border-slate-200 bg-white">
      <form onSubmit={onSubmit} className="flex min-h-screen flex-col gap-6 p-5">
        <div>
          <div className="flex items-center gap-2 text-slate-950">
            <Factory className="h-5 w-5 text-sky-600" />
            <h1 className="text-lg font-semibold tracking-normal">PO Risk Intelligence</h1>
          </div>
          <p className="mt-2 text-sm text-slate-500">Executive procurement risk dashboard</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="supplier">
              Vendor / Supplier
            </label>
            <select id="supplier" className={fieldBase} value={form.supplier} onChange={update('supplier')} required>
              {suppliers.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="itemCategory">
              Item Category
            </label>
            <select
              id="itemCategory"
              className={fieldBase}
              value={form.itemCategory}
              onChange={update('itemCategory')}
              required
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <NumberField label="Quantity" value={form.quantity} onChange={update('quantity')} min="1" icon={Package} />
            <NumberField label="Unit Price" value={form.unitPrice} onChange={update('unitPrice')} min="0.01" step="0.01" />
            <NumberField
              label="Negotiated"
              value={form.negotiatedPrice}
              onChange={update('negotiatedPrice')}
              min="0.01"
              step="0.01"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <DateField label="Order Date" value={form.orderDate} onChange={update('orderDate')} />
            <DateField label="Expected Delivery" value={form.expectedDeliveryDate} onChange={update('expectedDeliveryDate')} />
          </div>

          <div className="space-y-3">
            <LocationField label="Origin City / Zip" value={form.originLocation} onChange={update('originLocation')} />
            <LocationField label="Destination City / Zip" value={form.destinationLocation} onChange={update('destinationLocation')} />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="shippingMode">
              Shipping Mode
            </label>
            <select
              id="shippingMode"
              className={fieldBase}
              value={form.shippingMode}
              onChange={update('shippingMode')}
              required
            >
              {shippingModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Send className="h-4 w-4" />
          {loading ? 'Analyzing' : 'Run Prediction'}
        </button>
      </form>
    </aside>
  );
}

function NumberField({ label, value, onChange, min, step = '1', icon: Icon }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {label}
        <span className="relative block">
          {Icon ? <Icon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /> : null}
          <input
            className={`${fieldBase} ${Icon ? 'pl-9' : ''}`}
            type="number"
            min={min}
            step={step}
            value={value}
            onChange={onChange}
            required
          />
        </span>
      </label>
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {label}
        <span className="relative block">
          <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input className={`${fieldBase} pl-9`} type="date" value={value} onChange={onChange} required />
        </span>
      </label>
    </div>
  );
}

function LocationField({ label, value, onChange }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <span className="relative block">
        <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input className={`${fieldBase} pl-9`} type="text" value={value} onChange={onChange} required />
      </span>
    </label>
  );
}
