# SmartHome Groceries (MVP 1.0)

Professional monorepo structure with separate frontend and backend applications.

## Project structure

- `apps/frontend`: React + Vite + Tailwind + Redux Toolkit client
- `apps/backend`: Express + TypeScript API layer
- `apps/mobile`: Expo React Native app for iOS + Android
- `supabase/schema.sql`: database schema + RLS policies

## Implemented MVP scope

- Shared shopping list with CRUD-ready data flow and category grouping.
- Move purchased products from list to home inventory.
- Smart pantry with expiry status signals (expired / 48h warning / normal).
- One-click "Move to List" from pantry.
- Barcode scanner (`html5-qrcode`) + Open Food Facts product lookup.
- Analytics panel with pie chart by category and monthly comparison.
- Mobile-first bottom navigation + desktop split view (list left / pantry right).

## Tech stack

- Frontend: React + Vite + Tailwind CSS
- State: Redux Toolkit
- Backend: Supabase (with local fallback mode when env keys are missing)
- Charts: Recharts
- Icons: Lucide React

## Run locally (full stack)

1. Install dependencies at root:

```bash
npm install
```

2. Create `.env` from `.env.example` and add:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=http://localhost:4000
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=4000
SUPERMARKET_PRICING_API_URL=...
GEOAPIFY_API_KEY=...
```

3. Start frontend + backend together:

```bash
npm run dev
```

4. Build both apps:

```bash
npm run build
```

## Run mobile app (React Native)

1. Start Expo app:

```bash
npm run dev:mobile
```

2. Open on Android emulator/device:

```bash
npm run mobile:android
```

3. Open on iOS simulator (macOS required):

```bash
npm run mobile:ios
```

4. Mobile app expects backend API URL from Expo public env:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

5. Store builds (Expo EAS):

```bash
cd apps/mobile
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
npx eas submit --platform ios --profile production
npx eas submit --platform android --profile production
```

## Supabase setup

- Run SQL from `supabase/schema.sql`.
- Enable Realtime for `public.inventory` table in Supabase dashboard.
- Enable Realtime for `public.chat_messages` table in Supabase dashboard.
- Ensure authenticated users have matching rows in `users_profile`.
- Apply the storage bucket/policies from `supabase/schema.sql` for `chat-images` uploads.
- Run the URL normalization update in `supabase/schema.sql` once to migrate legacy `chat_messages.image_url` values to `storage:chat-images/...` format.

## API endpoints (backend)

- `GET /health`
- `GET /api/inventory`
- `POST /api/inventory`
- `PATCH /api/inventory/:id/status`
- `DELETE /api/inventory/:id`
- `GET /api/reports/summary`
- `GET /api/reports/supermarket-insights?supermarket=<name>`
- `GET /api/reports/nearby-supermarkets?latitude=<lat>&longitude=<lon>&radiusKm=<radius>`
- `GET /api/collaboration/participants`
- `GET /api/collaboration/me`
- `POST /api/collaboration/participants/invite-by-email`
- `PATCH /api/collaboration/participants/:memberId/role`
- `GET /api/collaboration/my-invitations`
- `POST /api/collaboration/my-invitations/:id/respond`
- `GET /api/collaboration/chat/messages?limit=100`
- `POST /api/collaboration/chat/messages`
- `GET /api/collaboration/substitutes/suggestions?productName=<name>`
- `POST /api/collaboration/substitutes/learn`
- `GET /api/collaboration/subscription-status`
- `GET /api/store/state`
- `POST /api/store/coins/purchase`
- `POST /api/store/unlock`
- `POST /api/store/skins/apply`
- `POST /api/payments/checkout/session`
- `POST /api/payments/webhooks/demo-provider`
- `POST /api/payments/webhooks/demo-provider/sign`

Shared inventory mutations (`POST/PATCH/DELETE /api/inventory`) now enforce role + plan gates:
- `viewer` cannot mutate inventory.
- when family member count is greater than 1, mutations require `Premium` tier.

The frontend now listens to Realtime changes on `family_invitations` for the signed-in user/email,
shows unread invitation count in the Participants nav tab, and refreshes auth family/role immediately after accepting an invitation.

Phase 4 updates:
- Chat opens in a right-side slide-in fullscreen drawer from Shopping List and closes back with one click.
- Chat image attachments are compressed client-side before upload and stored in private `chat-images` bucket.
- Chat stores stable `image_path` references in DB.
- Image display uses backend-batched signed URL resolution (`POST /api/collaboration/chat/image-urls`) and periodic refresh.
- Messages support multiple attachments via `chat_message_attachments` table (files + photos).
- Unread chat badge is shown on the List tab using chat last-seen tracking + Realtime inserts.
- Lightweight toast notifications are shown for collaboration actions.

Surname-based auto-invite matching was removed to avoid inviting unrelated users with the same last name.

All `/api/*` endpoints require `Authorization: Bearer <jwt>` and enforce family scope from `users_profile.family_id`.

`/api/reports/supermarket-insights` returns basket comparison and AI-style recommendations for the selected supermarket.
When `SUPERMARKET_PRICING_API_URL` is configured, the backend attempts to fetch live unit prices from that provider;
otherwise it falls back to internal baseline estimates and marks the response accordingly.

`/api/reports/nearby-supermarkets` uses `GEOAPIFY_API_KEY` as primary provider (free-tier friendly for POC) and automatically falls back to Overpass when Geoapify is unavailable.

Store/payment updates:
- In backend mode, wallet balance and unlock ownership are server-authoritative.
- Coin purchase flow supports checkout-session + webhook settlement (`demo-provider`) with signature verification.
- Webhook signature uses `x-smarthome-signature` generated with `PAYMENT_WEBHOOK_SECRET`.
- Demo UX is preserved: coin purchase remains one-click in app, with backend settlement flow behind the scenes.

## Roadmap alignment

- Sprint 1: project setup + auth shell + family support basis
- Sprint 2: shopping list + categories + real-time updates
- Sprint 3: expiry tracking + analytics reports
- Sprint 4: barcode camera integration + responsive UX
