import { useEffect, useState } from 'react';
import { MailPlus, RefreshCw, Users } from 'lucide-react';
import {
  backendMode,
  getParticipants,
  getMyInvitations,
  inviteParticipantByEmail,
  respondToInvitation,
  updateParticipantRole,
  type ApiError,
} from '../lib/api';
import type { CollaborationSubscriptionStatus, FamilyInvitation, FamilyMember } from '../types/domain';
import { HistoryInput } from './HistoryInput';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { ToastStack, type ToastItem } from './ToastStack';
import { useLanguage } from '../lib/i18n';

interface ParticipantsPanelProps {
  onMembershipChanged?: () => void;
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

export function ParticipantsPanel({ onMembershipChanged }: ParticipantsPanelProps) {
  const { t } = useLanguage();
  const user = useSelector((state: RootState) => state.auth.user);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<Array<FamilyInvitation & { inviter_email?: string; inviter_family_id?: string }>>([]);
  const [subscription, setSubscription] = useState<CollaborationSubscriptionStatus | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (message: string, tone: ToastItem['tone'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  };

  const loadData = async () => {
    if (!backendMode) return;

    setLoading(true);
    setStatusText(null);
    try {
      const data = await getParticipants();
      const inbox = await getMyInvitations();
      setMembers(data.members);
      setInvitations(data.invitations);
      setMyInvitations(inbox.invitations);
      setSubscription(data.subscription);
    } catch (error) {
      setStatusText(messageFromError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const inviteByEmail = async () => {
    if (!inviteEmail.trim()) return;

    setWorking(true);
    setStatusText(null);
    try {
      await inviteParticipantByEmail(inviteEmail.trim());
      setInviteEmail('');
      setStatusText(t('participants.invitationSent'));
      pushToast(t('participants.invitationSent'), 'success');
      await loadData();
    } catch (error) {
      const status = (error as ApiError | undefined)?.status;
      if (status === 402) {
        setStatusText(t('participants.premiumInviteRequired'));
        pushToast(t('participants.premiumInviteRequired'), 'error');
      } else {
        setStatusText(messageFromError(error));
        pushToast(t('participants.invitationFailed'), 'error');
      }
    } finally {
      setWorking(false);
    }
  };

  const onRespondInvitation = async (invitationId: string, decision: 'Accepted' | 'Declined') => {
    setWorking(true);
    setStatusText(null);
    try {
      await respondToInvitation(invitationId, decision);
      setStatusText(t('participants.invitationDecision', { decision: decision.toLowerCase() }));
      pushToast(t('participants.invitationDecision', { decision: decision.toLowerCase() }), 'success');
      if (decision === 'Accepted') onMembershipChanged?.();
      await loadData();
    } catch (error) {
      setStatusText(messageFromError(error));
      pushToast(t('participants.respondFailed'), 'error');
    } finally {
      setWorking(false);
    }
  };

  const onChangeRole = async (memberId: string, role: 'owner' | 'editor' | 'viewer') => {
    setWorking(true);
    setStatusText(null);
    try {
      await updateParticipantRole(memberId, role);
      setStatusText(t('participants.roleUpdated'));
      pushToast(t('participants.roleUpdated'), 'success');
      await loadData();
    } catch (error) {
      setStatusText(messageFromError(error));
      pushToast(t('participants.roleUpdateFailed'), 'error');
    } finally {
      setWorking(false);
    }
  };

  if (!backendMode) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Participants</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t('participants.backendRequiredPrefix')} <code>VITE_API_BASE_URL</code> {t('participants.backendRequiredSuffix')}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Users size={18} />
          {t('participants.title')}
        </h2>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw size={14} />
          {t('participants.refresh')}
        </button>
      </div>

      {subscription && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-indigo-900">
          <p>
            {t('participants.members')}: <strong>{subscription.memberCount}</strong>
          </p>
          <p>
            {t('participants.pricingRule', { price: subscription.monthlyPriceIls, months: subscription.commitmentMonths })}
          </p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <HistoryInput
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder={t('participants.inviteByEmail')}
          value={inviteEmail}
          onChange={(event) => setInviteEmail(event.target.value)}
          historyKey="invite-email"
          type="email"
        />
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          onClick={() => void inviteByEmail()}
          disabled={working || !inviteEmail.trim()}
        >
          <MailPlus size={14} />
          {t('participants.invite')}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-medium text-slate-800">{t('participants.familyMembers')}</p>
        {loading && <p className="text-sm text-slate-500">{t('participants.loadingMembers')}</p>}
        {!loading && members.length === 0 && <p className="text-sm text-slate-500">{t('participants.noMembers')}</p>}
        <ul className="space-y-1 text-sm text-slate-700">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
              <span>{member.full_name || member.email}</span>
              {user?.role === 'owner' && member.id !== user.id ? (
                <select
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  value={member.role}
                  onChange={(event) => void onChangeRole(member.id, event.target.value as 'owner' | 'editor' | 'viewer')}
                >
                  <option value="owner">owner</option>
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
              ) : (
                <span className="text-xs text-slate-500">{member.role}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-medium text-slate-800">{t('participants.pendingInvitations')}</p>
        {!invitations.length && <p className="text-sm text-slate-500">{t('participants.noInvitations')}</p>}
        <ul className="space-y-1 text-sm text-slate-700">
          {invitations.map((invite) => (
            <li key={invite.id} className="rounded-md bg-slate-50 px-2 py-1">
              {invite.invitee_email || invite.invitee_family_name || t('participants.unknown')} · {invite.status}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-medium text-slate-800">{t('participants.myIncomingInvitations')}</p>
        {!myInvitations.length && <p className="text-sm text-slate-500">{t('participants.noPendingInvitations')}</p>}
        <ul className="space-y-2 text-sm text-slate-700">
          {myInvitations.map((invite) => (
            <li key={invite.id} className="rounded-md bg-slate-50 px-2 py-2">
              <p>{t('participants.from')}: {invite.inviter_email || t('participants.unknownInviter')}</p>
              <p className="text-xs text-slate-500">{t('participants.status')}: {invite.status}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  onClick={() => void onRespondInvitation(invite.id, 'Accepted')}
                  disabled={working}
                >
                  {t('participants.accept')}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  onClick={() => void onRespondInvitation(invite.id, 'Declined')}
                  disabled={working}
                >
                  {t('participants.decline')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {statusText && <p className="text-sm text-slate-600">{statusText}</p>}
      <ToastStack toasts={toasts} />
    </section>
  );
}
