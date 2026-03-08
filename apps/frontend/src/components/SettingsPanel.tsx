import { useMemo, useState } from 'react';
import {
  applyAiCategories,
  backendMode,
  getNearbySupermarkets,
  getSupermarketInsights,
  type SupermarketInsightsResponse,
} from '../lib/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { isSupabaseConfigured } from '../lib/supabase';
import { useLanguage } from '../lib/i18n';

interface SettingsPanelProps {
  onLogout: () => void;
  supermarket: string;
  onSupermarketChange: (value: string) => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  hasMonthlyPackage: boolean;
  userEmail: string;
  userRole: 'owner' | 'editor' | 'viewer';
  userFamilyId: string;
  coinsBalance: number;
  purchasedPackages: string[];
}

const supermarketOptions = ['Shufersal', 'Rami Levy', 'Yochananof', 'Victory', 'Carrefour', 'Other'];

type SupermarketBranch = {
  chain: string;
  name: string;
  lat: number;
  lon: number;
};

type NearbyChain = {
  chain: string;
  nearestDistanceKm: number;
  nearestBranch: string;
};

const knownBranches: SupermarketBranch[] = [
  { chain: 'Shufersal', name: 'Shufersal Tel Aviv', lat: 32.0853, lon: 34.7818 },
  { chain: 'Rami Levy', name: 'Rami Levy Tel Aviv', lat: 32.0737, lon: 34.7923 },
  { chain: 'Yochananof', name: 'Yochananof Rishon LeZion', lat: 31.971, lon: 34.7925 },
  { chain: 'Victory', name: 'Victory Holon', lat: 32.0158, lon: 34.7874 },
  { chain: 'Carrefour', name: 'Carrefour Herzliya', lat: 32.1663, lon: 34.8432 },
  { chain: 'Shufersal', name: 'Shufersal Jerusalem', lat: 31.7683, lon: 35.2137 },
  { chain: 'Rami Levy', name: 'Rami Levy Jerusalem', lat: 31.7857, lon: 35.2007 },
  { chain: 'Victory', name: 'Victory Haifa', lat: 32.794, lon: 34.9896 },
  { chain: 'Carrefour', name: 'Carrefour Haifa', lat: 32.8156, lon: 34.998 },
];

const MIN_RADIUS_KM = 0.005;
const MAX_RADIUS_KM = 10;

function formatDistanceLabel(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

function toNearestByChain(entries: Array<{ branch: SupermarketBranch; distanceKm: number }>): NearbyChain[] {
  const nearestByChain = new Map<string, NearbyChain>();

  for (const entry of entries) {
    const existing = nearestByChain.get(entry.branch.chain);
    if (!existing || entry.distanceKm < existing.nearestDistanceKm) {
      nearestByChain.set(entry.branch.chain, {
        chain: entry.branch.chain,
        nearestDistanceKm: entry.distanceKm,
        nearestBranch: entry.branch.name,
      });
    }
  }

  return [...nearestByChain.values()].sort((a, b) => a.nearestDistanceKm - b.nearestDistanceKm).slice(0, 5);
}

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

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function supermarketFactor(supermarketName: string): number {
  const normalized = supermarketName.toLowerCase();
  if (normalized.includes('rami')) return 0.96;
  if (normalized.includes('yochan')) return 0.97;
  if (normalized.includes('victory')) return 0.98;
  if (normalized.includes('carrefour')) return 1.02;
  if (normalized.includes('shufersal')) return 1.03;
  return 1;
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
    if (rule.keywords.some((keyword) => name.includes(keyword))) return rule.category;
  }

  return fallbackCategory || 'General';
}

