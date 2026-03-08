import {
  type ChatMessageAttachmentRecord,
  type ChatMessageRecord,
  type FamilyInvitationRecord,
  type FamilyMemberRecord,
  type FamilySubscriptionRecord,
  type InvitationInboxRecord,
  type ProductSubstituteRecord,
  type SubscriptionPlanType,
} from '../types.js';
import { supabaseAdmin } from '../db.js';

type FamilyCache = {
  members: FamilyMemberRecord[];
  messages: ChatMessageRecord[];
  attachments: ChatMessageAttachmentRecord[];
  substitutes: ProductSubstituteRecord[];
  invites: FamilyInvitationRecord[];
  subscription?: FamilySubscriptionRecord;
};

const inMemory = new Map<string, FamilyCache>();

function getFamilyCache(familyId: string): FamilyCache {
  const current = inMemory.get(familyId);
  if (current) return current;

  const created: FamilyCache = {
    members: [],
    messages: [],
    attachments: [],
    substitutes: [],
    invites: [],
  };
  inMemory.set(familyId, created);
  return created;
}

function normalizeProductName(value: string): string {
  return value.trim().toLowerCase();
}

export async function listFamilyMembers(familyId: string): Promise<FamilyMemberRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('users_profile')
      .select('id,email,full_name,family_name,role,subscription_tier,family_id,created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as FamilyMemberRecord[];
  }

  return getFamilyCache(familyId).members;
}

export async function countFamilyMembers(familyId: string): Promise<number> {
  if (supabaseAdmin) {
    const { count, error } = await supabaseAdmin
      .from('users_profile')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId);

    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  return getFamilyCache(familyId).members.length;
}

export async function listFamilyInvitations(familyId: string): Promise<FamilyInvitationRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('family_invitations')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as FamilyInvitationRecord[];
  }

  return getFamilyCache(familyId).invites;
}

export async function createInvitationByEmail(params: {
  familyId: string;
  inviterUserId: string;
  inviteeEmail: string;
}): Promise<FamilyInvitationRecord> {
  if (supabaseAdmin) {
    const payload = {
      family_id: params.familyId,
      inviter_user_id: params.inviterUserId,
      invitee_email: params.inviteeEmail.trim().toLowerCase(),
      status: 'Pending',
    };

    const { data, error } = await supabaseAdmin.from('family_invitations').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return data as FamilyInvitationRecord;
  }

  const invitation: FamilyInvitationRecord = {
    id: crypto.randomUUID(),
    family_id: params.familyId,
    inviter_user_id: params.inviterUserId,
    invitee_email: params.inviteeEmail.trim().toLowerCase(),
    status: 'Pending',
    created_at: new Date().toISOString(),
  };
  const cache = getFamilyCache(params.familyId);
  cache.invites = [invitation, ...cache.invites];
  return invitation;
}

export async function listMyPendingInvitations(params: {
  userId: string;
  email: string;
}): Promise<InvitationInboxRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('family_invitations')
      .select('*')
      .eq('status', 'Pending')
      .or(`invitee_user_id.eq.${params.userId},invitee_email.eq.${params.email.toLowerCase()}`)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const invitations = (data ?? []) as FamilyInvitationRecord[];
    if (!invitations.length) return [];

    const inviterIds = Array.from(new Set(invitations.map((invitation) => invitation.inviter_user_id)));
    const { data: inviters, error: invitersError } = await supabaseAdmin
      .from('users_profile')
      .select('id,email,family_id')
      .in('id', inviterIds);

    if (invitersError) throw new Error(invitersError.message);
    const inviterById = new Map((inviters ?? []).map((entry) => [String(entry.id), entry]));

    return invitations.map((invitation) => {
      const inviter = inviterById.get(invitation.inviter_user_id);
      return {
        ...invitation,
        inviter_email: inviter?.email ? String(inviter.email) : null,
        inviter_family_id: inviter?.family_id ? String(inviter.family_id) : null,
      };
    });
  }

  return [];
}

