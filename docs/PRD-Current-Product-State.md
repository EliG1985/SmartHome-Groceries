# SmartHome Groceries — Current Product PRD (As Implemented)

Date: 2026-03-05  
Status: Current-state PRD derived from implementation in frontend, backend, and Supabase schema.

## 1) Product Vision
SmartHome Groceries is a family-centric grocery and pantry management app focused on:
- Shared shopping list and home inventory workflows
- Collaboration between family members (roles, invitations, chat)
- Smart assistance (barcode lookup, price insights, AI-like category/suggestion logic)
- Mobile-first UX with localized Hebrew/English support

## 2) Primary Personas
- Family Owner: manages household, participants, roles, and premium collaboration setup.
- Family Editor: contributes items, messages, and substitute decisions.
- Family Viewer: read-oriented member (blocked from write actions in guarded backend mode).
- Price-conscious shopper: compares selected supermarket basket estimates.

## 3) Product Goals (Current)
- Keep list and pantry synchronized in real-time for family members.
- Minimize input friction (history suggestions, barcode scan, fast add/edit).
- Enable family coordination with media-rich chat.
- Surface spending analytics and supermarket comparison insights.
- Provide a monetization-ready UX foundation via in-app store.

## 4) Scope Snapshot (Current Build)
### Included and Working
- Auth shell (local account fallback + Supabase-backed API mode)
- Shopping list CRUD and batch actions
- Pantry view with expiry signals
- Barcode scanner + Open Food Facts lookup
- Reports with category chart and monthly totals
- Settings with theme, geolocation supermarket suggestions, AI insights
- Family participants management and invitation inbox
- Family chat with:
  - text messages
  - image/file attachments
  - voice recording and audio attachments
  - substitute learning/suggestions
  - signed URL resolution for private storage
- App-wide localization (EN/HE) and RTL handling via language provider
- Unified background skins across screens
- In-app store screen with coin packs and unlockable items (demo/local-only wallet)

### Not Fully Productized Yet
- Real payment processing and secure wallet ledger (store is local demo)
- Server-enforced ownership for store unlocks
- Full production subscription billing lifecycle
- Native mobile IAP integration (Apple/Google billing)

## 5) Feature PRD by Module

## 5.1 Authentication & Session
### Problem
Users need quick sign-in with family context.

### Current Behavior
- Login/register UI with language selector.
- Local mode stores accounts in browser localStorage.
- Backend mode relies on Supabase JWT and users_profile family linkage.
- Session/auth failures trigger logout + session-expired status.

### Requirements Implemented
- Required field validation on auth forms.
- Register supports creating/joining family ID.
- User context in app state includes: id, email, familyId, role, subscriptionTier.

### Known Gaps
- No password reset flow.
- No MFA.
- Local auth is demo-grade only.

## 5.2 Shopping List
### Problem
Families need a quick shared list with category grouping and bulk actions.

### Current Behavior
- Items grouped by category.
- Per-item actions: details toggle, edit, mark purchased, delete.
- Bulk actions when multiple items selected: delete all selected, buy all selected.
- Total list price shown.

### Acceptance Criteria (Current)
- Items render grouped by category.
- Selecting all toggles all list items.
- Mark purchased moves status to At_Home.
- Empty-state text appears when no list items.

## 5.3 Pantry (At Home)
### Problem
Need visibility of in-home stock and expiry urgency.

### Current Behavior
- Expiry tone system: expired, warning (<=48h), ok.
- Per-item actions: details, edit, move back to list.

### Acceptance Criteria (Current)
- Tone changes based on expiry date logic.
- Move-to-list updates item status immediately.

## 5.4 Add/Edit Item Experience
### Problem
Manual item entry is slow and repetitive.

### Current Behavior
- Add modal supports name/category/barcode/qty/price/expiry/status.
- Scanner path can auto-create an item after barcode detection.
- Product name lookup uses Open Food Facts.
- Price estimation uses backend product-price endpoint if available; otherwise synthetic local baseline.
- HistoryInput stores recently used values per field key.

