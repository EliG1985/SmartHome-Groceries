import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { FamilyMember, FamilyInvitation } from '../../types/domain';

interface ParticipantsState {
  members: FamilyMember[];
  invitations: FamilyInvitation[];
  unreadInvitations: number;
}

const initialState: ParticipantsState = {
  members: [],
  invitations: [],
  unreadInvitations: 0,
};

const participantsSlice = createSlice({
  name: 'participants',
  initialState,
  reducers: {
    setMembers(state, action: PayloadAction<FamilyMember[]>) {
      state.members = action.payload;
    },
    setInvitations(state, action: PayloadAction<FamilyInvitation[]>) {
      state.invitations = action.payload;
    },
    setUnreadInvitations(state, action: PayloadAction<number>) {
      state.unreadInvitations = action.payload;
    },
  },
});

export const { setMembers, setInvitations, setUnreadInvitations } = participantsSlice.actions;
export default participantsSlice.reducer;