export function SettingsPanel({
  onLogout,
  supermarket,
  onSupermarketChange,
  theme,
  onThemeChange,
  hasMonthlyPackage,
  userEmail,
  userRole,
  userFamilyId,
  coinsBalance,
  purchasedPackages,
}: SettingsPanelProps) {
  const { t } = useLanguage();
  const allItems = useSelector((state: RootState) => state.inventory.items);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(() => {
    const saved = Number(localStorage.getItem('nearbySearchRadiusKm') || String(MAX_RADIUS_KM));
    if (!Number.isFinite(saved)) return MAX_RADIUS_KM;
    return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, saved));
  });
  const [nearbyChains, setNearbyChains] = useState<Array<{ chain: string; nearestDistanceKm: number; nearestBranch: string }>>([]);
  const [insightsData, setInsightsData] = useState<SupermarketInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const radioOptions = useMemo(() => {
    if (nearbyChains.length) {
      return nearbyChains.map((item) => ({
        value: item.chain,
        label: `${item.chain} (${formatDistanceLabel(item.nearestDistanceKm)})`,
        hint: item.nearestBranch,
      }));
    }

    return supermarketOptions.map((option) => ({ value: option, label: option, hint: null }));
  }, [nearbyChains]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus(t('settings.geoNotSupported'));
      return;
    }

    setGeoStatus(t('settings.geoGetting'));
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let sorted: NearbyChain[] = [];

        try {
          const backendNearby = await getNearbySupermarkets({
            latitude,
            longitude,
            radiusKm: searchRadiusKm,
          });
          sorted = backendNearby.chains;
        } catch {
          sorted = [];
        }

        if (!sorted.length) {
          const branchesWithDistance = knownBranches.map((branch) => ({
            branch,
            distanceKm: calculateDistanceKm(latitude, longitude, branch.lat, branch.lon),
          }));
          const inRange = branchesWithDistance.filter((entry) => entry.distanceKm <= searchRadiusKm);
          sorted = toNearestByChain(inRange);
        }

        setNearbyChains(sorted);
        if (sorted.length) {
          onSupermarketChange(sorted[0].chain);
          setGeoStatus(`${t('settings.geoLoaded')} (≤ ${formatDistanceLabel(searchRadiusKm)})`);
          return;
        }

        setGeoStatus(`${t('settings.geoNone')} (≤ ${formatDistanceLabel(searchRadiusKm)})`);
      },
      () => {
        setGeoStatus(t('settings.geoDenied'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleSearchRadiusChange = (value: number) => {
    const clamped = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, value));
    setSearchRadiusKm(clamped);
    localStorage.setItem('nearbySearchRadiusKm', String(clamped));
  };

  const handleLoadInsights = async () => {
    if (!backendMode) {
      setInsightsLoading(true);
      setInsightsError(null);

      try {
        const listItems = allItems.filter((item) => item.status === 'In_List');
        const factor = supermarketFactor(supermarket);

        const generatedItems = listItems.map((item) => {
          const currentUnitPrice = item.price;
          const currentTotalPrice = Number((item.price * item.quantity).toFixed(2));
          const pseudoVariation = ((hashString(`${supermarket}:${item.product_name}:${item.id}`) % 9) - 4) / 100;
          const liveUnitPrice = Number((currentUnitPrice * factor * (1 + pseudoVariation)).toFixed(2));
          const liveTotalPrice = Number((liveUnitPrice * item.quantity).toFixed(2));
          const deltaTotal = Number((liveTotalPrice - currentTotalPrice).toFixed(2));

          return {
            id: item.id,
            product_name: item.product_name,
            category: inferRelevantCategory(item.product_name, item.category),
            originalCategory: item.category,
            quantity: item.quantity,
            currentUnitPrice,
            currentTotalPrice,
            liveUnitPrice,
            liveTotalPrice,
            deltaTotal,
            inStock: true,
            source: t('settings.localSource'),
            updatedAt: new Date().toISOString(),
          };
        });

        const currentBasketTotal = Number(generatedItems.reduce((sum, item) => sum + item.currentTotalPrice, 0).toFixed(2));
        const liveBasketTotal = Number(generatedItems.reduce((sum, item) => sum + item.liveTotalPrice, 0).toFixed(2));
        const basketDelta = Number((liveBasketTotal - currentBasketTotal).toFixed(2));

        const localInsights: string[] = [];
        if (!generatedItems.length) {
          localInsights.push(t('settings.localInsightsEmpty'));
        } else if (basketDelta < 0) {
          localInsights.push(t('settings.localSavings', { supermarket, amount: Math.abs(basketDelta).toFixed(2) }));
        } else if (basketDelta > 0) {
          localInsights.push(t('settings.localIncrease', { supermarket, amount: basketDelta.toFixed(2) }));
        } else {
          localInsights.push(t('settings.localSimilar', { supermarket }));
        }

        const recategorizedCount = generatedItems.filter((item) => item.originalCategory !== item.category).length;
        if (recategorizedCount > 0) {
          localInsights.push(t('settings.localRecategorized', { count: recategorizedCount }));
        }

        setInsightsData({
          supermarket,
          generatedAt: new Date().toISOString(),
          liveDataConnected: false,
          items: generatedItems,
          totals: {
            currentBasketTotal,
            liveBasketTotal,
            basketDelta,
          },
          insights: localInsights,
        });
        setApplyMessage(null);
      } catch (error) {
        setInsightsError(error instanceof Error ? error.message : 'Failed to build local supermarket insights');
      } finally {
        setInsightsLoading(false);
      }

      return;
    }

    try {
      setInsightsLoading(true);
      setInsightsError(null);
      const response = await getSupermarketInsights(supermarket);
      setInsightsData(response);
      setApplyMessage(null);
    } catch (error) {
      setInsightsError(error instanceof Error ? error.message : 'Failed to load supermarket insights');
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleApplyAiCategories = async () => {
    if (!backendMode || !insightsData) return;

    try {
      setApplyLoading(true);
      setApplyMessage(null);
      const response = await applyAiCategories(supermarket);
      setApplyMessage(response.message);
      const refreshed = await getSupermarketInsights(supermarket);
      setInsightsData(refreshed);
    } catch (error) {
      setApplyMessage(error instanceof Error ? error.message : 'Failed to apply AI categories');
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t('settings.title')}</h2>
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-700">
        {t('settings.backend')}: <span className="font-medium">{isSupabaseConfigured ? t('settings.supabaseLive') : t('settings.localMode')}</span>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <p className="text-sm font-medium text-slate-800">{t('settings.theme')}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              theme === 'light'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            onClick={() => onThemeChange('light')}
          >
            {t('settings.lightMode')}
          </button>
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              theme === 'dark'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            onClick={() => onThemeChange('dark')}
          >
            {t('settings.darkMode')}
          </button>
        </div>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <p className="text-sm font-medium text-slate-800">{t('settings.preferredSupermarket')}</p>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700">{t('settings.searchRadius')}</p>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {formatDistanceLabel(searchRadiusKm)}
            </span>
          </div>
          <input
            type="range"
            min={MIN_RADIUS_KM}
            max={MAX_RADIUS_KM}
            step={0.005}
            value={searchRadiusKm}
            onChange={(event) => handleSearchRadiusChange(Number(event.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>{formatDistanceLabel(MIN_RADIUS_KM)}</span>
            <span>{formatDistanceLabel(MAX_RADIUS_KM)}</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          onClick={handleUseLocation}
        >
          {t('settings.useLocation')}
        </button>
        {geoStatus && <p className="text-xs text-slate-600">{geoStatus}</p>}

        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
          {radioOptions.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
              <input
                type="radio"
                name="preferred-supermarket"
                value={option.value}
                checked={supermarket === option.value}
                onChange={(event) => onSupermarketChange(event.target.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{option.label}</span>
                {option.hint && <span className="block text-xs text-slate-500">{t('settings.nearestBranch', { branch: option.hint })}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-indigo-900">
        <p className="font-medium">{t('settings.aiAssistant')}</p>
        <p>{t('settings.aiDescription')}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
            onClick={() => void handleLoadInsights()}
            disabled={insightsLoading}
          >
            {insightsLoading ? t('settings.loadingInsights') : t('settings.getLiveUpdates')}
          </button>
          {insightsData && (
            <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-indigo-700">
              {t('settings.updatedAt', { time: new Date(insightsData.generatedAt).toLocaleTimeString() })}
            </span>
          )}
        </div>
        {insightsError && <p className="text-xs text-rose-700">{insightsError}</p>}
        {applyMessage && <p className="text-xs text-indigo-800">{applyMessage}</p>}

        {insightsData && (
          <div className="space-y-3 rounded-xl border border-indigo-100 bg-white p-3 text-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{t('settings.basketUpdate', { supermarket: insightsData.supermarket })}</span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  insightsData.liveDataConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {insightsData.liveDataConnected ? t('settings.liveFeedConnected') : t('settings.baselineEstimates')}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs text-slate-500">{t('settings.currentBasket')}</p>
                <p className="text-sm font-semibold">₪{insightsData.totals.currentBasketTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs text-slate-500">{t('settings.selectedSupermarket')}</p>
                <p className="text-sm font-semibold">₪{insightsData.totals.liveBasketTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs text-slate-500">{t('settings.delta')}</p>
                <p className={`text-sm font-semibold ${insightsData.totals.basketDelta <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {insightsData.totals.basketDelta <= 0 ? '-' : '+'}₪{Math.abs(insightsData.totals.basketDelta).toFixed(2)}
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {insightsData.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{item.product_name}</p>
                    <span className={`text-xs font-semibold ${item.deltaTotal <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {item.deltaTotal <= 0 ? '-' : '+'}₪{Math.abs(item.deltaTotal).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {t('common.category')}: <span className="font-medium text-slate-700">{item.category}</span>
                    {item.originalCategory !== item.category && (
                      <span className="ml-1 text-indigo-700">{t('settings.updatedFrom', { category: item.originalCategory })}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">
                    {t('common.quantity')} {item.quantity} · {t('settings.currentBasket')} ₪{item.currentTotalPrice.toFixed(2)} · {t('settings.selectedSupermarket')} ₪{item.liveTotalPrice.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {item.source} · {item.inStock ? t('settings.inStock') : t('settings.outOfStock')}
                  </p>
                </li>
              ))}
            </ul>

            <div className="space-y-1 rounded-lg border border-indigo-100 bg-indigo-50 p-2">
              <p className="text-xs font-semibold text-indigo-800">{t('settings.aiInsights')}</p>
              {insightsData.insights.map((insight) => (
                <p key={insight} className="text-xs text-indigo-900">
                  • {insight}
                </p>
              ))}
            </div>

            {insightsData.items.some((item) => item.originalCategory !== item.category) && (
              <button
                type="button"
                className="rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                onClick={() => void handleApplyAiCategories()}
                disabled={applyLoading}
              >
                {applyLoading ? t('settings.applyingAiCategories') : t('settings.applyAiCategories')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <p className="text-sm font-medium text-slate-800">{t('settings.account.title')}</p>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p>
            <span className="font-semibold text-slate-800">{t('settings.account.email')}:</span> {userEmail}
          </p>
          <p>
            <span className="font-semibold text-slate-800">{t('settings.account.role')}:</span> {userRole}
          </p>
          <p>
            <span className="font-semibold text-slate-800">{t('settings.account.familyId')}:</span> {userFamilyId}
          </p>
          <p>
            <span className="font-semibold text-slate-800">{t('settings.account.coins')}:</span> {coinsBalance}
          </p>
          <p>
            <span className="font-semibold text-slate-800">{t('settings.account.package')}:</span>{' '}
            {hasMonthlyPackage && purchasedPackages.length ?
              `${purchasedPackages[0]} (${hasMonthlyPackage ? 'פעיל' : 'לא פעיל'})` : t('settings.account.packageInactive')}
          </p>
          <p>
            <span className="font-semibold text-slate-800">מחיר מנוי:</span>{' '}
            {hasMonthlyPackage && purchasedPackages.length ?
              (() => {
                if (purchasedPackages[0] === 'Monthly') return '80 ש"ח לחודש';
                if (purchasedPackages[0] === 'SemiAnnual') return '60 ש"ח לחודש';
                if (purchasedPackages[0] === 'Annual') return '40 ש"ח לחודש';
                return '';
              })() : '-'}
          </p>
        </div>
      </div>

      <button
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        onClick={onLogout}
      >
        {t('settings.logout')}
      </button>
    </section>
  );
}