### Acceptance Criteria (Current)
- Add modal validates minimum required fields.
- Edit modal pre-fills current values and saves updates.
- Scan-and-add path closes modal and inserts item.

## 5.5 Reports & Analytics
### Problem
Users need basic spending visibility.

### Current Behavior
- Pie chart of shopping list spend by category.
- Current month vs previous month totals.
- Chart rendering hardened to avoid invalid width/height mounts.

### Acceptance Criteria (Current)
- Chart does not render until measured width > 0.
- Minimum chart height maintained at 260.

## 5.6 Settings + AI Insights
### Problem
Users want market comparison and personalization.

### Current Behavior
- Theme selection (light/dark) via HTML class toggle.
- Preferred supermarket selection with optional geolocation-assisted nearest branches.
- AI insights panel:
  - backend mode: pulls supermarket insight payload from API
  - local mode: computes deterministic baseline insights client-side
- Optional AI category apply action in backend mode.

### Acceptance Criteria (Current)
- Geolocation fallback messages handled.
- Insights panel handles loading/error/data states.
- Category update action refreshes insight dataset.

## 5.7 Family Collaboration (Participants)
### Problem
Families need controlled shared access and invitations.

### Current Behavior
- Member list with role display.
- Owner can update other members’ roles.
- Invite by email flow.
- Pending family invitations list.
- Personal invitation inbox with accept/decline.
- Realtime unread invitation badge in navigation.

### Access Controls
- Viewer blocked from participant management write actions.
- Role changes restricted to owner.
- Premium gate when shared collaboration expands beyond one member.

### Acceptance Criteria (Current)
- Invite creates pending invitation.
- Accepted invitation updates family membership.
- Invitation badge updates via realtime table events.

## 5.8 Family Chat (WhatsApp-like)
### Problem
Families need low-friction coordination around items and substitutes.

### Current Behavior
- Dedicated Chat tab/screen (drawer removed).
- Messaging supports:
  - text
  - image/file attachments
  - voice note recording (MediaRecorder)
  - playback for audio attachments
- Attachment upload to private Supabase bucket.
- Stable storage path in DB + signed URL fetch endpoint.
- Chat substitute learning panel:
  - save substitute decision
  - query learned suggestions
- Realtime new-message updates.
- Toast feedback for send/fail/save actions.

### Acceptance Criteria (Current)
- Message can be sent with text and/or attachments.
- Voice recording can start/stop and produces audio file attachment.
- Attachments render correctly by MIME family (image/audio/link).
- Local mode stores messages and substitutes in browser storage.

## 5.9 In-App Store + Background Skins
### Problem
Need monetization UX and customization primitives.

### Current Behavior
- New Store tab in bottom navigation.
- Coin packages and unlockable catalog (skins + feature unlock cards).
- Wallet and unlocked items persisted locally per user.
- Global background skin applies across app screens (including auth).

### Important Status
- This is demo-mode monetization UX only.
- No real payment provider or backend ledger enforcement yet.

### Acceptance Criteria (Current)
- Buying coin pack increases local coin balance.
- Unlocking deducts coins and records unlock.
- Unlocked skin can be applied globally.

## 6) Navigation & UX Model
- Mobile-first bottom nav tabs: List, Home, Chat, Store, Reports, Participants.
- Settings accessed from sticky header action.
- Desktop behavior:
  - List/Inventory tabs show split panels
  - Other tabs show dedicated panel view

## 7) Localization & Accessibility
- Languages: English + Hebrew.
- RTL support enabled when Hebrew selected.
- Translation dictionary has broad coverage for core features.
- Some hardcoded backend error strings may still surface untranslated.

## 8) Security, Roles, and Plan Gates
- API endpoints protected by Bearer JWT middleware.
- family_id scoping enforced in backend and RLS policies.
- Inventory mutation gates:
  - viewer forbidden
  - shared families require Premium tier