export async function respondToInvitation(params: {
  invitationId: string;
  userId: string;
  email: string;
  decision: 'Accepted' | 'Declined';
}): Promise<FamilyInvitationRecord> {
  if (!supabaseAdmin) {
    throw new Error('Invitation response requires backend mode');
  }

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from('family_invitations')
    .select('*')
    .eq('id', params.invitationId)
    .single();

  if (invitationError || !invitation) throw new Error('Invitation not found');

  const isInvitee =
    invitation.invitee_user_id === params.userId ||
    (!invitation.invitee_user_id && String(invitation.invitee_email || '').toLowerCase() === params.email.toLowerCase());

  if (!isInvitee) throw new Error('You are not allowed to respond to this invitation');
  if (invitation.status !== 'Pending') throw new Error('Invitation was already handled');

  if (params.decision === 'Accepted') {
    const { error: userUpdateError } = await supabaseAdmin
      .from('users_profile')
      .update({ family_id: invitation.family_id })
      .eq('id', params.userId);

    if (userUpdateError) throw new Error(userUpdateError.message);
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('family_invitations')
    .update({
      status: params.decision,
      invitee_user_id: params.userId,
      invitee_email: params.email.toLowerCase(),
      responded_at: new Date().toISOString(),
    })
    .eq('id', params.invitationId)
    .select('*')
    .single();

  if (updateError || !updated) throw new Error(updateError?.message || 'Failed to update invitation');
  return updated as FamilyInvitationRecord;
}

export async function updateFamilyMemberRole(params: {
  familyId: string;
  memberId: string;
  role: 'owner' | 'editor' | 'viewer';
}): Promise<FamilyMemberRecord> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('users_profile')
      .update({ role: params.role })
      .eq('id', params.memberId)
      .eq('family_id', params.familyId)
      .select('id,email,full_name,family_name,role,subscription_tier,family_id,created_at')
      .single();

    if (error) throw new Error(error.message);
    return data as FamilyMemberRecord;
  }

  const cache = getFamilyCache(params.familyId);
  const index = cache.members.findIndex((member) => member.id === params.memberId);
  if (index < 0) throw new Error('Member not found');

  const updated: FamilyMemberRecord = {
    ...cache.members[index],
    role: params.role,
  };
  cache.members[index] = updated;
  return updated;
}

export async function listChatMessages(familyId: string, limit = 100): Promise<ChatMessageRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));

    if (error) throw new Error(error.message);
    const messages = ((data ?? []) as ChatMessageRecord[]).reverse();
    if (!messages.length) return messages;

    const ids = messages.map((message) => message.id);
    const { data: attachments, error: attachmentsError } = await supabaseAdmin
      .from('chat_message_attachments')
      .select('*')
      .eq('family_id', familyId)
      .in('message_id', ids)
      .order('created_at', { ascending: true });

    if (attachmentsError) throw new Error(attachmentsError.message);
    const grouped = new Map<string, ChatMessageAttachmentRecord[]>();
    for (const attachment of (attachments ?? []) as ChatMessageAttachmentRecord[]) {
      const current = grouped.get(attachment.message_id) ?? [];
      current.push(attachment);
      grouped.set(attachment.message_id, current);
    }

    return messages.map((message) => ({
      ...message,
      attachments: grouped.get(message.id) ?? [],
    }));
  }

  const cache = getFamilyCache(familyId);
  return cache.messages.slice(-limit).map((message) => ({
    ...message,
    attachments: cache.attachments.filter((attachment) => attachment.message_id === message.id),
  }));
}

