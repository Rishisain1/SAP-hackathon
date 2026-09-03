import { clamp, round } from '../utils/math.js';
import { lookupCityCoordinates } from './dataProfiles.js';

const OPENWEATHER_BASE = 'https://api.openweathermap.org';

function scoreWeather(entry) {
  const temp = entry.main?.temp;
  const windSpeedMps = entry.wind?.speed ?? 0;
  const rain3h = entry.rain?.['3h'] ?? 0;
  const snow3h = entry.snow?.['3h'] ?? 0;
  const condition = entry.weather?.[0]?.main ?? 'Clear';
  const description = entry.weather?.[0]?.description ?? 'clear conditions';

  let severity = 0;
  const reasons = [];

  if (Number.isFinite(temp) && (temp >= 38 || temp <= -5)) {
    severity += 0.22;
    reasons.push(`Extreme temperature near ${round(temp, 1)}C`);
  }

  if (rain3h >= 12) {
    severity += 0.32;
    reasons.push(`Heavy rainfall forecast at ${round(rain3h, 1)} mm over 3 hours`);
  } else if (rain3h >= 4) {
    severity += 0.14;
    reasons.push(`Moderate rainfall forecast at ${round(rain3h, 1)} mm over 3 hours`);
  }

  if (snow3h >= 4) {
    severity += 0.38;
    reasons.push(`Snow accumulation forecast at ${round(snow3h, 1)} mm over 3 hours`);
  }

  if (windSpeedMps >= 16) {
    severity += 0.35;
    reasons.push(`High wind forecast at ${round(windSpeedMps * 3.6, 1)} kph`);
  } else if (windSpeedMps >= 10) {
    severity += 0.16;
    reasons.push(`Elevated wind forecast at ${round(windSpeedMps * 3.6, 1)} kph`);
  }

  if (['Thunderstorm', 'Tornado', 'Squall'].includes(condition)) {
    severity += 0.42;
    reasons.push(`Severe ${condition.toLowerCase()} conditions expected`);
  }

  if (['Snow', 'Rain'].includes(condition) && reasons.length === 0) {
    severity += 0.08;
    reasons.push(`${condition} may slow route handling`);
  }

  return {
    severity: round(clamp(severity, 0, 1), 2),
    condition,
    description,
    tempC: Number.isFinite(temp) ? round(temp, 1) : null,
    windKph: round(windSpeedMps * 3.6, 1),
    rainMm3h: round(rain3h, 1),
    snowMm3h: round(snow3h, 1),
    reasons
  };
}

function selectForecastForDate(forecasts, targetDate) {
  const targetNoon = new Date(`${targetDate}T12:00:00Z`).getTime();
  return forecasts.reduce((closest, entry) => {
    const entryTime = new Date(entry.dt_txt).getTime();
    const distance = Math.abs(entryTime - targetNoon);
    if (!closest || distance < closest.distance) return { entry, distance };
    return closest;
  }, null)?.entry;
}