- Collaboration write gates enforce role and plan constraints.

## 9) Data & Realtime Summary
- Core entities: families, users_profile, inventory, family_invitations, chat_messages, chat_message_attachments, product_substitutes, family_subscriptions.
- Realtime currently used for:
  - inventory table updates
  - invitation updates
  - chat message inserts

## 10) Product Health — Current Status
### Strengths
- Broad feature coverage already in code.
- Real-time collaboration foundations are solid.
- Clear separation of frontend/backend/supabase layers.
- Local fallback paths make development resilient.

### Risks / Debt
- Store monetization is local simulation (client-trust risk).
- README has stale endpoint mention for removed auto-invite route.
- Some UI logic remains tightly coupled in App-level tab orchestration.

## 11) Recommended Next Milestones
1. Productionize in-app purchases (backend wallet, transactions, webhook verification).  
2. Add server-driven feature flags/unlock checks for store items.  
3. Introduce e2e test coverage for collaboration + chat media flows.  
4. Add password reset/account recovery and stricter auth UX.  
5. Expand observability and error telemetry for realtime/payload failures.

## 12) Definition of Done (Current PRD Coverage)
This document reflects implemented behavior and known gaps as of the current codebase state. It is suitable for product review, sprint planning, and gap-analysis toward production readiness.

## 13) Implementation Verification Checklist (Audit: 2026-03-07)

Legend: ✅ Implemented · ⚠️ Partial / Demo-grade · ❌ Not implemented

### 13.1 Core Product Modules
- ✅ Auth shell with local fallback + backend token mode
- ✅ Shopping list CRUD, grouping, per-item actions, and bulk actions
- ✅ Pantry expiry tone + move-back-to-list flow
- ✅ Add/Edit modal with validation, barcode scan, Open Food Facts lookup, price estimation path, and HistoryInput
- ✅ Reports pie chart + monthly comparisons + guarded chart mount sizing
- ✅ Settings theme toggle, supermarket preference, geolocation nearby flow, and AI insights panel
- ✅ Participants management, invitations, inbox accept/decline, role updates, and unread realtime badge flow
- ✅ Family chat text + image/file attachments + voice recording + substitute learning/suggestions + signed URL resolution
- ✅ EN/HE localization with RTL behavior
- ✅ Store tab, coin packs, unlock catalog, and global background skin application

### 13.2 Security / Data / Realtime
- ✅ Bearer JWT middleware and auth context binding on backend routes
- ✅ family_id scoping in backend queries and Supabase RLS policies
- ✅ Inventory write gates (viewer forbidden + Premium required for shared families)
- ✅ Collaboration write gates (viewer/owner constraints + Premium checks)
- ✅ Core entities present in schema: families, users_profile, inventory, family_invitations, chat_messages, chat_message_attachments, product_substitutes, family_subscriptions
- ✅ Realtime usage present for inventory, invitations, and chat inserts

### 13.3 Confirmed Gaps (Still Pending)
- ❌ Real payment processing and provider webhook verification
- ❌ Full production subscription billing lifecycle
- ❌ Native mobile IAP (Apple/Google billing)
- ❌ MFA

### 13.4 Notes
- ⚠️ Local auth and store economy remain demo/local-storage grade in local mode by design.
- ⚠️ Some backend-originated error strings may still appear untranslated.
- ⚠️ Password reset/account recovery is now available in auth UI (local password reset + backend reset-link email flow), but MFA is still not implemented.
- ✅ Backend mode now uses server-authoritative store wallet balance, transaction ledger records, unlock ownership checks, and active skin persistence.
- ⚠️ Real payment provider/webhook settlement is still not implemented; coin-pack credit endpoint is demo-mode server flow.
- ✅ Backend now includes checkout session + signed webhook settlement flow (`demo-provider`) with idempotent webhook event recording.