export async function createChatMessage(payload: {
  familyId: string;
  senderUserId: string;
  senderName: string;
  body: string;
  imagePath?: string;
  imageUrl?: string;
  attachments?: Array<{
    storagePath: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
  }>;
  kind?: 'message' | 'decision' | 'system';
  relatedProductName?: string;
  substituteFor?: string;
}): Promise<ChatMessageRecord> {
  const insertPayload = {
    family_id: payload.familyId,
    sender_user_id: payload.senderUserId,
    sender_name: payload.senderName,
    body: payload.body,
    image_path: payload.imagePath,
    image_url: payload.imageUrl,
    kind: payload.kind ?? 'message',
    related_product_name: payload.relatedProductName,
    substitute_for: payload.substituteFor,
  };

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from('chat_messages').insert(insertPayload).select('*').single();
    if (error) throw new Error(error.message);

    const message = data as ChatMessageRecord;
    const attachmentPayloads = (payload.attachments ?? []).filter((entry) => entry.storagePath.trim().length > 0);
    if (!attachmentPayloads.length) {
      return {
        ...message,
        attachments: [],
      };
    }

    const { data: insertedAttachments, error: attachmentError } = await supabaseAdmin
      .from('chat_message_attachments')
      .insert(
        attachmentPayloads.map((entry) => ({
          message_id: message.id,
          family_id: payload.familyId,
          storage_path: entry.storagePath,
          file_name: entry.fileName,
          mime_type: entry.mimeType,
          file_size: entry.fileSize,
        })),
      )
      .select('*');

    if (attachmentError) throw new Error(attachmentError.message);
    return {
      ...message,
      attachments: (insertedAttachments ?? []) as ChatMessageAttachmentRecord[],
    };
  }

  const record: ChatMessageRecord = {
    id: crypto.randomUUID(),
    family_id: payload.familyId,
    sender_user_id: payload.senderUserId,
    sender_name: payload.senderName,
    body: payload.body,
    image_path: payload.imagePath,
    image_url: payload.imageUrl,
    kind: payload.kind ?? 'message',
    related_product_name: payload.relatedProductName,
    substitute_for: payload.substituteFor,
    created_at: new Date().toISOString(),
    attachments: [],
  };

  const cache = getFamilyCache(payload.familyId);
  const createdAttachments: ChatMessageAttachmentRecord[] = (payload.attachments ?? [])
    .filter((entry) => entry.storagePath.trim().length > 0)
    .map((entry) => ({
      id: crypto.randomUUID(),
      message_id: record.id,
      family_id: payload.familyId,
      storage_path: entry.storagePath,
      file_name: entry.fileName,
      mime_type: entry.mimeType,
      file_size: entry.fileSize,
      created_at: new Date().toISOString(),
    }));

  if (createdAttachments.length) {
    cache.attachments = [...cache.attachments, ...createdAttachments];
    record.attachments = createdAttachments;
  }

  cache.messages = [...cache.messages, record];
  return record;
}

