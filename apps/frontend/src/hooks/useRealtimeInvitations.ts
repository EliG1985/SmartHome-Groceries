import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '../lib/supabase';
import type { RootState } from '../store';
import { setInvitations, setUnreadInvitations } from '../store/slices/participantsSlice';
import type { FamilyInvitation } from '../types/domain';

export function useRealtimeInvitations(enabled = true) {
  const dispatch = useDispatch();
  const userEmail = useSelector((state: RootState) => state.auth.user?.email);

  useEffect(() => {
    if (!enabled || !supabase || !userEmail) return;
    const client = supabase;

    const channel = client
      .channel('invitations-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_invitations', filter: `invitee_email=eq.${userEmail}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            dispatch(setInvitations([payload.new as FamilyInvitation]));
            dispatch(setUnreadInvitations(1)); // Simplified: mark as unread
          }
          if (payload.eventType === 'DELETE') {
            dispatch(setInvitations([]));
            dispatch(setUnreadInvitations(0));
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [dispatch, enabled, userEmail]);
}
