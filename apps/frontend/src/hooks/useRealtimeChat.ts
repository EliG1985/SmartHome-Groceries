import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';
import { addMessage, setMessages, setUnreadCount } from '../store/slices/chatSlice';
import type { ChatMessage } from '../types/domain';

export function useRealtimeChat(enabled = true) {
  const dispatch = useDispatch();
  const familyId = useSelector((state: RootState) => state.auth.user?.familyId);

  useEffect(() => {
    if (!enabled || !supabase || !familyId) return;
    const client = supabase;

    const channel = client
      .channel('chat-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `family_id=eq.${familyId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            dispatch(addMessage(payload.new as ChatMessage));
            dispatch(setUnreadCount(1)); // Simplified: mark as unread
          }
          if (payload.eventType === 'UPDATE') {
            dispatch(setMessages([payload.new as ChatMessage]));
          }
          if (payload.eventType === 'DELETE') {
            dispatch(setMessages([]));
            dispatch(setUnreadCount(0));
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [dispatch, enabled, familyId]);
}
