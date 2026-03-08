import { Router } from 'express';
import { z } from 'zod';
import {
  createCheckoutSession,
  processCheckoutWebhook,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../repository/paymentRepository.js';

export const paymentRouter = Router();

const COIN_PACKS = {
  'pack-small': { amountCoins: 200, amountIls: 9.9 },
  'pack-medium': { amountCoins: 500, amountIls: 19.9 },
  'pack-large': { amountCoins: 1200, amountIls: 39.9 },
} as const;

const createCheckoutSchema = z.object({
  packId: z.enum(['pack-small', 'pack-medium', 'pack-large']),
});

const webhookSchema = z.object({
  providerEventId: z.string().min(1),
  checkoutSessionId: z.string().uuid(),
  status: z.enum(['paid', 'failed']),
  providerReference: z.string().optional(),
});

paymentRouter.post('/checkout/session', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = createCheckoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const pack = COIN_PACKS[parsed.data.packId];
  const checkout = await createCheckoutSession({
    userId: req.auth.userId,
    familyId: req.auth.familyId,
    packId: parsed.data.packId,
    amountCoins: pack.amountCoins,
    amountIls: pack.amountIls,
  });

  return res.status(201).json(checkout);
});

paymentRouter.post('/webhooks/demo-provider', async (req, res) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const payload = parsed.data;
  const signature = req.header('x-smarthome-signature') || undefined;

  if (!verifyWebhookSignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const processed = await processCheckoutWebhook({
    providerEventId: payload.providerEventId,
    checkoutSessionId: payload.checkoutSessionId,
    status: payload.status,
    providerReference: payload.providerReference,
    payload,
  });

  return res.json(processed);
});

paymentRouter.post('/webhooks/demo-provider/sign', async (req, res) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  return res.json({
    signature: signWebhookPayload(parsed.data),
  });
});
