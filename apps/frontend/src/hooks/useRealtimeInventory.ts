import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';
import { addItem, updateItem, removeItem } from '../store/slices/inventorySlice';
import type { InventoryItem } from '../types/domain';

export function useRealtimeInventory(enabled = true) {
  const dispatch = useDispatch();
  const familyId = useSelector((state: RootState) => state.auth.user?.familyId);

  useEffect(() => {
    if (!enabled || !supabase || !familyId) return;
    const client = supabase;

    const channel = client
      .channel('inventory-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory', filter: `family_id=eq.${familyId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') dispatch(addItem(payload.new as InventoryItem));
          if (payload.eventType === 'UPDATE') dispatch(updateItem(payload.new as InventoryItem));
          if (payload.eventType === 'DELETE') dispatch(removeItem((payload.old as InventoryItem).id));
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [dispatch, enabled, familyId]);
}
