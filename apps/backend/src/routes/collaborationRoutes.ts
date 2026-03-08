import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  cancelFamilySubscription,
  createChatMessage,
  createInvitationByEmail,
  getFamilySubscriptionStatus,
  getSignedChatImageUrls,
  getSubstituteSuggestions,
  learnSubstitute,
  listChatMessages,
  listFamilyInvitations,
  listFamilyMembers,
  listMyPendingInvitations,
  respondToInvitation,
  updateFamilyMemberRole,
} from '../repository/collaborationRepository.js';

export const collaborationRouter = Router();

const inviteByEmailSchema = z.object({
  email: z.string().email(),
});

const sendMessageSchema = z.object({
  body: z.string().min(1),
  imagePath: z.string().optional(),
  imageUrl: z.string().optional(),
  attachments: z
    .array(
      z.object({
        storagePath: z.string().min(1),
        fileName: z.string().optional(),
        mimeType: z.string().optional(),
        fileSize: z.number().int().nonnegative().optional(),
      }),
    )
    .max(12)
    .optional(),
  kind: z.enum(['message', 'decision', 'system']).optional(),
  relatedProductName: z.string().optional(),
  substituteFor: z.string().optional(),
});

const signedUrlsSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(100),
  expiresInSeconds: z.number().int().positive().max(60 * 60 * 24).optional(),
});

const learnSubstituteSchema = z.object({
  originalProductName: z.string().min(1),
  substituteProductName: z.string().min(1),
  sourceMessageId: z.string().optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']),
});

const invitationDecisionSchema = z.object({
  decision: z.enum(['Accepted', 'Declined']),
});

function ensurePremiumForShared(req: Request, memberCount: number) {
  if (!req.auth) return { allowed: false as const, status: 401, message: 'Unauthorized' };

  if (memberCount > 1 && req.auth.subscriptionTier !== 'Premium') {
    return {
      allowed: false as const,
      status: 402,
      message: 'Shared collaboration requires Premium (₪40/month per user, cancel anytime).',
    };
  }

  return { allowed: true as const };
}

function ensureParticipantManagementRole(req: Request) {
  if (!req.auth) return { allowed: false as const, status: 401, message: 'Unauthorized' };
  if (req.auth.role === 'viewer') {
    return { allowed: false as const, status: 403, message: 'Viewer role cannot manage participants.' };
  }
  return { allowed: true as const };
}

function ensureCanWriteCollaboration(req: Request) {
  if (!req.auth) return { allowed: false as const, status: 401, message: 'Unauthorized' };
  if (req.auth.role === 'viewer') {
    return { allowed: false as const, status: 403, message: 'Viewer role cannot perform collaboration write actions.' };
  }
  return { allowed: true as const };
}

function ensureOwnerRole(req: Request) {
  if (!req.auth) return { allowed: false as const, status: 401, message: 'Unauthorized' };
  if (req.auth.role !== 'owner') {
    return { allowed: false as const, status: 403, message: 'Only owner can update participant roles.' };
  }
  return { allowed: true as const };
}

collaborationRouter.get('/participants', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const members = await listFamilyMembers(req.auth.familyId);
  const invitations = await listFamilyInvitations(req.auth.familyId);
  const subscription = await getFamilySubscriptionStatus(req.auth.familyId);

  return res.json({
    members,
    invitations,
    subscription,
  });
});

collaborationRouter.get('/me', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  return res.json({
    id: req.auth.userId,
    email: req.auth.email,
    familyId: req.auth.familyId,
    role: req.auth.role,
    subscriptionTier: req.auth.subscriptionTier,
  });
});

collaborationRouter.post('/participants/invite-by-email', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const roleGate = ensureParticipantManagementRole(req);
  if (!roleGate.allowed) return res.status(roleGate.status).json({ error: roleGate.message });

  const parsed = inviteByEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const subscription = await getFamilySubscriptionStatus(req.auth.familyId);
  const gate = ensurePremiumForShared(req, subscription.memberCount + 1);
  if (!gate.allowed) return res.status(gate.status).json({ error: gate.message, subscription });

  const invitation = await createInvitationByEmail({
    familyId: req.auth.familyId,
    inviterUserId: req.auth.userId,
    inviteeEmail: parsed.data.email,
  });

  return res.status(201).json({ invitation });
});

