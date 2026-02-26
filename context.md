# ShareBite Project Context — Complete Status Reference

> **Last Updated**: February 23, 2026
> **Purpose**: Full project memory for AI assistants. Read this before touching any code.

---

## 📋 PROJECT OVERVIEW

**ShareBite** is a surplus food redistribution platform connecting restaurants/cafés (donors) with charities and individuals (recipients). Real-time geolocation matching ensures surplus food reaches people before it expires.

---

## 🛠️ TECHNOLOGY STACK

| Layer | Tech |
|---|---|
| Framework | React 19.2.0 + TypeScript 5.9.3 |
| Build | Vite 7.2.4 |
| Routing | React Router v7.6.2 |
| State | React Context API |
| Styling | Plain CSS (per-component .css files, no CSS Modules) |
| Backend | Supabase (PostgreSQL 17 + PostGIS + Auth + Storage) |
| Maps | Google Maps JS API via `@googlemaps/js-api-loader` |
| Fonts | Syne (display) + DM Mono (monospace) from Google Fonts |

### Path aliases (vite.config.ts)
```
@components → src/components
@pages      → src/pages
@services   → src/services
@hooks      → src/hooks
@contexts   → src/contexts
@utils      → src/utils
@types      → src/types
@styles     → src/styles
@lib        → src/lib
@            → src
```

---

## 🗄️ SUPABASE CONFIGURATION

- **Project ID**: `vcvaeyzrnabkhbwhbxgr`
- **URL**: `https://vcvaeyzrnabkhbwhbxgr.supabase.co`
- **Region**: ap-northeast-1 (Tokyo)
- **Anon Key**: in `.env` / `.env.local` as `VITE_SUPABASE_ANON_KEY`
- **Google Maps Key**: in `.env` / `.env.local` as `VITE_GOOGLE_MAPS_API_KEY`

### Database Tables

| Table | Key Columns | Notes |
|---|---|---|
| `profiles` | id (→auth.users), email, role (donor\|recipient), full_name, phone, avatar_url | Auto-created by `handle_new_user` trigger |
| `donor_profiles` | id (→profiles), organization_name, organization_type (enum), address, location (geography), contact_person, is_verified | Created during ProfileSetup |
| `recipient_profiles` | id (→profiles), organization_name, address, location (geography), is_charity | Created during ProfileSetup |
| `food_listings` | donor_id, title, description, quantity, quantity_unit, image_url, expiry_time, location (geography), address, status (enum), claimed_by, claimed_at | status: available\|claimed\|expired |
| `notifications` | recipient_id, listing_id, type, title, message, read | Realtime enabled |
| `daily_stats` | date, total_listings, claimed_listings, expired_listings, donors_active, recipients_active, meals_shared, food_saved_kg | Analytics |
| `user_activity` | user_id, action, metadata, ip_address | Activity log |

### Location Storage Pattern
All location columns are `geography(Point, 4326)`. Written as WKT:
```ts
`SRID=4326;POINT(${longitude} ${latitude})`   // NOTE: lng first, then lat
```

### Custom Database Functions (RPCs)

| Function | Purpose |
|---|---|
| `handle_new_user()` | Trigger: auto-creates `profiles` row on auth signup |
| `update_updated_at()` | Trigger: updates `updated_at` on all tables |
| `get_donor_profile(p_user_id uuid)` | Returns full donor profile + lat/lng extracted via ST_X/ST_Y as JSON |
| `get_recipient_profile(p_user_id uuid)` | Returns full recipient profile + lat/lng extracted via ST_X/ST_Y as JSON |
| `get_listings_with_distance(p_lat, p_lng, p_radius_m, p_limit)` | PostGIS nearby listings via ST_DWithin + ST_Distance; returns rows with lat, lng, distance_m |
| `get_nearby_listings(...)` | Older nearby listings function (superseded by get_listings_with_distance) |
| `expire_old_listings()` | Marks past-expiry listings as expired |
| `notify_nearby_recipients()` | Trigger: notifies nearby recipients when listing created |
| `donor_profiles_latitude/longitude` | Computed column helpers (NOT used — PostgREST embedded join bug) |
| `recipient_profiles_latitude/longitude` | Computed column helpers (NOT used — PostgREST embedded join bug) |

### ⚠️ Critical PostgREST Gotcha
PostgREST computed columns (`table_column(row_type)` functions) **only work on top-level queries**, NOT inside embedded joins (`table!fk(...)`). Attempting `donor_profiles!id(latitude, longitude)` fails with `column donor_profiles_1.latitude does not exist`.

**Fix applied**: Use the `get_donor_profile` / `get_recipient_profile` RPCs instead — they join and extract coords in SQL directly.

