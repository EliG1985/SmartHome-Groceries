import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import inventoryReducer from './slices/inventorySlice';
import chatReducer from './slices/chatSlice';
import storeReducer from './slices/storeSlice';
import reportsReducer from './slices/reportsSlice';
import participantsReducer from './slices/participantsSlice';

  reducer: {
    auth: authReducer,
    inventory: inventoryReducer,
    chat: chatReducer,
    store: storeReducer,
    reports: reportsReducer,
    participants: participantsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