collaborationRouter.patch('/participants/:memberId/role', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const ownerGate = ensureOwnerRole(req);
  if (!ownerGate.allowed) return res.status(ownerGate.status).json({ error: ownerGate.message });

  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await updateFamilyMemberRole({
    familyId: req.auth.familyId,
    memberId: req.params.memberId,
    role: parsed.data.role,
  });

  return res.json(updated);
});

collaborationRouter.get('/my-invitations', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const invitations = await listMyPendingInvitations({
    userId: req.auth.userId,
    email: req.auth.email,
  });

  return res.json({ invitations });
});

collaborationRouter.post('/my-invitations/:id/respond', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = invitationDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await respondToInvitation({
    invitationId: req.params.id,
    userId: req.auth.userId,
    email: req.auth.email,
    decision: parsed.data.decision,
  });

  return res.json(updated);
});

collaborationRouter.get('/chat/messages', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Number(req.query.limit || '100');
  const messages = await listChatMessages(req.auth.familyId, Number.isFinite(limit) ? limit : 100);
  const subscription = await getFamilySubscriptionStatus(req.auth.familyId);

  return res.json({ messages, subscription });
});

collaborationRouter.post('/chat/messages', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const writeGate = ensureCanWriteCollaboration(req);
  if (!writeGate.allowed) return res.status(writeGate.status).json({ error: writeGate.message });

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const subscription = await getFamilySubscriptionStatus(req.auth.familyId);
  const gate = ensurePremiumForShared(req, subscription.memberCount);
  if (!gate.allowed) return res.status(gate.status).json({ error: gate.message, subscription });

  const message = await createChatMessage({
    familyId: req.auth.familyId,
    senderUserId: req.auth.userId,
    senderName: req.auth.email,
    body: parsed.data.body,
    imagePath: parsed.data.imagePath,
    imageUrl: parsed.data.imageUrl,
    attachments: parsed.data.attachments,
    kind: parsed.data.kind,
    relatedProductName: parsed.data.relatedProductName,
    substituteFor: parsed.data.substituteFor,
  });

  if (parsed.data.substituteFor && parsed.data.relatedProductName) {
    await learnSubstitute({
      familyId: req.auth.familyId,
      originalProductName: parsed.data.substituteFor,
      substituteProductName: parsed.data.relatedProductName,
      sourceMessageId: message.id,
    });
  }

  return res.status(201).json(message);
});

collaborationRouter.get('/substitutes/suggestions', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const productName = String(req.query.productName || '').trim();
  if (!productName) return res.status(400).json({ error: 'productName query parameter is required' });

  const suggestions = await getSubstituteSuggestions(req.auth.familyId, productName);
  return res.json({ productName, suggestions });
});

collaborationRouter.post('/substitutes/learn', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const writeGate = ensureCanWriteCollaboration(req);
  if (!writeGate.allowed) return res.status(writeGate.status).json({ error: writeGate.message });

  const parsed = learnSubstituteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const subscription = await getFamilySubscriptionStatus(req.auth.familyId);
  const gate = ensurePremiumForShared(req, subscription.memberCount);
  if (!gate.allowed) return res.status(gate.status).json({ error: gate.message, subscription });

  const learned = await learnSubstitute({
    familyId: req.auth.familyId,
    originalProductName: parsed.data.originalProductName,
    substituteProductName: parsed.data.substituteProductName,
    sourceMessageId: parsed.data.sourceMessageId,
  });

  return res.status(201).json(learned);
});

collaborationRouter.get('/subscription-status', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const status = await getFamilySubscriptionStatus(req.auth.familyId);
  return res.json(status);
});

collaborationRouter.post('/subscription/cancel', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const ownerGate = ensureOwnerRole(req);
  if (!ownerGate.allowed) return res.status(ownerGate.status).json({ error: ownerGate.message });

  const cancelled = await cancelFamilySubscription(req.auth.familyId);
  const status = await getFamilySubscriptionStatus(req.auth.familyId);

  return res.json({ cancelled, status });
});

collaborationRouter.post('/chat/image-urls', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = signedUrlsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const urlsByPath = await getSignedChatImageUrls({
    familyId: req.auth.familyId,
    paths: parsed.data.paths,
    expiresInSeconds: parsed.data.expiresInSeconds,
  });

  return res.json({ urlsByPath });
});