### Storage Buckets
- `listing-images` — public read, authenticated upload. Used by `imageService.ts`.

### Applied Migrations (in order)
1. `create_listing_images_bucket`
2. `create_nearby_listings_rpc_v2`
3. `create_notification_trigger`
4. `add_computed_lat_lng_columns` (functions exist but unused due to PostgREST bug above)
5. `get_listings_with_distance_rpc`
6. `get_profile_with_coords_rpc` ← most recent, adds `get_donor_profile` + `get_recipient_profile`

---

## 📁 FILE STRUCTURE (Current)

```
src/
├── assets/                         # Images + video for landing page
├── components/
│   ├── auth/                       # Login, RoleToggle, FormField
│   ├── common/                     # Button, Input, Card, StatsCard, MapPicker
│   ├── dashboard/                  # DashboardLayout, DashboardHeader, Sidebar
│   ├── features/                   # Hero, HowItWorks, WhyShareBite
│   └── layout/                     # Header, Footer, MainLayout
├── contexts/
│   └── AuthContext.tsx             # Auth state + user profile loading
├── hooks/
│   └── index.ts                    # Re-exports useAuth
├── lib/
│   └── googleMaps.ts               # Singleton Google Maps loader (importLibrary helper)
├── pages/
│   ├── HomePage.tsx/css            # Landing page
│   ├── NotFoundPage.tsx            # 404
│   ├── ProfileSetup.tsx/css        # Post-registration profile completion (both roles)
│   ├── auth/
│   │   ├── LoginPage               # Login form
│   │   ├── RegisterPage            # Registration with role toggle
│   │   ├── VerifyEmail             # Email verification holding page
│   │   ├── AuthSuccess             # Post-registration success
│   │   └── ForgotPassword          # Password reset (form connected to Supabase)
│   ├── donor/
│   │   ├── DonorDashboard          # Stats cards + recent listings table + real Supabase data
│   │   ├── CreateListing           # Full form: title/desc/qty/expiry + Google Maps address picker + GPS
│   │   ├── MyListings              # All donor listings with status filter + edit/delete
│   │   └── DonorProfile            # Profile editor via get_donor_profile RPC
│   └── recipient/
│       ├── RecipientDashboard      # Stats + nearby listings preview via get_listings_with_distance RPC
│       ├── BrowseListings          # Full browse: list/map view, nearby/all filter, sort, claim
│       └── RecipientProfile        # Profile editor via get_recipient_profile RPC
├── router/
│   └── AppRouter.tsx               # Protected routes, role-based redirects, DashboardLayout wrappers
├── services/
│   ├── api.ts                      # Supabase client + apiRequest wrapper
│   ├── authService.ts              # register, login, logout, getCurrentUser, onAuthStateChange
│   ├── profileService.ts           # getDonorProfile/getRecipientProfile (via RPC), updateDonorProfile/updateRecipientProfile
│   ├── listingService.ts           # Full CRUD: getDonorStats, getDonorListings, getMyListings, createListing, updateListing, deleteListing, claimListing, getListingsWithDistance, getListingById
│   ├── imageService.ts             # Supabase Storage upload for listing images
│   ├── notificationService.ts      # Notifications CRUD + Realtime subscription
│   └── geolocationService.ts       # Browser Geolocation API wrapper
├── styles/
│   ├── design-tokens.css           # CSS variables (colors, spacing, etc.)
│   └── global.css                  # Global base styles
├── types/
│   └── index.ts                    # Shared TypeScript interfaces
└── utils/
    ├── constants.ts                # ROUTES, API config
    ├── formatters.ts               # Date/time utilities
    └── validators.ts               # Email, password validation
```

---

## ✅ COMPLETED FEATURES

### Authentication & Routing
- Register (donor or recipient role), Login, Logout, ForgotPassword, VerifyEmail
- `AuthContext` loads full profile from `get_donor_profile` / `get_recipient_profile` RPCs
- `ProtectedRoute` wrapper — redirects unauthenticated users to `/login`
- `ProtectedRoute` with `requiredRole` — wrong-role users redirected to their dashboard
- After registration, redirects to `/profile-setup` until `hasCompletedProfile` is true
- `isProfileLoading` flag prevents flash-redirect to profile setup on page reload

### Profile Setup (`/profile-setup`)
- Single page handles both donor and recipient roles
- Donor: organization name, type (restaurant/café/bakery/etc.), contact person, address, location (Google Maps)
- Recipient: full name, phone, organization name (optional), address, is_charity toggle
- On submit: creates `donor_profiles` or `recipient_profiles` row + sets flag in `profiles`
- Google Maps address autocomplete (classic `Autocomplete` API on native `<input>`)
- "Use my location" GPS button with reverse geocoding
- Map preview with draggable marker for precise location

