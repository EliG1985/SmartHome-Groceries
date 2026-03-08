import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface StoreState {
  coins: number;
  unlockedItems: string[];
}

const initialState: StoreState = {
  coins: 0,
  unlockedItems: [],
};

const storeSlice = createSlice({
  name: 'store',
  initialState,
  reducers: {
    setCoins(state, action: PayloadAction<number>) {
      state.coins = action.payload;
    },
    unlockItem(state, action: PayloadAction<string>) {
      if (!state.unlockedItems.includes(action.payload)) {
        state.unlockedItems.push(action.payload);
      }
    },
  },
});

export const { setCoins, unlockItem } = storeSlice.actions;
export default storeSlice.reducer;
