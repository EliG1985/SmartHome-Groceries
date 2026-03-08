import { Router } from 'express';
import { z } from 'zod';
import { applyStoreSkin, getStoreState, purchaseCoinPack, unlockStoreItem } from '../repository/storeRepository.js';
import type { StoreItemCategory, StoreSkinId } from '../types.js';

export const storeRouter = Router();

const COIN_PACKS = {
  'pack-small': 200,
  'pack-medium': 500,
  'pack-large': 1200,
} as const;

const STORE_CATALOG: Record<string, { priceCoins: number; category: StoreItemCategory; skinId?: StoreSkinId }> = {
  'skin-ocean': { priceCoins: 220, category: 'skin', skinId: 'ocean' },
  'skin-sunset': { priceCoins: 260, category: 'skin', skinId: 'sunset' },
  'skin-midnight': { priceCoins: 280, category: 'skin', skinId: 'midnight' },
  'feature-ai-assistant': { priceCoins: 700, category: 'feature' },
  'feature-advanced-reports': { priceCoins: 520, category: 'feature' },
  'feature-voice-transcribe': { priceCoins: 420, category: 'feature' },
  'feature-family-plus': { priceCoins: 900, category: 'feature' },
};

const purchasePackSchema = z.object({
  packId: z.enum(['pack-small', 'pack-medium', 'pack-large']),
});

const unlockItemSchema = z.object({
  itemId: z.string().min(1),
});

const applySkinSchema = z.object({
  skinId: z.enum(['default', 'ocean', 'sunset', 'midnight']),
});

storeRouter.get('/state', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const state = await getStoreState({
    userId: req.auth.userId,
    familyId: req.auth.familyId,
  });

  return res.json(state);
});

storeRouter.post('/coins/purchase', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = purchasePackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const amountCoins = COIN_PACKS[parsed.data.packId];
  const state = await purchaseCoinPack({
    userId: req.auth.userId,
    familyId: req.auth.familyId,
    packId: parsed.data.packId,
    amountCoins,
  });

  return res.json(state);
});

storeRouter.post('/unlock', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = unlockItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const catalogEntry = STORE_CATALOG[parsed.data.itemId];
  if (!catalogEntry) {
    return res.status(400).json({ error: 'Unknown store item.' });
  }

  const state = await unlockStoreItem({
    userId: req.auth.userId,
    familyId: req.auth.familyId,
    itemId: parsed.data.itemId,
    category: catalogEntry.category,
    skinId: catalogEntry.skinId,
    priceCoins: catalogEntry.priceCoins,
  });

  return res.json(state);
});

storeRouter.post('/skins/apply', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = applySkinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const state = await applyStoreSkin({
    userId: req.auth.userId,
    familyId: req.auth.familyId,
    skinId: parsed.data.skinId,
  });

  return res.json(state);
});
