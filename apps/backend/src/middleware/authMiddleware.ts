import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin, supabaseAuth } from '../db.js';
import type { UserProfile } from '../types.js';

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asValidRole(value: unknown): 'owner' | 'editor' | 'viewer' | null {
  if (value === 'owner' || value === 'editor' || value === 'viewer') return value;
  return null;
}

function asValidTier(value: unknown): 'Free' | 'Premium' | null {
  if (value === 'Free' || value === 'Premium') return value;
  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

async function bootstrapMissingUserProfile(authUser: AuthUserLike): Promise<UserProfile | null> {
  if (!supabaseAdmin) return null;

  const email = asTrimmedString(authUser.email)?.toLowerCase();
  if (!email) return null;

  const metadata = authUser.user_metadata ?? {};
  const firstName = asTrimmedString(metadata.first_name);
  const lastName = asTrimmedString(metadata.last_name);
  const fullNameFromParts = [firstName, lastName].filter(Boolean).join(' ').trim();
  const fullName = asTrimmedString(metadata.full_name) ?? (fullNameFromParts || null);
  const familyNameFromMeta = asTrimmedString(metadata.family_name);
  const familyName = familyNameFromMeta ?? (lastName ? `${lastName} Family` : 'My Family');
  const requestedRole = asValidRole(metadata.role);
  const requestedFamilyId = asTrimmedString(metadata.family_id);

  let familyId: string | null = null;
  let profileRole: 'owner' | 'editor' | 'viewer' = requestedRole ?? 'owner';

  if (requestedFamilyId && UUID_REGEX.test(requestedFamilyId)) {
    const { data: familyRow } = await supabaseAdmin
      .from('families')
      .select('id')
      .eq('id', requestedFamilyId)
      .maybeSingle();

    if (familyRow?.id) {
      familyId = familyRow.id;
      profileRole = requestedRole ?? 'editor';
    }
  }

  if (!familyId) {
    const { data: createdFamily, error: createFamilyError } = await supabaseAdmin
      .from('families')
      .insert({
        name: familyName,
        owner_id: authUser.id,
      })
      .select('id')
      .single();

    if (createFamilyError || !createdFamily?.id) {
      return null;
    }

    familyId = createdFamily.id;
    profileRole = 'owner';
  }

  const { error: upsertError } = await supabaseAdmin.from('users_profile').upsert(
    {
      id: authUser.id,
      email,
      family_id: familyId,
      full_name: fullName,
      family_name: familyName,
      role: profileRole,
      subscription_tier: 'Free',
    },
    { onConflict: 'id' },
  );

  if (upsertError) return null;

  const { data: profile } = await supabaseAdmin
    .from('users_profile')
    .select('id,email,family_id,subscription_tier,full_name,family_name,role')
    .eq('id', authUser.id)
    .maybeSingle();

  return (profile as UserProfile | null) ?? null;
}

function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    if (!supabaseAuth) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({
          error: 'Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.',
        });
      }

      const jwtPayload = decodeJwtPayload(token);
      const userMetadata = (jwtPayload?.user_metadata as Record<string, unknown> | undefined) ?? {};
      const userId = asTrimmedString(jwtPayload?.sub);
      const email = asTrimmedString(jwtPayload?.email) ?? '';
      const metadataFamilyId = asTrimmedString(userMetadata.family_id);
      const familyId = userId
        ? metadataFamilyId && UUID_REGEX.test(metadataFamilyId)
          ? metadataFamilyId
          : userId
        : null;

      if (!userId || !familyId) {
        return res.status(401).json({ error: 'Invalid bearer token payload' });
      }

      req.auth = {
        userId,
        email,
        familyId,
        role: asValidRole(userMetadata.role) ?? 'editor',
        subscriptionTier: asValidTier(userMetadata.subscription_tier) ?? 'Free',
      };

      return next();
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!supabaseAdmin) {
      const metadata = authData.user.user_metadata ?? {};
      const metadataFamilyId = asTrimmedString(metadata.family_id);
      const familyId = metadataFamilyId && UUID_REGEX.test(metadataFamilyId) ? metadataFamilyId : authData.user.id;
      const role = asValidRole(metadata.role) ?? 'editor';
      const subscriptionTier = asValidTier(metadata.subscription_tier) ?? 'Free';

      req.auth = {
        userId: authData.user.id,
        email: authData.user.email ?? '',
        familyId,
        role,
        subscriptionTier,
      };

      return next();
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users_profile')
      .select('id,email,family_id,subscription_tier,full_name,family_name,role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({ error: 'Failed to load user profile' });
    }

    const resolvedProfile = profile ?? (await bootstrapMissingUserProfile(authData.user));

    if (!resolvedProfile) {
      return res.status(403).json({ error: 'User profile not found or not linked to a family' });
    }

    const userProfile = resolvedProfile as UserProfile;
    req.auth = {
      userId: userProfile.id,
      email: userProfile.email,
      familyId: userProfile.family_id,
      role: userProfile.role ?? 'editor',
      subscriptionTier: userProfile.subscription_tier,
    };

    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return res.status(401).json({ error: message });
  }
}
