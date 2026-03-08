import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ReportSummary } from '../../types/domain';

interface ReportsState {
  summary: ReportSummary | null;
}

const initialState: ReportsState = {
  summary: null,
};

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    setSummary(state, action: PayloadAction<ReportSummary>) {
      state.summary = action.payload;
    },
  },
});

export const { setSummary } = reportsSlice.actions;
export default reportsSlice.reducer;