### Google Maps Integration (`src/lib/googleMaps.ts`)
- Singleton loader pattern using `@googlemaps/js-api-loader`
- `importLibrary(name)` helper — returns the requested library; handles one-time init
- Used in: CreateListing, ProfileSetup, BrowseListings (MapView)
- Classic `google.maps.places.Autocomplete` on native `<input>` (NOT PlaceAutocompleteElement web component — that had Shadow DOM issues)
- No `types` restriction → returns all location types (streets, buildings, universities, etc.)
- Combines `place.name + place.formatted_address` for named establishments

### Donor Dashboard (`/donor/dashboard`)
- Real stats from Supabase: total listings, active, claimed, meals shared
- Recent listings table with status badges
- Quick action buttons to Create Listing, My Listings, Profile

### Create Listing (`/donor/create-listing`)
- Form: title, description, quantity + unit, expiry date/time, image upload
- Address search with Google Maps `Autocomplete` + draggable map pin
- GPS "Use my location" button with spinner state
- Image upload to Supabase Storage (`listing-images` bucket) via `imageService`
- Writes location as `SRID=4326;POINT(lng lat)` WKT to PostGIS

### My Listings (`/donor/my-listings`)
- All listings with status filter (all / available / claimed / expired)
- Card grid with image thumbnails, expiry badge, status badge
- Edit modal (inline) and soft-delete (sets status to `expired`)

### Donor Profile (`/donor/profile`)
- Loads via `get_donor_profile` RPC (returns lat/lng correctly)
- Edits organization name, type, contact person, address, location
- Location picker with Google Maps + GPS button

### Recipient Dashboard (`/recipient/dashboard`)
- Stats: available listings count, items claimed, meals received
- Preview grid of up to 6 nearby listings via `get_listings_with_distance` RPC
  - Uses recipient's saved location (10 km radius) if set; falls back to newest
- Claim button inline with optimistic state update

### Browse Listings (`/recipient/browse`)
- **View toggle**: List view / Map view
- **Filter toggle**: Nearby (10 km) / All Available
  - Nearby disabled with tooltip if no location saved in recipient profile
  - Falls back to "All" automatically if no location
- **Sort**: Closest first / Expiring soon / Newest first
- **Search**: Text filter on title + address
- **List view**: Card grid with image, expiry badge, distance badge, quantity, Claim button; confirm modal before claim
- **Map view**: Google Maps dark theme, green circle markers per listing, blue circle for user location; click marker → info panel slides up (bottom sheet on mobile, floating card on desktop ≥768px); panel shows image, badges, title, donor, address, description, Claim button
- All distances via `get_listings_with_distance` PostGIS RPC (real ST_Distance in metres)
- Claimed listings removed from view optimistically

### Recipient Profile (`/recipient/profile`)
- Loads via `get_recipient_profile` RPC
- Edits full name, phone, organization name, address, location, is_charity
- Same Google Maps + GPS pattern as donor profile

---

## 🏗️ KEY ARCHITECTURAL PATTERNS

### apiRequest wrapper (`src/services/api.ts`)
All service methods wrap calls in `apiRequest(async () => {...})` which:
- Returns `{ success: true, data }` or `{ success: false, error: string }`
- Logs errors to console in dev
- Never throws to the caller

### Profile reads always use RPCs
```ts
// ✅ CORRECT — uses get_donor_profile RPC
const { data } = await supabase.rpc('get_donor_profile', { p_user_id: userId });

// ❌ BROKEN — PostgREST embedded join bug with computed columns
const { data } = await supabase.from('profiles').select(`donor_profiles!id(latitude, longitude)`);
```

### Location write pattern
```ts
// Always: SRID=4326;POINT(longitude latitude)  ← longitude FIRST
const locationWKT = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
await supabase.from('donor_profiles').update({ location: locationWKT });
```

### Google Maps address input pattern
Use classic `Autocomplete` (NOT `PlaceAutocompleteElement`):
```tsx
const ac = new Autocomplete(inputRef.current, { fields: ['name', 'formatted_address', 'geometry'] });
ac.addListener('place_changed', () => {
    const place = ac.getPlace();
    const name = place.name ?? '';
    const fmtAddr = place.formatted_address ?? '';
    const addr = name && !fmtAddr.startsWith(name) ? `${name}, ${fmtAddr}` : fmtAddr;
    setLat(place.geometry.location.lat());
    setLng(place.geometry.location.lng());
});
```

