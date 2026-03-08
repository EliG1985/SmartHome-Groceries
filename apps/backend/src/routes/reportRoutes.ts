import { Router } from 'express';
import { listInventory, updateCategory } from '../repository/inventoryRepository.js';

export const reportRouter = Router();

type SupermarketInsightItem = {
  id: string;
  product_name: string;
  category: string;
  originalCategory: string;
  quantity: number;
  currentUnitPrice: number;
  currentTotalPrice: number;
  liveUnitPrice: number;
  liveTotalPrice: number;
  deltaTotal: number;
  inStock: boolean;
  source: string;
  updatedAt: string;
};

type NearbyChain = {
  chain: string;
  nearestDistanceKm: number;
  nearestBranch: string;
};

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: { name?: string };
};

type GeoapifyPlacesResponse = {
  features?: Array<{
    properties?: {
      name?: string;
      lat?: number;
      lon?: number;
    };
  }>;
};

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const OVERPASS_TIMEOUT_MS = 9000;
const GEOAPIFY_TIMEOUT_MS = 7000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferSupermarketChain(storeName: string): string {
  const normalized = storeName.toLowerCase();
  if (normalized.includes('שופרסל') || normalized.includes('shufersal')) return 'Shufersal';
  if (normalized.includes('רמי לוי') || normalized.includes('rami levy')) return 'Rami Levy';
  if (normalized.includes('יוחננוף') || normalized.includes('yochananof') || normalized.includes('yochananoff'))
    return 'Yochananof';
  if (normalized.includes('ויקטורי') || normalized.includes('victory')) return 'Victory';
  if (normalized.includes('קרפור') || normalized.includes('carrefour')) return 'Carrefour';
  return storeName.trim() || 'Supermarket';
}

function toNearestByChain(entries: Array<{ chain: string; name: string; distanceKm: number }>): NearbyChain[] {
  const nearestByChain = new Map<string, NearbyChain>();

  for (const entry of entries) {
    const existing = nearestByChain.get(entry.chain);
    if (!existing || entry.distanceKm < existing.nearestDistanceKm) {
      nearestByChain.set(entry.chain, {
        chain: entry.chain,
        nearestDistanceKm: entry.distanceKm,
        nearestBranch: entry.name,
      });
    }
  }

  return [...nearestByChain.values()].sort((a, b) => a.nearestDistanceKm - b.nearestDistanceKm);
}

async function fetchNearbySupermarketsFromOverpass(params: {
  latitude: number;
  longitude: number;
  radiusKm: number;
}): Promise<NearbyChain[] | null> {
  const radiusMeters = Math.max(5, Math.round(params.radiusKm * 1000));
  const query = `[out:json][timeout:20];(node["shop"="supermarket"](around:${radiusMeters},${params.latitude},${params.longitude});way["shop"="supermarket"](around:${radiusMeters},${params.latitude},${params.longitude});relation["shop"="supermarket"](around:${radiusMeters},${params.latitude},${params.longitude});node["shop"="convenience"](around:${radiusMeters},${params.latitude},${params.longitude});way["shop"="convenience"](around:${radiusMeters},${params.latitude},${params.longitude});relation["shop"="convenience"](around:${radiusMeters},${params.latitude},${params.longitude}););out center tags 120;`;

  let payload: { elements?: OverpassElement[] } | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          Accept: 'application/json',
        },
        body: query,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) continue;

      payload = (await response.json()) as { elements?: OverpassElement[] };
      break;
    } catch {
      continue;
    }
  }

  if (!payload) return null;

  const entries = (payload.elements ?? [])
    .map((element) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      const rawName = element.tags?.name?.trim() || 'Supermarket';
      if (typeof lat !== 'number' || typeof lon !== 'number') return null;

      const distanceKm = calculateDistanceKm(params.latitude, params.longitude, lat, lon);
      if (!Number.isFinite(distanceKm) || distanceKm > params.radiusKm) return null;

      return {
        chain: inferSupermarketChain(rawName),
        name: rawName,
        distanceKm,
      };
    })
    .filter((entry): entry is { chain: string; name: string; distanceKm: number } => Boolean(entry));

  return toNearestByChain(entries);
}

