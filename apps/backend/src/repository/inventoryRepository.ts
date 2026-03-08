import type { InventoryRecord } from '../types.js';
import { supabaseAdmin } from '../db.js';

const memoryStore = new Map<string, InventoryRecord[]>();

export async function listInventory(familyId: string): Promise<InventoryRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as InventoryRecord[];
  }

  return memoryStore.get(familyId) ?? [];
}

export async function createInventory(item: Omit<InventoryRecord, 'id' | 'created_at'>): Promise<InventoryRecord> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from('inventory').insert(item).select('*').single();
    if (error) throw new Error(error.message);
    return data as InventoryRecord;
  }

  const record: InventoryRecord = {
    ...item,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  const current = memoryStore.get(item.family_id) ?? [];
  memoryStore.set(item.family_id, [record, ...current]);
  return record;
}

export async function updateStatus(id: string, familyId: string, status: InventoryRecord['status']): Promise<void> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('inventory')
      .update({ status, purchased_at: status === 'At_Home' ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('family_id', familyId);
    if (error) throw new Error(error.message);
    return;
  }

  const records = memoryStore.get(familyId) ?? [];
  const index = records.findIndex((item) => item.id === id);
  if (index >= 0) {
    records[index] = {
      ...records[index],
      status,
      purchased_at: status === 'At_Home' ? new Date().toISOString() : null,
    };
    memoryStore.set(familyId, records);
  }
}

export async function updateCategory(id: string, familyId: string, category: string): Promise<void> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('inventory').update({ category }).eq('id', id).eq('family_id', familyId);
    if (error) throw new Error(error.message);
    return;
  }

  const records = memoryStore.get(familyId) ?? [];
  const index = records.findIndex((item) => item.id === id);
  if (index >= 0) {
    records[index] = {
      ...records[index],
      category,
    };
    memoryStore.set(familyId, records);
  }
}

export async function updateInventoryDetails(
  id: string,
  familyId: string,
  payload: Pick<InventoryRecord, 'product_name' | 'category' | 'barcode' | 'image_url' | 'expiry_date' | 'price' | 'quantity'>,
): Promise<InventoryRecord> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .update(payload)
      .eq('id', id)
      .eq('family_id', familyId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as InventoryRecord;
  }

  const records = memoryStore.get(familyId) ?? [];
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Inventory item not found');

  const updated: InventoryRecord = {
    ...records[index],
    ...payload,
  };
  records[index] = updated;
  memoryStore.set(familyId, records);
  return updated;
}

export async function deleteInventory(id: string, familyId: string): Promise<void> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('inventory').delete().eq('id', id).eq('family_id', familyId);
    if (error) throw new Error(error.message);
    return;
  }

  const records = memoryStore.get(familyId) ?? [];
  const filtered = records.filter((item) => item.id !== id);
  if (filtered.length !== records.length) {
    memoryStore.set(familyId, filtered);
  }
}
