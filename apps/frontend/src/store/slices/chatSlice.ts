import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage } from '../../types/domain';

interface ChatState {
  messages: ChatMessage[];
  unreadCount: number;
}

const initialState: ChatState = {
  messages: [],
  unreadCount: 0,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.messages = action.payload;
    },
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload);
    },
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
  },
});

export const { setMessages, addMessage, setUnreadCount } = chatSlice.actions;
export default chatSlice.reducer;