### get_listings_with_distance RPC
```ts
// p_lat / p_lng = null → no distance filter, sorted by expiry
// p_radius_m = null → no radius cap (all listings)
// p_radius_m = 10000 → only within 10 km
const result = await listingService.getListingsWithDistance(lat, lng, radiusMeters, limit);
// Returns EnhancedListing[] with: id, title, description, quantity, quantityUnit,
//   expiryTime, address, imageUrl, donorName, lat, lng, distanceM
```

---

## 🎨 DESIGN SYSTEM

**Aesthetic**: Carbon Grid / Dark Industrial — #0D0D0D background, dot-grid texture, #7DFF12 (electric green) accent, Syne + DM Mono fonts.

**CSS Variables** (defined in `design-tokens.css`):
- Background: `#0D0D0D`, `#141414`, `#1a1a1a`
- Text: `#F7F7F7`, `rgba(247,247,247,0.5)`, `rgba(247,247,247,0.35)`
- Accent: `#7DFF12` (electric green)
- Danger: `#f87171`
- Warning: `#f59e0b`
- Blue: `#60a5fa`

**Animation conventions**:
- Page load: `fade-in 0.4s ease` + staggered `animation-delay` per card
- Cards: `card-in 0.4s cubic-bezier(0.16,1,0.3,1) both`
- Skeletons: `shimmer 1.4s infinite` gradient sweep
- Spinner: `spin 0.75s linear infinite` on SVG

---

## ⚠️ KNOWN ISSUES / LIMITATIONS

1. **Computed column PostgREST bug**: `donor_profiles_latitude/longitude` functions exist in DB but cannot be used inside embedded joins. Always use the `get_donor_profile` / `get_recipient_profile` RPCs for reading profiles with coordinates.

2. **Notifications not wired to UI**: `notificationService.ts` exists with Realtime support, but no notification bell/badge is shown in `DashboardHeader` yet.

3. **ForgotPassword**: Form exists and calls Supabase `resetPasswordForEmail` but the redirect-back flow after clicking the email link is not fully handled.

4. **No listing detail page**: `listingService.getListingById` exists but there is no `/listing/:id` route/page yet.

5. **No analytics dashboard**: `daily_stats` table exists; no UI.

6. **`get_nearby_listings` RPC**: Older function, superseded by `get_listings_with_distance`. Not called anywhere in frontend code.

---

## ❌ NOT YET BUILT

- Notification badge + dropdown in DashboardHeader
- Listing detail page (`/listing/:id`)
- Analytics / admin dashboard
- Email notifications
- In-app messaging
- Rating / review system
- PWA / offline support
- Donor verification flow
- Scheduled listings (post for future time)

---

## 🔗 ROUTES

| Path | Component | Auth |
|---|---|---|
| `/` | HomePage | Public |
| `/login` | LoginPage | Public |
| `/register` | RegisterPage | Public |
| `/verify-email` | VerifyEmail | Public |
| `/auth/success` | AuthSuccess | Public |
| `/forgot-password` | ForgotPassword | Public |
| `/profile-setup` | ProfileSetup | Auth (no profile required) |
| `/donor/dashboard` | DonorDashboard | Auth + donor role |
| `/donor/create-listing` | CreateListing | Auth + donor role |
| `/donor/my-listings` | MyListings | Auth + donor role |
| `/donor/profile` | DonorProfile | Auth + donor role |
| `/recipient/dashboard` | RecipientDashboard | Auth + recipient role |
| `/recipient/browse` | BrowseListings | Auth + recipient role |
| `/recipient/profile` | RecipientProfile | Auth + recipient role |
| `*` | NotFoundPage | Public |

---

## 💡 QUICK REFERENCE — COMMON PITFALLS

1. **Never use embedded join to read lat/lng** — use `get_donor_profile` / `get_recipient_profile` RPCs
2. **Location WKT is `POINT(lng lat)` not `POINT(lat lng)`** — longitude goes first
3. **Use `apiRequest` wrapper in all service methods** — never throw to caller directly
4. **Use path aliases everywhere** (`@services/...` not `../../services/...`)
5. **Google Maps: use classic `Autocomplete`** not `PlaceAutocompleteElement` (Shadow DOM issues)
6. **`isProfileLoading` check** in `ProtectedRoute` prevents flash-redirect on reload
7. **Soft delete** on listings sets `status = 'expired'`, never actually deletes the row

---

## 🔧 DEV COMMANDS

```bash
npm run dev          # localhost:5173
npm run build        # Production build
npm run type-check   # tsc --noEmit
npm run lint         # ESLint
npm run format       # Prettier
```

---

**END OF CONTEXT FILE**
*Update this file whenever major features are completed, bugs are fixed, or architectural decisions change.*
