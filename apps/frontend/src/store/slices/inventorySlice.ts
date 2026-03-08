import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { startOfDay, differenceInHours, isBefore } from 'date-fns';
import type { InventoryItem } from '../../types/domain';

interface InventoryState {
  items: InventoryItem[];
}

const initialState: InventoryState = {
  items: [],
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setItems(state, action: PayloadAction<InventoryItem[]>) {
      state.items = action.payload;
    },
    addItem(state, action: PayloadAction<InventoryItem>) {
      state.items.unshift(action.payload);
    },
    updateItem(state, action: PayloadAction<InventoryItem>) {
      const index = state.items.findIndex((item) => item.id === action.payload.id);
      if (index >= 0) state.items[index] = action.payload;
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    moveItemStatus(state, action: PayloadAction<{ id: string; status: InventoryItem['status'] }>) {
      const item = state.items.find((entry) => entry.id === action.payload.id);
      if (item) item.status = action.payload.status;
    },
  },
});

export function getExpiryTone(expiryDate: string): 'expired' | 'warning' | 'ok' {
  const now = new Date();
  const expiry = startOfDay(new Date(expiryDate));

  if (isBefore(expiry, startOfDay(now))) return 'expired';
  if (differenceInHours(expiry, now) <= 48) return 'warning';
  return 'ok';
}

export const { setItems, addItem, updateItem, removeItem, moveItemStatus } = inventorySlice.actions;
export default inventorySlice.reducer;