async function fetchNearbySupermarketsFromGeoapify(params: {
  latitude: number;
  longitude: number;
  radiusKm: number;
}): Promise<NearbyChain[] | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEOAPIFY_TIMEOUT_MS);

    const url = new URL('https://api.geoapify.com/v2/places');
    url.searchParams.set('categories', 'commercial.supermarket,commercial.grocery,commercial.convenience');
    url.searchParams.set('filter', `circle:${params.longitude},${params.latitude},${Math.max(5, Math.round(params.radiusKm * 1000))}`);
    url.searchParams.set('bias', `proximity:${params.longitude},${params.latitude}`);
    url.searchParams.set('limit', '60');
    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const payload = (await response.json()) as GeoapifyPlacesResponse;

    const entries = (payload.features ?? [])
      .map((feature) => {
        const rawName = feature.properties?.name?.trim() || 'Supermarket';
        const lat = feature.properties?.lat;
        const lon = feature.properties?.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number') return null;

        const distanceKm = calculateDistanceKm(params.latitude, params.longitude, lat, lon);
        if (!Number.isFinite(distanceKm) || distanceKm > params.radiusKm) return null;

        return {
          chain: inferSupermarketChain(rawName),
          name: rawName,
          distanceKm,
        };
      })
      .filter((entry): entry is { chain: string; name: string; distanceKm: number } => Boolean(entry));

    if (!entries.length) return null;
    return toNearestByChain(entries);
  } catch {
    return null;
  }
}

function inferRelevantCategory(productName: string, fallbackCategory: string): string {
  const name = productName.toLowerCase();

  const rules: Array<{ category: string; keywords: string[] }> = [
    { category: 'Dairy & Eggs', keywords: ['milk', 'cheese', 'yogurt', 'butter', 'egg'] },
    { category: 'Produce', keywords: ['apple', 'banana', 'tomato', 'cucumber', 'lettuce', 'onion', 'potato', 'avocado'] },
    { category: 'Bakery', keywords: ['bread', 'baguette', 'bun', 'pita', 'croissant'] },
    { category: 'Meat & Fish', keywords: ['chicken', 'beef', 'turkey', 'salmon', 'tuna', 'fish'] },
    { category: 'Frozen', keywords: ['frozen', 'ice cream'] },
    { category: 'Beverages', keywords: ['juice', 'water', 'cola', 'coffee', 'tea', 'soda'] },
    { category: 'Pantry', keywords: ['rice', 'pasta', 'flour', 'sugar', 'oil', 'salt', 'spice', 'sauce', 'ketchup'] },
    { category: 'Snacks', keywords: ['chips', 'snack', 'chocolate', 'cookie', 'biscuits', 'nuts'] },
    { category: 'Household', keywords: ['detergent', 'soap', 'toilet', 'paper', 'cleaner', 'sponge'] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => name.includes(keyword))) {
      return rule.category;
    }
  }

  return fallbackCategory || 'General';
}

type ExternalPricingResponse = {
  price?: number;
  inStock?: boolean;
  source?: string;
  updatedAt?: string;
};

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function supermarketFactor(supermarket: string): number {
  const normalized = supermarket.trim().toLowerCase();
  if (normalized.includes('rami')) return 0.96;
  if (normalized.includes('yochan')) return 0.97;
  if (normalized.includes('victory')) return 0.98;
  if (normalized.includes('carrefour')) return 1.02;
  if (normalized.includes('shufersal')) return 1.03;
  return 1;
}

async function tryFetchExternalUnitPrice(
  supermarket: string,
  productName: string,
  barcode?: string,
): Promise<{ liveUnitPrice: number | null; inStock: boolean; source: string; updatedAt: string; liveDataConnected: boolean }> {
  const baseUrl = process.env.SUPERMARKET_PRICING_API_URL;
  if (!baseUrl) {
    return {
      liveUnitPrice: null,
      inStock: true,
      source: 'Internal baseline (no external live feed configured)',
      updatedAt: new Date().toISOString(),
      liveDataConnected: false,
    };
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('supermarket', supermarket);
    url.searchParams.set('productName', productName);
    if (barcode) url.searchParams.set('barcode', barcode);

    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      return {
        liveUnitPrice: null,
        inStock: true,
        source: 'Pricing API unavailable, using internal baseline',
        updatedAt: new Date().toISOString(),
        liveDataConnected: false,
      };
    }

    const payload = (await response.json()) as ExternalPricingResponse;
    const price = typeof payload.price === 'number' && Number.isFinite(payload.price) ? payload.price : null;

    return {
      liveUnitPrice: price,
      inStock: payload.inStock ?? true,
      source: payload.source || 'External pricing feed',
      updatedAt: payload.updatedAt || new Date().toISOString(),
      liveDataConnected: price !== null,
    };
  } catch {
    return {
      liveUnitPrice: null,
      inStock: true,
      source: 'Pricing API error, using internal baseline',
      updatedAt: new Date().toISOString(),
      liveDataConnected: false,
    };
  }
}