export async function learnSubstitute(payload: {
  familyId: string;
  originalProductName: string;
  substituteProductName: string;
  sourceMessageId?: string;
}): Promise<ProductSubstituteRecord> {
  const normalizedOriginal = normalizeProductName(payload.originalProductName);
  const normalizedSubstitute = normalizeProductName(payload.substituteProductName);

  if (supabaseAdmin) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('product_substitutes')
      .select('*')
      .eq('family_id', payload.familyId)
      .eq('original_product_name', normalizedOriginal)
      .eq('substitute_product_name', normalizedSubstitute)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('product_substitutes')
        .update({
          learned_count: Number(existing.learned_count || 1) + 1,
          last_used_at: new Date().toISOString(),
          source_message_id: payload.sourceMessageId ?? existing.source_message_id,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data as ProductSubstituteRecord;
    }

    const { data, error } = await supabaseAdmin
      .from('product_substitutes')
      .insert({
        family_id: payload.familyId,
        original_product_name: normalizedOriginal,
        substitute_product_name: normalizedSubstitute,
        source_message_id: payload.sourceMessageId,
        confidence: 0.8,
        learned_count: 1,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as ProductSubstituteRecord;
  }

  const cache = getFamilyCache(payload.familyId);
  const existingIndex = cache.substitutes.findIndex(
    (entry) =>
      entry.original_product_name === normalizedOriginal && entry.substitute_product_name === normalizedSubstitute,
  );

  if (existingIndex >= 0) {
    const current = cache.substitutes[existingIndex];
    const updated: ProductSubstituteRecord = {
      ...current,
      learned_count: current.learned_count + 1,
      source_message_id: payload.sourceMessageId ?? current.source_message_id,
      last_used_at: new Date().toISOString(),
    };
    cache.substitutes[existingIndex] = updated;
    return updated;
  }

  const created: ProductSubstituteRecord = {
    id: crypto.randomUUID(),
    family_id: payload.familyId,
    original_product_name: normalizedOriginal,
    substitute_product_name: normalizedSubstitute,
    source_message_id: payload.sourceMessageId,
    confidence: 0.8,
    learned_count: 1,
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  cache.substitutes = [created, ...cache.substitutes];
  return created;
}

export async function getSubstituteSuggestions(
  familyId: string,
  productName: string,
): Promise<ProductSubstituteRecord[]> {
  const normalized = normalizeProductName(productName);

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('product_substitutes')
      .select('*')
      .eq('family_id', familyId)
      .eq('original_product_name', normalized)
      .order('learned_count', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(5);

    if (error) throw new Error(error.message);
    return (data ?? []) as ProductSubstituteRecord[];
  }

  return getFamilyCache(familyId).substitutes
    .filter((entry) => entry.original_product_name === normalized)
    .sort((a, b) => b.learned_count - a.learned_count)
    .slice(0, 5);
}

export async function getFamilySubscriptionStatus(familyId: string): Promise<{
  memberCount: number;
  requiresPaidPlan: boolean;
  monthlyPriceIls: number;
  commitmentMonths: number;
  subscription?: FamilySubscriptionRecord;
}> {
  const memberCount = await countFamilyMembers(familyId);

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('family_subscriptions')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    let monthlyPriceIls = 80;
    let commitmentMonths = 1;
    let planName: SubscriptionPlanType = 'Monthly';
    let annualFirstMonthFree = false;
    if (data) {
      planName = data.plan_name as SubscriptionPlanType;
      if (planName === 'SemiAnnual') {
        monthlyPriceIls = 60;
        commitmentMonths = 6;
      } else if (planName === 'Annual') {
        monthlyPriceIls = 40;
        commitmentMonths = 12;
        annualFirstMonthFree = !!data.annual_first_month_free;
      }
    }

    return {
      memberCount,
      requiresPaidPlan: memberCount > 1,
      monthlyPriceIls,
      commitmentMonths,
      subscription: data ? (data as FamilySubscriptionRecord) : undefined,
    };
  }

  const cache = getFamilyCache(familyId);
  let monthlyPriceIls = 80;
  let commitmentMonths = 1;
  let planName: SubscriptionPlanType = 'Monthly';
  let annualFirstMonthFree = false;
  if (cache.subscription) {
    planName = cache.subscription.plan_name as SubscriptionPlanType;
    if (planName === 'SemiAnnual') {
      monthlyPriceIls = 60;
      commitmentMonths = 6;
    } else if (planName === 'Annual') {
      monthlyPriceIls = 40;
      commitmentMonths = 12;
      annualFirstMonthFree = !!cache.subscription.annual_first_month_free;
    }
  }
  return {
    memberCount,
    requiresPaidPlan: memberCount > 1,
    monthlyPriceIls,
    commitmentMonths,
    subscription: cache.subscription,
  };
}

export async function cancelFamilySubscription(familyId: string): Promise<FamilySubscriptionRecord | null> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('family_subscriptions')
      .update({
        is_active: false,
        ends_at: new Date().toISOString(),
      })
      .eq('family_id', familyId)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(error.message);

    const { error: usersError } = await supabaseAdmin
      .from('users_profile')
      .update({ subscription_tier: 'Free' })
      .eq('family_id', familyId);

    if (usersError) throw new Error(usersError.message);

    return (data as FamilySubscriptionRecord | null) ?? null;
  }

  const cache = getFamilyCache(familyId);
  if (cache.subscription) {
    cache.subscription = {
      ...cache.subscription,
      is_active: false,
      ends_at: new Date().toISOString(),
    };
  }

  return cache.subscription ?? null;
}

export async function getSignedChatImageUrls(params: {
  familyId: string;
  paths: string[];
  expiresInSeconds?: number;
}): Promise<Record<string, string>> {
  if (!supabaseAdmin) {
    throw new Error('Signed image URLs require backend mode');
  }

  const expiresIn = Math.min(Math.max(params.expiresInSeconds ?? 60 * 15, 60), 60 * 60 * 24);
  const sanitized = Array.from(new Set(params.paths.map((path) => path.trim()).filter(Boolean))).filter((path) =>
    path.startsWith(`${params.familyId}/`),
  );

  const signed: Record<string, string> = {};

  for (const path of sanitized) {
    const result = await supabaseAdmin.storage.from('chat-images').createSignedUrl(path, expiresIn);
    if (!result.error && result.data?.signedUrl) {
      signed[path] = result.data.signedUrl;
    }
  }

  return signed;
}