async function openWeatherRequest(path, params) {
  const url = new URL(path, OPENWEATHER_BASE);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap ${response.status}`);
  }
  return response.json();
}

async function fetchOpenWeather(location, date, apiKey) {
  const geo = await openWeatherRequest('/geo/1.0/direct', {
    q: location,
    limit: '1',
    appid: apiKey
  });

  if (!geo?.length) {
    throw new Error(`No geocode match for ${location}`);
  }

  const coordinates = { lat: geo[0].lat, lon: geo[0].lon };
  const [current, forecast] = await Promise.all([
    openWeatherRequest('/data/2.5/weather', {
      lat: coordinates.lat,
      lon: coordinates.lon,
      units: 'metric',
      appid: apiKey
    }),
    openWeatherRequest('/data/2.5/forecast', {
      lat: coordinates.lat,
      lon: coordinates.lon,
      units: 'metric',
      appid: apiKey
    })
  ]);

  const forecasts = forecast.list ?? [];
  const hasTargetDate = forecasts.some((entry) => entry.dt_txt?.startsWith(date));
  if (!hasTargetDate) {
    return seededWeatherFallback(location, date);
  }

  const selectedForecast = selectForecastForDate(forecasts, date);
  const scoredCurrent = scoreWeather(current);
  const scoredForecast = selectedForecast ? scoreWeather(selectedForecast) : scoredCurrent;
  const severity = Math.max(scoredCurrent.severity * 0.45, scoredForecast.severity);

  return {
    location,
    provider: 'openweathermap',
    source: 'live',
    coordinates,
    forecastDate: selectedForecast?.dt_txt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    current: scoredCurrent,
    forecast: scoredForecast,
    severity: round(clamp(severity, 0, 1), 2),
    alerts: [...new Set([...scoredCurrent.reasons, ...scoredForecast.reasons])]
  };
}

function seededWeatherFallback(location, date) {
  const month = new Date(date).getMonth() + 1;
  const normalized = `${location}-${date}`.toLowerCase();
  const hash = [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const monsoon = ['mumbai', 'chennai', 'kolkata', 'singapore'].some((city) =>
    normalized.includes(city)
  );
  const winter = ['chicago', 'hamburg', 'rotterdam', 'new york', 'london'].some((city) =>
    normalized.includes(city)
  );
  const desertHeat = ['dubai', 'dallas'].some((city) => normalized.includes(city));

  let severity = (hash % 18) / 100;
  const alerts = [];
  let condition = 'Clear';
  let description = 'stable simulated conditions';
  let tempC = 24 + (hash % 11);
  let windKph = 12 + (hash % 18);
  let rainMm3h = 0;
  let snowMm3h = 0;

  if (monsoon && month >= 6 && month <= 9) {
    severity += 0.34;
    condition = 'Rain';
    description = 'monsoon rain risk';
    rainMm3h = 8 + (hash % 16);
    alerts.push(`Seasonal heavy rainfall risk near ${location}`);
  }

  if (winter && (month <= 2 || month === 12)) {
    severity += 0.28;
    condition = 'Snow';
    description = 'winter disruption risk';
    tempC = -4 + (hash % 7);
    snowMm3h = 2 + (hash % 7);
    alerts.push(`Winter snow or ice disruption risk near ${location}`);
  }

  if (desertHeat && month >= 5 && month <= 9) {
    severity += 0.2;
    condition = 'Extreme';
    description = 'high temperature logistics risk';
    tempC = 39 + (hash % 8);
    alerts.push(`Extreme heat risk near ${location}`);
  }

  if (hash % 13 === 0) {
    severity += 0.22;
    windKph = 48 + (hash % 22);
    alerts.push(`High wind handling risk near ${location}`);
  }

  const scored = {
    severity: round(clamp(severity, 0, 1), 2),
    condition,
    description,
    tempC,
    windKph,
    rainMm3h,
    snowMm3h,
    reasons: alerts
  };

  return {
    location,
    provider: 'deterministic-fallback',
    source: 'simulated',
    coordinates: lookupCityCoordinates(location),
    forecastDate: date,
    current: scored,
    forecast: scored,
    severity: scored.severity,
    alerts: alerts.length ? alerts : [`No severe weather indicators near ${location}`]
  };
}

export async function getRouteWeatherRisk(origin, destination, date) {
  const apiKey = process.env.WEATHER_API_KEY;
  const locations = [origin, destination];
  const results = [];

  for (const location of locations) {
    try {
      if (!apiKey) throw new Error('WEATHER_API_KEY is not configured');
      results.push(await fetchOpenWeather(location, date, apiKey));
    } catch {
      results.push(seededWeatherFallback(location, date));
    }
  }

  const severity = round(clamp(Math.max(...results.map((item) => item.severity)), 0, 1), 2);

  return {
    provider: results.some((item) => item.source === 'live') ? 'openweathermap' : 'deterministic-fallback',
    severity,
    locations: {
      origin: results[0],
      destination: results[1]
    },
    alerts: results.flatMap((item) =>
      item.alerts.map((alert) => ({
        location: item.location,
        message: alert,
        severity: item.severity
      }))
    )
  };
}