function buildAiInsights(supermarket: string, items: SupermarketInsightItem[], basketDelta: number): string[] {
  const insights: string[] = [];

  if (!items.length) {
    return ['Your shopping list is empty, so no price comparison is available yet.'];
  }

  if (basketDelta < 0) {
    insights.push(`You are saving ₪${Math.abs(basketDelta).toFixed(2)} at ${supermarket} compared to your current basket prices.`);
  } else if (basketDelta > 0) {
    insights.push(`This basket is ₪${basketDelta.toFixed(2)} more expensive at ${supermarket} than your current basket prices.`);
  } else {
    insights.push(`Your basket total is currently identical to ${supermarket} pricing.`);
  }

  const sortedByDelta = [...items].sort((a, b) => b.deltaTotal - a.deltaTotal);
  const highestIncrease = sortedByDelta[0];
  const bestSaving = [...items].sort((a, b) => a.deltaTotal - b.deltaTotal)[0];

  if (highestIncrease && highestIncrease.deltaTotal > 0) {
    insights.push(
      `Highest increase: ${highestIncrease.product_name} (+₪${highestIncrease.deltaTotal.toFixed(2)}). Consider checking alternatives.`,
    );
  }

  if (bestSaving && bestSaving.deltaTotal < 0) {
    insights.push(`Best saving: ${bestSaving.product_name} (₪${Math.abs(bestSaving.deltaTotal).toFixed(2)} cheaper).`);
  }

  const outOfStock = items.filter((item) => !item.inStock);
  if (outOfStock.length) {
    insights.push(`Out of stock warning: ${outOfStock.map((item) => item.product_name).join(', ')}.`);
  }

  const recategorized = items.filter((item) => item.originalCategory !== item.category);
  if (recategorized.length) {
    insights.push(`AI recategorized ${recategorized.length} item(s) to more relevant shopping categories.`);
  }

  return insights;
}

reportRouter.get('/summary', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const data = await listInventory(req.auth.familyId);
  const byCategory = data.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.price * item.quantity;
    return acc;
  }, {});

  const total = data.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return res.json({ total, byCategory });
});

reportRouter.get('/supermarket-insights', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const supermarket = String(req.query.supermarket || '').trim();
  if (!supermarket) {
    return res.status(400).json({ error: 'Missing supermarket query parameter' });
  }

  const data = await listInventory(req.auth.familyId);
  const shoppingListItems = data.filter((item) => item.status === 'In_List');

  let liveDataConnected = false;
  const comparedItems: SupermarketInsightItem[] = [];

  for (const item of shoppingListItems) {
    const external = await tryFetchExternalUnitPrice(supermarket, item.product_name, item.barcode);
    liveDataConnected = liveDataConnected || external.liveDataConnected;

    const currentUnitPrice = item.price;
    const currentTotalPrice = currentUnitPrice * item.quantity;

    const fallbackFactor = supermarketFactor(supermarket);
    const pseudoVariation = ((hashString(`${supermarket}:${item.product_name}:${item.id}`) % 9) - 4) / 100;
    const baselineUnitPrice = Number((currentUnitPrice * fallbackFactor * (1 + pseudoVariation)).toFixed(2));
    const liveUnitPrice = external.liveUnitPrice ?? baselineUnitPrice;
    const liveTotalPrice = Number((liveUnitPrice * item.quantity).toFixed(2));
    const deltaTotal = Number((liveTotalPrice - currentTotalPrice).toFixed(2));
    const inferredCategory = inferRelevantCategory(item.product_name, item.category);

    comparedItems.push({
      id: item.id,
      product_name: item.product_name,
      category: inferredCategory,
      originalCategory: item.category,
      quantity: item.quantity,
      currentUnitPrice,
      currentTotalPrice: Number(currentTotalPrice.toFixed(2)),
      liveUnitPrice,
      liveTotalPrice,
      deltaTotal,
      inStock: external.inStock,
      source: external.source,
      updatedAt: external.updatedAt,
    });
  }

  const currentBasketTotal = Number(comparedItems.reduce((sum, item) => sum + item.currentTotalPrice, 0).toFixed(2));
  const liveBasketTotal = Number(comparedItems.reduce((sum, item) => sum + item.liveTotalPrice, 0).toFixed(2));
  const basketDelta = Number((liveBasketTotal - currentBasketTotal).toFixed(2));

  return res.json({
    supermarket,
    generatedAt: new Date().toISOString(),
    liveDataConnected,
    items: comparedItems,
    totals: {
      currentBasketTotal,
      liveBasketTotal,
      basketDelta,
    },
    insights: buildAiInsights(supermarket, comparedItems, basketDelta),
  });
});

