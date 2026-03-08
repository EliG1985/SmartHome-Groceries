import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppUser } from '../../types/domain';

interface AuthState {
  user: AppUser | null;
}

const initialState: AuthState = {
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AppUser | null>) {
      state.user = action.payload;
    },
  },
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;
