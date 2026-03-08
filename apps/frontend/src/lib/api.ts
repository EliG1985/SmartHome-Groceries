import type {
  ChatMessage,
  CollaborationSubscriptionStatus,
  FamilyInvitation,
  FamilyMember,
  InventoryItem,
  ProductSubstituteSuggestion,
} from '../types/domain';
import { supabase } from './supabase';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isAuthApiError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Missing auth session. Please sign in before using backend API.');

  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeader = await getAuthHeader();

  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(body || `API error: ${response.status}`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function requestPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(body || `API error: ${response.status}`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const backendMode = Boolean(import.meta.env.VITE_API_BASE_URL && supabase);

export interface SupermarketInsightItem {
  id: string;
  product_name: string;
  category: string;
  originalCategory: string;
  quantity: number;
  currentUnitPrice: number;
  currentTotalPrice: number;
  liveUnitPrice: number;
  liveTotalPrice: number;
  deltaTotal: number;
  inStock: boolean;
  source: string;
  updatedAt: string;
}

export interface SupermarketInsightsResponse {
  supermarket: string;
  generatedAt: string;
  liveDataConnected: boolean;
  items: SupermarketInsightItem[];
  totals: {
    currentBasketTotal: number;
    liveBasketTotal: number;
    basketDelta: number;
  };
  insights: string[];
}

export interface ApplyAiCategoriesResponse {
  supermarket: string;
  updatedCount: number;
  updatedItems: Array<{ id: string; product_name: string; from: string; to: string }>;
  message: string;
}

export interface SupermarketProductPriceResponse {
  supermarket: string;
  productName: string;
  barcode?: string;
  liveUnitPrice: number;
  source: string;
  updatedAt: string;
  liveDataConnected: boolean;
}

export interface NearbySupermarketChain {
  chain: string;
  nearestDistanceKm: number;
  nearestBranch: string;
}

export interface ParticipantsResponse {
  members: FamilyMember[];
  invitations: FamilyInvitation[];
  subscription: CollaborationSubscriptionStatus;
}

export interface InvitationInboxResponse {
  invitations: Array<
    FamilyInvitation & {
      inviter_email?: string;
      inviter_family_id?: string;
    }
  >;
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  subscription: CollaborationSubscriptionStatus;
}

export interface StoreStateResponse {
  coinsBalance: number;
  unlockedItemIds: string[];
  activeSkin: 'default' | 'ocean' | 'sunset' | 'midnight';
}

export function getInventory() {
  return request<InventoryItem[]>('/api/inventory');
}

export function createInventoryItem(payload: Omit<InventoryItem, 'id' | 'created_at' | 'purchased_at'>) {
  return request<InventoryItem>('/api/inventory', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateInventoryStatus(id: string, status: InventoryItem['status']) {
  return request<void>(`/api/inventory/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deleteInventoryItem(id: string) {
  return request<void>(`/api/inventory/${id}`, {
    method: 'DELETE',
  });
}

export function updateInventoryItem(
  id: string,
  payload: Pick<InventoryItem, 'product_name' | 'category' | 'barcode' | 'expiry_date' | 'price' | 'quantity'>,
) {
  return request<InventoryItem>(`/api/inventory/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getSupermarketInsights(supermarket: string) {
  const query = new URLSearchParams({ supermarket }).toString();
  return request<SupermarketInsightsResponse>(`/api/reports/supermarket-insights?${query}`);
}

export function applyAiCategories(supermarket: string) {
  return request<ApplyAiCategoriesResponse>('/api/reports/supermarket-insights/apply-categories', {
    method: 'POST',
    body: JSON.stringify({ supermarket }),
  });
}

export function getSupermarketProductPrice(params: {
  supermarket: string;
  productName: string;
  barcode?: string;
  fallbackPrice?: number;
}) {
  const query = new URLSearchParams({
    supermarket: params.supermarket,
    productName: params.productName,
    ...(params.barcode ? { barcode: params.barcode } : {}),
    ...(typeof params.fallbackPrice === 'number' ? { fallbackPrice: String(params.fallbackPrice) } : {}),
  }).toString();

  return request<SupermarketProductPriceResponse>(`/api/reports/product-price?${query}`);
}

export function getNearbySupermarkets(params: { latitude: number; longitude: number; radiusKm: number }) {
  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    radiusKm: String(params.radiusKm),
  }).toString();

  return requestPublic<{ chains: NearbySupermarketChain[]; radiusKm: number }>(`/api/reports/nearby-supermarkets?${query}`);
}

export function getParticipants() {
  return request<ParticipantsResponse>('/api/collaboration/participants');
}

export function inviteParticipantByEmail(email: string) {
  return request<{ invitation: FamilyInvitation }>('/api/collaboration/participants/invite-by-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function getChatMessages(limit = 100) {
  return request<ChatMessagesResponse>(`/api/collaboration/chat/messages?limit=${limit}`);
}

export function sendChatMessage(payload: {
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
}) {
  return request<ChatMessage>('/api/collaboration/chat/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function learnSubstitute(payload: {
  originalProductName: string;
  substituteProductName: string;
  sourceMessageId?: string;
}) {
  return request<ProductSubstituteSuggestion>('/api/collaboration/substitutes/learn', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getSubstituteSuggestions(productName: string) {
  const query = new URLSearchParams({ productName }).toString();
  return request<{ productName: string; suggestions: ProductSubstituteSuggestion[] }>(
    `/api/collaboration/substitutes/suggestions?${query}`,
  );
}

export function getCollaborationSubscriptionStatus() {
  return request<CollaborationSubscriptionStatus>('/api/collaboration/subscription-status');
}

export function getChatImageUrls(paths: string[], expiresInSeconds = 60 * 15) {
  return request<{ urlsByPath: Record<string, string> }>('/api/collaboration/chat/image-urls', {
    method: 'POST',
    body: JSON.stringify({ paths, expiresInSeconds }),
  });
}

export function updateParticipantRole(memberId: string, role: 'owner' | 'editor' | 'viewer') {
  return request<FamilyMember>(`/api/collaboration/participants/${memberId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function getMyInvitations() {
  return request<InvitationInboxResponse>('/api/collaboration/my-invitations');
}

export function respondToInvitation(invitationId: string, decision: 'Accepted' | 'Declined') {
  return request<FamilyInvitation>(`/api/collaboration/my-invitations/${invitationId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

export function getCurrentUserProfile() {
  return request<{
    id: string;
    email: string;
    familyId: string;
    role: 'owner' | 'editor' | 'viewer';
    subscriptionTier: 'Free' | 'Premium';
  }>('/api/collaboration/me');
}

export function getStoreState() {
  return request<StoreStateResponse>('/api/store/state');
}

export function purchaseStoreCoinPack(packId: 'pack-small' | 'pack-medium' | 'pack-large') {
  return request<StoreStateResponse>('/api/store/coins/purchase', {
    method: 'POST',
    body: JSON.stringify({ packId }),
  });
}

export function unlockStoreCatalogItem(itemId: string) {
  return request<StoreStateResponse>('/api/store/unlock', {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  });
}

export function applyStoreSkin(skinId: 'default' | 'ocean' | 'sunset' | 'midnight') {
  return request<StoreStateResponse>('/api/store/skins/apply', {
    method: 'POST',
    body: JSON.stringify({ skinId }),
  });
}

export interface CheckoutSessionResponse {
  session: {
    id: string;
    status: 'Pending' | 'Paid' | 'Failed' | 'Expired';
    pack_id: 'pack-small' | 'pack-medium' | 'pack-large';
    amount_coins: number;
    amount_ils: number;
  };
  checkoutUrl: string;
}

export function createCheckoutSession(packId: 'pack-small' | 'pack-medium' | 'pack-large') {
  return request<CheckoutSessionResponse>('/api/payments/checkout/session', {
    method: 'POST',
    body: JSON.stringify({ packId }),
  });
}

export function signDemoWebhookPayload(payload: {
  providerEventId: string;
  checkoutSessionId: string;
  status: 'paid' | 'failed';
  providerReference?: string;
}) {
  return requestPublic<{ signature: string }>('/api/payments/webhooks/demo-provider/sign', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function submitDemoWebhookEvent(
  payload: {
    providerEventId: string;
    checkoutSessionId: string;
    status: 'paid' | 'failed';
    providerReference?: string;
  },
  signature: string,
) {
  return requestPublic<{ ok: true; duplicated: boolean }>('/api/payments/webhooks/demo-provider', {
    method: 'POST',
    headers: {
      'x-smarthome-signature': signature,
    },
    body: JSON.stringify(payload),
  });
}
