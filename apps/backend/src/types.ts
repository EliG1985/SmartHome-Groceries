export type InventoryStatus = 'In_List' | 'At_Home';

export interface InventoryRecord {
  id: string;
  family_id: string;
  product_name: string;
  category: string;
  barcode?: string;
  image_url?: string;
  status: InventoryStatus;
  expiry_date: string;
  price: number;
  quantity: number;
  purchased_at?: string | null;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  family_id: string;
  full_name?: string | null;
  family_name?: string | null;
  role?: 'owner' | 'editor' | 'viewer';
  subscription_tier: 'Free' | 'Premium';
}

export interface AuthContext {
  userId: string;
  email: string;
  familyId: string;
  role: 'owner' | 'editor' | 'viewer';
  subscriptionTier: 'Free' | 'Premium';
}

export interface FamilyMemberRecord {
  id: string;
  email: string;
  full_name?: string | null;
  family_name?: string | null;
  role: 'owner' | 'editor' | 'viewer';
  subscription_tier: 'Free' | 'Premium';
  family_id: string;
  created_at: string;
}

export interface FamilyInvitationRecord {
  id: string;
  family_id: string;
  inviter_user_id: string;
  invitee_user_id?: string | null;
  invitee_email?: string | null;
  invitee_family_name?: string | null;
  status: 'Pending' | 'Accepted' | 'Declined';
  created_at: string;
  responded_at?: string | null;
}

export interface InvitationInboxRecord extends FamilyInvitationRecord {
  inviter_email?: string | null;
  inviter_family_id?: string | null;
}

export interface ChatMessageRecord {
  id: string;
  family_id: string;
  sender_user_id: string;
  sender_name?: string | null;
  body: string;
  image_path?: string | null;
  image_url?: string | null;
  kind: 'message' | 'decision' | 'system';
  related_product_name?: string | null;
  substitute_for?: string | null;
  created_at: string;
  attachments?: ChatMessageAttachmentRecord[];
}

export interface ChatMessageAttachmentRecord {
  id: string;
  message_id: string;
  family_id: string;
  storage_path: string;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  created_at: string;
}

export interface ProductSubstituteRecord {
  id: string;
  family_id: string;
  original_product_name: string;
  substitute_product_name: string;
  source_message_id?: string | null;
  confidence: number;
  learned_count: number;
  last_used_at: string;
  created_at: string;
}

export type SubscriptionPlanType = 'Monthly' | 'SemiAnnual' | 'Annual';

export interface FamilySubscriptionRecord {
  id: string;
  family_id: string;
  plan_name: SubscriptionPlanType;
  monthly_price_ils: number;
  billing_interval_months: number;
  commitment_months: number;
  starts_at: string;
  ends_at?: string | null;
  is_active: boolean;
  created_at: string;
  annual_first_month_free?: boolean;
}

export type StoreSkinId = 'default' | 'ocean' | 'sunset' | 'midnight';
export type StoreItemCategory = 'skin' | 'feature';

export interface StoreWalletRecord {
  user_id: string;
  family_id: string;
  balance_coins: number;
  created_at: string;
  updated_at: string;
}

export interface StoreWalletTransactionRecord {
  id?: string;
  user_id: string;
  family_id: string;
  direction: 'credit' | 'debit';
  amount_coins: number;
  reason: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface StoreUnlockRecord {
  id: string;
  user_id: string;
  family_id: string;
  item_id: string;
  category: StoreItemCategory;
  skin_id?: StoreSkinId | null;
  unlocked_at: string;
}

export interface StoreUserPreferenceRecord {
  user_id: string;
  family_id: string;
  active_skin: StoreSkinId;
  created_at: string;
  updated_at: string;
}

export interface StoreState {
  coinsBalance: number;
  unlockedItemIds: string[];
  activeSkin: StoreSkinId;
}

export type PaymentCheckoutStatus = 'Pending' | 'Paid' | 'Failed' | 'Expired';
export type PaymentWebhookStatus = 'processed' | 'rejected';

export interface PaymentCheckoutSessionRecord {
  id: string;
  user_id: string;
  family_id: string;
  provider: string;
  provider_reference?: string | null;
  pack_id: 'pack-small' | 'pack-medium' | 'pack-large';
  amount_coins: number;
  amount_ils: number;
  status: PaymentCheckoutStatus;
  created_at: string;
  paid_at?: string | null;
  updated_at: string;
}

export interface PaymentWebhookEventRecord {
  id?: string;
  provider: string;
  provider_event_id: string;
  payload: Record<string, unknown>;
  status: PaymentWebhookStatus;
  processed_at: string;
  created_at?: string;
}