reportRouter.post('/supermarket-insights/apply-categories', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const supermarket = String(req.body?.supermarket || 'Selected supermarket').trim();
  const data = await listInventory(req.auth.familyId);
  const shoppingListItems = data.filter((item) => item.status === 'In_List');

  const updates: Array<{ id: string; product_name: string; from: string; to: string }> = [];

  for (const item of shoppingListItems) {
    const inferredCategory = inferRelevantCategory(item.product_name, item.category);
    if (inferredCategory !== item.category) {
      await updateCategory(item.id, req.auth.familyId, inferredCategory);
      updates.push({
        id: item.id,
        product_name: item.product_name,
        from: item.category,
        to: inferredCategory,
      });
    }
  }

  return res.json({
    supermarket,
    updatedCount: updates.length,
    updatedItems: updates,
    message:
      updates.length > 0
        ? `Applied ${updates.length} AI category update(s) for ${supermarket}.`
        : `No category updates were needed for ${supermarket}.`,
  });
});

reportRouter.get('/product-price', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const supermarket = String(req.query.supermarket || '').trim();
  const productName = String(req.query.productName || '').trim();
  const barcode = req.query.barcode ? String(req.query.barcode) : undefined;
  const fallbackPrice = Number(req.query.fallbackPrice || '0');

  if (!supermarket || !productName) {
    return res.status(400).json({ error: 'supermarket and productName are required' });
  }

  const external = await tryFetchExternalUnitPrice(supermarket, productName, barcode);
  const factor = supermarketFactor(supermarket);
  const stableSeed = hashString(`${supermarket}:${productName}:${barcode || 'no-barcode'}`);
  const syntheticBase = fallbackPrice > 0 ? fallbackPrice : 8 + (stableSeed % 300) / 20;
  const variation = ((stableSeed % 9) - 4) / 100;
  const baselinePrice = Number((syntheticBase * factor * (1 + variation)).toFixed(2));
  const liveUnitPrice = external.liveUnitPrice ?? baselinePrice;

  return res.json({
    supermarket,
    productName,
    barcode,
    liveUnitPrice,
    source: external.source,
    updatedAt: external.updatedAt,
    liveDataConnected: external.liveDataConnected,
  });
});

reportRouter.get('/nearby-supermarkets', async (req, res) => {
  const latitude = Number(req.query.latitude || '');
  const longitude = Number(req.query.longitude || '');
  const radiusKm = Number(req.query.radiusKm || '');

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radiusKm)) {
    return res.status(400).json({ error: 'latitude, longitude and radiusKm are required numeric query params' });
  }

  const boundedRadiusKm = Math.min(10, Math.max(0.005, radiusKm));
  const chainsFromGeoapify = await fetchNearbySupermarketsFromGeoapify({
    latitude,
    longitude,
    radiusKm: boundedRadiusKm,
  });

  const chains =
    chainsFromGeoapify ??
    (await fetchNearbySupermarketsFromOverpass({
      latitude,
      longitude,
      radiusKm: boundedRadiusKm,
    }));

  if (!chains) {
    return res.status(503).json({ error: 'Nearby supermarket providers are temporarily unavailable' });
  }

  return res.json({ chains, radiusKm: boundedRadiusKm });
});
