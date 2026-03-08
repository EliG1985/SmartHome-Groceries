import type {
  StoreItemCategory,
  StoreSkinId,
  StoreState,
  StoreUnlockRecord,
  StoreUserPreferenceRecord,
  StoreWalletRecord,
  StoreWalletTransactionRecord,
} from '../types.js';
import { supabaseAdmin } from '../db.js';

type InMemoryStoreState = {
  coinsBalance: number;
  unlockedItemIds: string[];
  activeSkin: StoreSkinId;
};

const inMemory = new Map<string, InMemoryStoreState>();

function getMemoryState(userId: string): InMemoryStoreState {
  const current = inMemory.get(userId);
  if (current) return current;

  const created: InMemoryStoreState = {
    coinsBalance: 0,
    unlockedItemIds: [],
    activeSkin: 'default',
  };
  inMemory.set(userId, created);
  return created;
}

async function ensureWallet(userId: string, familyId: string): Promise<StoreWalletRecord> {
  if (!supabaseAdmin) {
    const state = getMemoryState(userId);
    return {
      user_id: userId,
      family_id: familyId,
      balance_coins: state.coinsBalance,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('store_wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!existingError && existing) return existing as StoreWalletRecord;

  const { data: created, error: createError } = await supabaseAdmin
    .from('store_wallets')
    .insert({
      user_id: userId,
      family_id: familyId,
      balance_coins: 0,
    })
    .select('*')
    .single();

  if (createError || !created) throw new Error(createError?.message || 'Failed to initialize store wallet');
  return created as StoreWalletRecord;
}

async function ensurePreferences(userId: string, familyId: string): Promise<StoreUserPreferenceRecord> {
  if (!supabaseAdmin) {
    const state = getMemoryState(userId);
    return {
      user_id: userId,
      family_id: familyId,
      active_skin: state.activeSkin,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('user_store_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!existingError && existing) return existing as StoreUserPreferenceRecord;

  const { data: created, error: createError } = await supabaseAdmin
    .from('user_store_preferences')
    .insert({
      user_id: userId,
      family_id: familyId,
      active_skin: 'default',
    })
    .select('*')
    .single();

  if (createError || !created) throw new Error(createError?.message || 'Failed to initialize store preferences');
  return created as StoreUserPreferenceRecord;
}

export async function getStoreState(params: { userId: string; familyId: string }): Promise<StoreState> {
  if (!supabaseAdmin) {
    const state = getMemoryState(params.userId);
    return {
      coinsBalance: state.coinsBalance,
      unlockedItemIds: state.unlockedItemIds,
      activeSkin: state.activeSkin,
    };
  }

  const [wallet, prefs, unlocksResult] = await Promise.all([
    ensureWallet(params.userId, params.familyId),
    ensurePreferences(params.userId, params.familyId),
    supabaseAdmin.from('store_unlocks').select('*').eq('user_id', params.userId),
  ]);

  if (unlocksResult.error) throw new Error(unlocksResult.error.message);
  const unlockedItemIds = ((unlocksResult.data ?? []) as StoreUnlockRecord[]).map((entry) => entry.item_id);

  return {
    coinsBalance: wallet.balance_coins,
    unlockedItemIds,
    activeSkin: prefs.active_skin,
  };
}

export async function purchaseCoinPack(params: {
  userId: string;
  familyId: string;
  packId: string;
  amountCoins: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<StoreState> {
  if (!supabaseAdmin) {
    const state = getMemoryState(params.userId);
    state.coinsBalance += params.amountCoins;
    return {
      coinsBalance: state.coinsBalance,
      unlockedItemIds: state.unlockedItemIds,
      activeSkin: state.activeSkin,
    };
  }

  const wallet = await ensureWallet(params.userId, params.familyId);
  const nextBalance = wallet.balance_coins + params.amountCoins;

  const { error: walletError } = await supabaseAdmin
    .from('store_wallets')
    .update({ balance_coins: nextBalance, updated_at: new Date().toISOString() })
    .eq('user_id', params.userId)
    .eq('family_id', params.familyId);

  if (walletError) throw new Error(walletError.message);

  const { error: txError } = await supabaseAdmin.from('store_wallet_transactions').insert({
    user_id: params.userId,
    family_id: params.familyId,
    direction: 'credit',
    amount_coins: params.amountCoins,
    reason: params.reason || 'demo_coin_pack_purchase',
    metadata: params.metadata || { packId: params.packId },
  });

  if (txError) throw new Error(txError.message);
  return getStoreState({ userId: params.userId, familyId: params.familyId });
}

export async function unlockStoreItem(params: {
  userId: string;
  familyId: string;
  itemId: string;
  category: StoreItemCategory;
  skinId?: StoreSkinId;
  priceCoins: number;
}): Promise<StoreState> {
  if (!supabaseAdmin) {
    const state = getMemoryState(params.userId);
    if (state.unlockedItemIds.includes(params.itemId)) {
      return {
        coinsBalance: state.coinsBalance,
        unlockedItemIds: state.unlockedItemIds,
        activeSkin: state.activeSkin,
      };
    }
    if (state.coinsBalance < params.priceCoins) {
      throw new Error('Not enough coins to unlock this item.');
    }
    state.coinsBalance -= params.priceCoins;
    state.unlockedItemIds = [...state.unlockedItemIds, params.itemId];
    if (params.category === 'skin' && params.skinId) {
      state.activeSkin = params.skinId;
    }
    return {
      coinsBalance: state.coinsBalance,
      unlockedItemIds: state.unlockedItemIds,
      activeSkin: state.activeSkin,
    };
  }

  const wallet = await ensureWallet(params.userId, params.familyId);

  const { data: existingUnlock, error: existingUnlockError } = await supabaseAdmin
    .from('store_unlocks')
    .select('id')
    .eq('user_id', params.userId)
    .eq('item_id', params.itemId)
    .single();

  if (!existingUnlockError && existingUnlock) {
    return getStoreState({ userId: params.userId, familyId: params.familyId });
  }

  if (wallet.balance_coins < params.priceCoins) {
    throw new Error('Not enough coins to unlock this item.');
  }

  const nextBalance = wallet.balance_coins - params.priceCoins;
  const nowIso = new Date().toISOString();

  const { error: walletError } = await supabaseAdmin
    .from('store_wallets')
    .update({ balance_coins: nextBalance, updated_at: nowIso })
    .eq('user_id', params.userId)
    .eq('family_id', params.familyId);

  if (walletError) throw new Error(walletError.message);

  const { error: txError } = await supabaseAdmin.from('store_wallet_transactions').insert({
    user_id: params.userId,
    family_id: params.familyId,
    direction: 'debit',
    amount_coins: params.priceCoins,
    reason: 'store_unlock',
    metadata: {
      itemId: params.itemId,
      category: params.category,
      skinId: params.skinId ?? null,
    },
  } as StoreWalletTransactionRecord);

  if (txError) throw new Error(txError.message);

  const { error: unlockError } = await supabaseAdmin.from('store_unlocks').insert({
    user_id: params.userId,
    family_id: params.familyId,
    item_id: params.itemId,
    category: params.category,
    skin_id: params.skinId ?? null,
  });

  if (unlockError) throw new Error(unlockError.message);

  if (params.category === 'skin' && params.skinId) {
    await ensurePreferences(params.userId, params.familyId);
    const { error: prefError } = await supabaseAdmin
      .from('user_store_preferences')
      .update({ active_skin: params.skinId, updated_at: nowIso })
      .eq('user_id', params.userId)
      .eq('family_id', params.familyId);

    if (prefError) throw new Error(prefError.message);
  }

  return getStoreState({ userId: params.userId, familyId: params.familyId });
}

export async function applyStoreSkin(params: {
  userId: string;
  familyId: string;
  skinId: StoreSkinId;
}): Promise<StoreState> {
  if (!supabaseAdmin) {
    const state = getMemoryState(params.userId);
    state.activeSkin = params.skinId;
    return {
      coinsBalance: state.coinsBalance,
      unlockedItemIds: state.unlockedItemIds,
      activeSkin: state.activeSkin,
    };
  }

  if (params.skinId !== 'default') {
    const { data: unlockRow, error: unlockError } = await supabaseAdmin
      .from('store_unlocks')
      .select('id')
      .eq('user_id', params.userId)
      .eq('category', 'skin')
      .eq('skin_id', params.skinId)
      .single();

    if (unlockError || !unlockRow) {
      throw new Error('Skin is not unlocked for this user.');
    }
  }

  await ensurePreferences(params.userId, params.familyId);
  const { error } = await supabaseAdmin
    .from('user_store_preferences')
    .update({ active_skin: params.skinId, updated_at: new Date().toISOString() })
    .eq('user_id', params.userId)
    .eq('family_id', params.familyId);

  if (error) throw new Error(error.message);
  return getStoreState({ userId: params.userId, familyId: params.familyId });
}
