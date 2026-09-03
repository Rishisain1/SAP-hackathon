import { CloudRain, Navigation, Thermometer, Wind } from 'lucide-react';

export default function WeatherWidget({ weather }) {
  const sourceLabel = weather.provider === 'openweathermap' ? 'Live OpenWeatherMap' : 'Simulated Forecast';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-sky-600" />
          <h2 className="text-base font-semibold tracking-normal text-slate-950">Weather Overview</h2>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
          {sourceLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <LocationWeather title="Origin" item={weather.locations.origin} />
        <LocationWeather title="Destination" item={weather.locations.destination} />
      </div>

      <div className="mt-5 rounded-md bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Navigation className="h-4 w-4 text-teal-700" />
          Route Alerts
        </div>
        <div className="mt-3 space-y-2">
          {weather.alerts.map((alert) => (
            <div key={`${alert.location}-${alert.message}`} className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{alert.location}:</span> {alert.message}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LocationWeather({ title, item }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.location}</h3>
          <p className="mt-1 text-sm capitalize text-slate-500">{item.forecast.description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {Math.round(item.severity * 100)}%
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm text-slate-600">
        <Metric icon={Thermometer} value={`${item.forecast.tempC ?? '--'}C`} />
        <Metric icon={Wind} value={`${item.forecast.windKph ?? '--'} kph`} />
        <Metric icon={CloudRain} value={`${item.forecast.rainMm3h ?? 0} mm`} />
      </div>
    </div>
  );
}

function Metric({ icon, value }) {
  const MetricIcon = icon;

  return (
    <div className="flex h-10 items-center justify-center gap-1 rounded-md bg-slate-50">
      <MetricIcon className="h-4 w-4 text-slate-500" />
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
