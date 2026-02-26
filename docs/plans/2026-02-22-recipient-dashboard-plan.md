# Recipient Dashboard — Full Design & Implementation Plan

## Background

ShareBite is a dark-themed food-sharing app (React + TypeScript + Supabase). The donor side has a polished premium UI (#0D0D0D bg, #7DFF12 neon green accent, DM Sans + Roboto Mono fonts, glass cards, spring animations). The recipient side has 3 pages:

| Page | Current State | Route |
|---|---|---|
| RecipientDashboard | Partial — stats + listing cards but missing donor names, broken claim links | /recipient/dashboard |
| BrowseListings | **Stub** ("Coming soon…") | /recipient/browse |
| RecipientProfile | **Stub** ("Coming soon…") | /recipient/profile |

---

## Database (Supabase — `vcvaeyzrnabkhbwhbxgr`)

Key tables and fields used by recipient flows:

- **`profiles`** — `id`, `email`, `role`, `full_name`, `phone`, `avatar_url`, `created_at`
- **`recipient_profiles`** — `id`, `organization_name`, `address`, `location (geography)`, `is_charity`, `created_at`
- **`food_listings`** — `id`, `donor_id`, `title`, `description`, `quantity`, `quantity_unit`, `image_url`, `expiry_time`, `address`, `status (available|claimed|expired)`, `claimed_by`, `claimed_at`, `created_at`
- **`notifications`** — `id`, `recipient_id`, `listing_id`, `type`, `title`, `message`, `read`, `created_at`

---

## Critical Issue: Broken Claim Route

The current claim button links to `/listing/:id`, which **does not exist** in AppRouter.tsx. This is a broken flow for all recipients. The plan resolves this with **inline claiming** (no extra route needed).

---

## Page Plans

---

### 1. RecipientDashboard (`/recipient/dashboard`)

**Purpose:** Overview hub — see impact at a glance + browse fresh food instantly.

**Sections:**

#### A) Top Bar
- Left: `Good [morning/afternoon/evening], {firstName}` (h1) + subtitle `"Find surplus food near you"` (mono, green-tinted)
- Right: `Browse All` button → `/recipient/browse`
- Mobile: same bar but Browse button remains visible (no FAB needed — recipient uses browse page, not create)

#### B) Stats Bento Grid
3-column responsive grid (mobile: 1×3, sm+: 3×1 row)

| Card | Icon | Value | Source | Color |
|---|---|---|---|---|
| Available Now | Radar/signal icon | count of `food_listings` where `status = available AND expiry_time > now()` | green |
| Items Claimed | Checkmark icon | count of `food_listings` where `claimed_by = user.id` | amber |
| Meals Received | Bowl icon | sum of `quantity` for above | blue |

Each card has: top accent line, icon box, large mono value, small uppercase label, hover lift.

#### C) Available Near You (listings preview)
- Section header + "Browse all →" link
- Shows latest 6 `available` listings (non-expired), ordered by `created_at DESC`
- **Joins `profiles.full_name` as donor name** (fix hardcoded "Donor" bug)
- Responsive: single-column on mobile, auto-fill grid on sm+
- Each card shows:
  - Title (truncated)
  - Expiry badge (green normal / amber urgent / red expired)
  - Quantity + unit
  - Donor name
  - Address (with pin icon, truncated)
  - **"Claim Food" button** — inline claim (see Claim Flow below)

#### D) Inline Claim Flow
When user clicks "Claim Food":
1. Button shows loading spinner (optimistic UI)
2. Supabase UPDATE: `food_listings` SET `status = claimed`, `claimed_by = user.id`, `claimed_at = now()` WHERE `id = listing.id AND status = available`
3. On success: card transitions to a "Claimed ✓" success state (green fill, checkmark) — stays in grid briefly then fades out
4. Stats update to reflect new claimed count
5. On failure: button resets, error toast/inline message shown

**No route change. No full-page reload. No missing `/listing/:id` dependency.**

#### E) Skeleton Loading
- 3 skeleton stat cards (shimmer animation)
- 3–6 skeleton listing cards (shimmer)

#### F) Empty State
- SVG illustration + "No food available yet" + "When donors post near you, it shows up here" + Browse All button

---

### 2. BrowseListings (`/recipient/browse`)

**Purpose:** Full food discovery page with search + all active listings.

**Layout:** Single scrollable page with filter bar + grid below.

#### A) Page Header
- Title: "Browse Food" + subtitle "All available donations near you"
- No topbar button (already on this page)

#### B) Filter Bar
- **Search input** — real-time filter by `title` (client-side on loaded data)
- **Sort** — dropdown: "Newest first" | "Expiring soon" | "Most quantity"
- Filters are client-side (no re-fetch) for snappy UX

#### C) Listings Grid
- Fetches ALL `available`, non-expired listings ordered by `created_at DESC`, limit 50
- Joins donor `full_name` from `profiles`
- `auto-fill minmax(300px, 1fr)` responsive grid
- Each card (more detailed than dashboard preview):
  - Food title (large)
  - Description (2-line truncated)
  - Quantity + unit badge
  - Expiry badge with countdown
  - Address with pin icon
  - Donor name + "by" label
  - **"Claim Food" button** — same inline claim flow as dashboard
- Claimed items visually transform to "Claimed ✓" then disappear from list (filter out)

#### D) Empty / No-results state
- If 0 listings: full empty state with illustration + "No food available right now"
- If search yields 0: "No results for '{query}'" + clear search button

#### E) Loading skeleton
- 6 card skeletons in same grid layout

---

### 3. RecipientProfile (`/recipient/profile`)

**Purpose:** Manage personal info, see impact stats, sign out.

**Layout:** Same 2-column card layout as DonorProfile.

#### A) Avatar Card (left)
- Initials avatar (DM Sans bold, green gradient background, ring + glow)
- Full name (h2)
- Email (mono, muted)
- `Recipient` role badge (green pill)
- `Charity` badge if `is_charity = true` (purple pill)
- `Joined {month year}` from `profiles.created_at`
- **Stats row** (2 stats, divider):
  - Items Claimed
  - Meals Received
- Sign Out button (red outline, hover fill)

#### B) Details Card (right)
View mode fields (styled field boxes with icon labels):
- 👤 Full Name
- 📧 Email
- 📞 Phone
- 🏢 Organization Name (optional, for charities)
- 📍 Address
- ✓ Charity Status (badge: Charity / Individual)

Edit mode (same 2-col form grid as DonorProfile):
- Full Name input
- Phone input
- Organization Name input
- Address input + "Find on Map" geocode button
- MapPicker component
- Is Charity toggle (checkbox or toggle switch)
- Save / Cancel buttons

**Data sources:**
- Read: `profiles` (name, email, phone, avatar_url) + `recipient_profiles` (org_name, address, location, is_charity)
- Write: UPDATE both tables on save
- Stats: count/sum from `food_listings WHERE claimed_by = user.id`

---

## Visual Design System (consistent with donor side)

| Token | Value |
|---|---|
| Background | `#0D0D0D` + dot grid + top green glow |
| Card | `rgba(255,255,255,0.025)` bg, `rgba(255,255,255,0.08)` border, `border-radius: 20px` |
| Accent green | `#7DFF12` |
| Accent amber | `#f59e0b` |
| Accent blue | `#3b82f6` |
| Text primary | `#F7F7F7` |
| Text muted | `rgba(247,247,247,0.4)` |
| Font display | `DM Sans` |
| Font mono | `Roboto Mono` |
| Transition | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Animation | `stat-in` / `card-slide-in` / `dp-fade-in` (existing keyframes) |

---

## Implementation Todos

1. **rd-dashboard** — Redesign RecipientDashboard.tsx + RecipientDashboard.css
2. **rd-browse** — Build BrowseListings.tsx + BrowseListings.css from scratch
3. **rd-profile** — Build RecipientProfile.tsx + RecipientProfile.css from scratch
4. **rd-validate** — Run `npm run type-check` and fix all type errors

---

## What is NOT in scope

- A dedicated `/listing/:id` listing detail page (claim is inline)
- Map-based proximity filtering (uses Supabase PostGIS — deferred)
- Push notifications (deferred)
- Pagination beyond 50 listings (deferred)
