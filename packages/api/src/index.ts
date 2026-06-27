import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { db, timestampLabel } from './data';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

const cartItemSchema = z.object({
  drinkId: z.string().min(1),
  quantity: z.number().int().positive().max(12),
});

const orderSchema = z.object({
  venueId: z.string().min(1),
  items: z.array(cartItemSchema).min(1),
});

const redemptionSchema = z.object({
  rewardId: z.string().min(1),
  points: z.number().int().nonnegative(),
});

const topUpSchema = z.object({
  amount: z.number().positive().max(500),
});

const checkInSchema = z.object({
  venueId: z.string().min(1),
});

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'goodpint-api' });
});

app.get('/api/app-state', (_request, response) => {
  response.json(db);
});

app.get('/api/venues', (_request, response) => {
  response.json(db.venues);
});

app.get('/api/rewards', (_request, response) => {
  response.json(db.rewards);
});

app.post('/api/orders', (request, response) => {
  const parsed = orderSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid order payload', details: parsed.error.flatten() });
    return;
  }

  const venue = db.venues.find((candidate) => candidate.id === parsed.data.venueId);

  if (!venue) {
    response.status(404).json({ error: 'Venue not found' });
    return;
  }

  const lineItems = parsed.data.items.map((item) => {
    const drink = db.drinks.find((candidate) => candidate.id === item.drinkId);

    if (!drink) {
      throw new Error(`Drink not found: ${item.drinkId}`);
    }

    return {
      drink,
      quantity: item.quantity,
      subtotal: drink.price * item.quantity,
      points: drink.points * item.quantity,
    };
  });

  const total = Number(lineItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const pointsEarned = lineItems.reduce((sum, item) => sum + item.points, 0);

  if (db.wallet.balance < total) {
    response.status(402).json({ error: 'Insufficient wallet balance', balance: db.wallet.balance, total });
    return;
  }

  db.wallet.balance = Number((db.wallet.balance - total).toFixed(2));
  db.points += pointsEarned;
  db.transactions.unshift({
    id: crypto.randomUUID(),
    title: venue.name,
    amount: -total,
    timestamp: timestampLabel(),
  });

  response.status(201).json({
    orderId: crypto.randomUUID(),
    pickupWindow: venue.pickupWindow,
    total,
    pointsEarned,
    walletBalance: db.wallet.balance,
  });
});

app.post('/api/redeem', (request, response) => {
  const parsed = redemptionSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid redemption payload', details: parsed.error.flatten() });
    return;
  }

  const reward = db.rewards.find((candidate) => candidate.id === parsed.data.rewardId);

  if (!reward) {
    response.status(404).json({ error: 'Reward not found' });
    return;
  }

  if (db.points < reward.points) {
    response.status(402).json({ error: 'Not enough points', required: reward.points, points: db.points });
    return;
  }

  db.points -= reward.points;
  db.transactions.unshift({
    id: crypto.randomUUID(),
    title: reward.title,
    amount: 0,
    timestamp: timestampLabel(),
  });

  response.status(201).json({
    redemptionId: crypto.randomUUID(),
    reward,
    points: db.points,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
});

app.post('/api/wallet/top-up', (request, response) => {
  const parsed = topUpSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid top-up payload', details: parsed.error.flatten() });
    return;
  }

  db.wallet.balance = Number((db.wallet.balance + parsed.data.amount).toFixed(2));
  db.transactions.unshift({
    id: crypto.randomUUID(),
    title: 'Wallet top up',
    amount: parsed.data.amount,
    timestamp: timestampLabel(),
  });

  response.status(201).json({ balance: db.wallet.balance });
});

app.post('/api/check-ins', (request, response) => {
  const parsed = checkInSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid check-in payload', details: parsed.error.flatten() });
    return;
  }

  const venue = db.venues.find((candidate) => candidate.id === parsed.data.venueId);

  if (!venue) {
    response.status(404).json({ error: 'Venue not found' });
    return;
  }

  const pointsEarned = 25;
  db.points += pointsEarned;

  response.status(201).json({ points: db.points, pointsEarned, venue });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

app.listen(port, () => {
  console.log(`GoodPint API listening on http://localhost:${port}`);
});
