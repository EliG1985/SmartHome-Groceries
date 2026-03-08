export type SubscriptionTier = 'Free' | 'Premium';
export type InventoryStatus = 'In_List' | 'At_Home';

export interface AppUser {
  id: string;
  email: string;
  familyId: string;
  role: 'owner' | 'editor' | 'viewer';
  subscriptionTier: SubscriptionTier;
}

export interface InventoryItem {
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
  purchased_at?: string;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  family_id: string;
  sender_user_id: string;
  sender_name?: string;
  body: string;
  image_path?: string;
  image_url?: string;
  kind: 'message' | 'decision' | 'system';
  related_product_name?: string;
  substitute_for?: string;
  created_at: string;
  attachments?: Array<{
    id: string;
    message_id: string;
    family_id: string;
    storage_path: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    created_at: string;
  }>;
}

export interface FamilyMember {
  id: string;
  email: string;
  full_name?: string;
  family_name?: string;
  role: 'owner' | 'editor' | 'viewer';
  subscription_tier: SubscriptionTier;
  family_id: string;
  created_at: string;
}

export interface FamilyInvitation {
  id: string;
  family_id: string;
  inviter_user_id: string;
  invitee_user_id?: string;
  invitee_email?: string;
  invitee_family_name?: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  created_at: string;
  responded_at?: string;
}

export interface ProductSubstituteSuggestion {
  id: string;
  family_id: string;
  original_product_name: string;
  substitute_product_name: string;
  confidence: number;
  learned_count: number;
  last_used_at: string;
}

export interface CollaborationSubscriptionStatus {
  memberCount: number;
  requiresPaidPlan: boolean;
  monthlyPriceIls: number;
  commitmentMonths: number;
  subscription?: {
    is_active: boolean;
    plan_name: string;
  };
}

export type BackgroundSkin = 'default' | 'ocean' | 'sunset' | 'midnight';

export type AppTab = 'list' | 'inventory' | 'chat' | 'store' | 'reports' | 'participants' | 'settings';
