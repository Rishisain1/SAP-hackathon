import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { getRouteWeatherRisk } from './services/weatherService.js';
import { predictPurchaseOrderRisk } from './services/modelService.js';

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

const purchaseOrderSchema = z
  .object({
    supplier: z.enum(['Alpha_Inc', 'Beta_Supplies', 'Gamma_Co', 'Delta_Logistics', 'Epsilon_Group']),
    itemCategory: z.string().min(2),
    quantity: z.coerce.number().int().positive().max(1000000),
    unitPrice: z.coerce.number().positive().max(10000000),
    orderDate: z.string().date(),
    expectedDeliveryDate: z.string().date(),
    originLocation: z.string().min(2).max(120),
    destinationLocation: z.string().min(2).max(120),
    shippingMode: z.enum(['Air', 'Road', 'Rail', 'Sea'])
  })
  .refine((data) => new Date(data.expectedDeliveryDate) >= new Date(data.orderDate), {
    message: 'Expected delivery date must be on or after order date.',
    path: ['expectedDeliveryDate']
  });

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'po-risk-intelligence',
    weather: process.env.WEATHER_API_KEY ? 'live-enabled' : 'fallback-enabled',
    time: new Date().toISOString()
  });
});

app.post('/api/predict-po-risk', async (req, res, next) => {
  try {
    const parsed = purchaseOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid purchase order payload',
        details: parsed.error.flatten()
      });
    }

    const input = parsed.data;
    const weather = await getRouteWeatherRisk(
      input.originLocation,
      input.destinationLocation,
      input.expectedDeliveryDate
    );
    const prediction = await predictPurchaseOrderRisk(input, weather);

    res.json(prediction);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: 'Prediction service failed',
    message: error.message
  });
});

app.listen(port, () => {
  console.log(`PO Risk Intelligence API listening on http://localhost:${port}`);
});
