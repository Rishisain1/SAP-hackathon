# Purchase Order Risk Intelligence

Production-ready React + Node.js/Express application for predicting purchase-order delivery delays and defective units. It integrates live OpenWeatherMap forecasts when `WEATHER_API_KEY` is configured and uses deterministic local fallbacks when models or weather credentials are unavailable.

## Install

```bash
npm install
```

Optional Python model tooling:

```bash
pip install -r requirements.txt
npm run train:models
```

## Environment

Create or update `.env`:

```bash
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
WEATHER_API_KEY=your_openweathermap_api_key
WEATHER_PROVIDER=openweathermap
MODEL_DIR=./models
ENABLE_PYTHON_MODELS=true
```

If `WEATHER_API_KEY` is blank, the backend uses a deterministic weather simulation so the app remains runnable.

## Run

```bash
npm run dev
```

Frontend: http://localhost:5173

Backend health: http://localhost:5000/api/health

Prediction endpoint:

```bash
POST http://localhost:5000/api/predict-po-risk
```

## Model Behavior

- If `models/defective_model.pkl` and `models/delay_model.pkl` exist and Python dependencies are installed, Express delegates inference to `scripts/infer_models.py`.
- If either model is missing or Python inference fails, Express uses local fallback inference calibrated from the provided CSV datasets.
- `server/recommendation_engine.py` generates prescriptive recommendations for supplier swaps, batch splitting, and weather buffer days. Express falls back to the equivalent JS rules if Python is unavailable.
- `scripts/train_models.py` trains sklearn pipelines from `deffective/Deffective.csv` and `delay/delay.csv`.
