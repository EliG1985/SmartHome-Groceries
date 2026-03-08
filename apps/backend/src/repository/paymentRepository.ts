import crypto from 'node:crypto';
import { supabaseAdmin } from '../db.js';
import { purchaseCoinPack } from './storeRepository.js';
import type { PaymentCheckoutSessionRecord, PaymentWebhookEventRecord, PaymentWebhookStatus } from '../types.js';

type InMemoryCheckoutSession = PaymentCheckoutSessionRecord;
const inMemorySessions = new Map<string, InMemoryCheckoutSession>();
const inMemoryEvents = new Set<string>();

const DEMO_PROVIDER = 'demo-provider';

function getWebhookSecret() {
  return process.env.PAYMENT_WEBHOOK_SECRET || 'dev-demo-webhook-secret';
}

function canonicalizePayload(payload: Record<string, unknown>) {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

export function signWebhookPayload(payload: Record<string, unknown>) {
  return crypto.createHmac('sha256', getWebhookSecret()).update(canonicalizePayload(payload)).digest('hex');
}

export function verifyWebhookSignature(payload: Record<string, unknown>, signature: string | undefined) {
  if (!signature) return false;
  const expected = signWebhookPayload(payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function createCheckoutSession(params: {
  userId: string;
  familyId: string;
  packId: 'pack-small' | 'pack-medium' | 'pack-large';
  amountCoins: number;
  amountIls: number;
}) {
  const createdAt = new Date().toISOString();

  if (!supabaseAdmin) {
    const session: PaymentCheckoutSessionRecord = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      family_id: params.familyId,
      provider: DEMO_PROVIDER,
      provider_reference: null,
      pack_id: params.packId,
      amount_coins: params.amountCoins,
      amount_ils: params.amountIls,
      status: 'Pending',
      created_at: createdAt,
      paid_at: null,
      updated_at: createdAt,
    };
    inMemorySessions.set(session.id, session);
    return {
      session,
      checkoutUrl: `https://payments.example.invalid/demo/${session.id}`,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('payment_checkout_sessions')
    .insert({
      user_id: params.userId,
      family_id: params.familyId,
      provider: DEMO_PROVIDER,
      pack_id: params.packId,
      amount_coins: params.amountCoins,
      amount_ils: params.amountIls,
      status: 'Pending',
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create checkout session');

  return {
    session: data as PaymentCheckoutSessionRecord,
    checkoutUrl: `https://payments.example.invalid/demo/${String((data as PaymentCheckoutSessionRecord).id)}`,
  };
}

async function hasEventProcessed(providerEventId: string): Promise<boolean> {
  if (!supabaseAdmin) return inMemoryEvents.has(providerEventId);

  const { data, error } = await supabaseAdmin
    .from('payment_webhook_events')
    .select('id')
    .eq('provider_event_id', providerEventId)
    .single();

  if (error) return false;
  return Boolean(data);
}

async function insertWebhookEvent(params: {
  providerEventId: string;
  payload: Record<string, unknown>;
  status: PaymentWebhookStatus;
}): Promise<void> {
  if (!supabaseAdmin) {
    inMemoryEvents.add(params.providerEventId);
    return;
  }

  const { error } = await supabaseAdmin.from('payment_webhook_events').insert({
    provider: DEMO_PROVIDER,
    provider_event_id: params.providerEventId,
    payload: params.payload,
    status: params.status,
    processed_at: new Date().toISOString(),
  } as PaymentWebhookEventRecord);

  if (error) throw new Error(error.message);
}

export async function processCheckoutWebhook(params: {
  providerEventId: string;
  checkoutSessionId: string;
  status: 'paid' | 'failed';
  providerReference?: string;
  payload: Record<string, unknown>;
}) {
  const alreadyProcessed = await hasEventProcessed(params.providerEventId);
  if (alreadyProcessed) {
    return { ok: true as const, duplicated: true as const };
  }

  if (!supabaseAdmin) {
    const session = inMemorySessions.get(params.checkoutSessionId);
    if (!session) throw new Error('Checkout session not found.');

    if (params.status === 'paid' && session.status !== 'Paid') {
      const nextStatus: PaymentCheckoutSessionRecord = {
        ...session,
        status: 'Paid',
        provider_reference: params.providerReference ?? null,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemorySessions.set(session.id, nextStatus);

      await purchaseCoinPack({
        userId: session.user_id,
        familyId: session.family_id,
        packId: session.pack_id,
        amountCoins: session.amount_coins,
        reason: 'payment_webhook_credit',
        metadata: {
          provider: DEMO_PROVIDER,
          providerEventId: params.providerEventId,
          checkoutSessionId: session.id,
        },
      });
    }

    if (params.status === 'failed' && session.status === 'Pending') {
      inMemorySessions.set(session.id, {
        ...session,
        status: 'Failed',
        provider_reference: params.providerReference ?? null,
        updated_at: new Date().toISOString(),
      });
    }

    await insertWebhookEvent({
      providerEventId: params.providerEventId,
      payload: params.payload,
      status: 'processed',
    });

    return { ok: true as const, duplicated: false as const };
  }

  const { data: sessionData, error: sessionError } = await supabaseAdmin
    .from('payment_checkout_sessions')
    .select('*')
    .eq('id', params.checkoutSessionId)
    .single();

  if (sessionError || !sessionData) {
    await insertWebhookEvent({
      providerEventId: params.providerEventId,
      payload: params.payload,
      status: 'rejected',
    });
    throw new Error('Checkout session not found.');
  }

  const session = sessionData as PaymentCheckoutSessionRecord;

  if (params.status === 'paid' && session.status !== 'Paid') {
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('payment_checkout_sessions')
      .update({
        status: 'Paid',
        provider_reference: params.providerReference ?? null,
        paid_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', session.id);

    if (updateError) throw new Error(updateError.message);

    await purchaseCoinPack({
      userId: session.user_id,
      familyId: session.family_id,
      packId: session.pack_id,
      amountCoins: session.amount_coins,
      reason: 'payment_webhook_credit',
      metadata: {
        provider: DEMO_PROVIDER,
        providerEventId: params.providerEventId,
        checkoutSessionId: session.id,
      },
    });
  }

  if (params.status === 'failed' && session.status === 'Pending') {
    const { error: failUpdateError } = await supabaseAdmin
      .from('payment_checkout_sessions')
      .update({
        status: 'Failed',
        provider_reference: params.providerReference ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (failUpdateError) throw new Error(failUpdateError.message);
  }

  await insertWebhookEvent({
    providerEventId: params.providerEventId,
    payload: params.payload,
    status: 'processed',
  });

  return { ok: true as const, duplicated: false as const };
}
