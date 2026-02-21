# ShareBite Full Dashboard Design

> **Approved**: 2026-02-22

## Goal
Build all 7 remaining placeholder pages/features into production-ready, fully functional implementations connected to real Supabase data.

## Architecture
Parallel agent team. Each agent owns one domain. Shared service layer (listingService, notificationService, profileService) built first by a dedicated agent, then page agents consume it. Carbon Grid design system throughout (already established).

## Tech Stack
- React 19, TypeScript strict, Vite 7
- Supabase (PostgreSQL + PostGIS + Storage + Realtime)
- Mapbox GL JS (maps, geocoding)
- CSS Modules, design-tokens.css, Carbon Grid aesthetic
- Path aliases: @components, @services, @pages, @hooks, @utils

---

## DB Additions Required (via MCP SQL)

### 1. Supabase Storage bucket: `listing-images`
- Public read, authenticated write
- Max file size: 5MB
- Allowed MIME: image/jpeg, image/png, image/webp

### 2. PostGIS RPC: `get_nearby_listings`
```sql
CREATE OR REPLACE FUNCTION get_nearby_listings(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_meters FLOAT DEFAULT 10000
)
RETURNS TABLE (
  id UUID, title TEXT, description TEXT,
  quantity INTEGER, quantity_unit TEXT,
  image_url TEXT, expiry_time TIMESTAMPTZ,
  address TEXT, status TEXT,
  donor_id UUID, donor_name TEXT,
  distance_meters FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fl.id, fl.title, fl.description,
    fl.quantity, fl.quantity_unit,
    fl.image_url, fl.expiry_time,
    fl.address, fl.status::TEXT,
    fl.donor_id,
    COALESCE(dp.organization_name, p.full_name) as donor_name,
    ST_Distance(fl.location, ST_Point(user_lng, user_lat)::geography) as distance_meters
  FROM food_listings fl
  JOIN profiles p ON p.id = fl.donor_id
  LEFT JOIN donor_profiles dp ON dp.id = fl.donor_id
  WHERE fl.status = 'available'
    AND fl.expiry_time > NOW()
    AND ST_DWithin(fl.location, ST_Point(user_lng, user_lat)::geography, radius_meters)
  ORDER BY distance_meters ASC
  LIMIT 50;
$$;
```

### 3. Notification trigger on listing insert
```sql
CREATE OR REPLACE FUNCTION notify_nearby_recipients()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO notifications (recipient_id, listing_id, type, title, message)
  SELECT
    rp.id,
    NEW.id,
    'new_listing',
    'New food available nearby!',
    COALESCE(dp.organization_name, p.full_name) || ' just posted: ' || NEW.title
  FROM recipient_profiles rp
  JOIN profiles p ON p.id = rp.id
  JOIN profiles donor_p ON donor_p.id = NEW.donor_id
  LEFT JOIN donor_profiles dp ON dp.id = NEW.donor_id
  WHERE ST_DWithin(rp.location, NEW.location, 10000)
    AND rp.id != NEW.donor_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_listing_created
  AFTER INSERT ON food_listings
  FOR EACH ROW EXECUTE FUNCTION notify_nearby_recipients();
```

---

## Pages & Components

### 1. Create Listing (`/donor/create-listing`)
Multi-step form (3 steps):
- **Step 1 — Food Details**: title, description, quantity (number), unit (select: servings/kg/portions/items), food category tag
- **Step 2 — Time & Location**: expiry datetime picker, address (pre-filled from donor profile), MapPicker to adjust pin
- **Step 3 — Photo & Review**: drag-drop image upload (preview), review all details, submit

On submit: upload image to `listing-images/{userId}/{uuid}.jpg` → get public URL → insert `food_listings` row.
On success: redirect to `/donor/listings` with success toast.

### 2. My Listings (`/donor/listings`)
- Filter tabs: All / Active / Claimed / Expired
- Card grid (not table): each card has thumbnail (or placeholder), title, quantity+unit, expiry countdown, status pill
- Card actions: Edit (modal), Delete (confirm dialog), Mark Expired
- Empty state with CTA to create first listing
- Real-time status updates via Supabase Realtime

### 3. Donor Profile (`/profile`)
- Display: org name, org type badge, contact person, address, phone
- Edit mode (toggle): inline form for all fields, MapPicker for location
- Saves to `donor_profiles` + `profiles` (phone, full_name)
- Destructive: sign out button

### 4. Browse Listings (`/recipient/browse`)
- Dual view toggle: Card Grid / List
- Search bar: filter by title keyword
- Radius slider: 1km → 50km
- Sort: Nearest / Expiring Soon / Newest
- Each card: food photo, title, quantity, expiry badge (red if <2h), donor org, distance, "Claim" button
- Claim flow: optimistic UI → confirm modal → update DB → show success toast
- Empty state (no nearby food)

### 5. Recipient Profile (`/recipient/profile`)
- Display: name, address, charity badge (if is_charity)
- Edit mode: name, address + MapPicker, charity toggle
- Saves to `recipient_profiles` + `profiles`
- Sign out button

### 6. Notifications (DashboardHeader bell)
- Supabase Realtime subscription on `notifications` where `recipient_id = userId`
- Bell icon with unread count badge (green dot or number)
- Click → dropdown panel: last 10 notifications, each with icon, title, message, time-ago
- "Mark all as read" button
- Each notification clickable → navigate to listing detail
- Works for both donor (claim confirmed) and recipient (new food nearby)

### 7. Listing Detail (`/listing/:id`)
- Public route (no auth required to view)
- Large hero image (or placeholder)
- Title, description, quantity, unit, expiry time (with countdown)
- Donor org name + type badge
- Address + Mapbox static map preview
- For recipients: "Claim This Food" button (auth required)
- For donors: status badge, claimed by info if claimed
- Back navigation

---

## Services to Build/Extend

### listingService additions:
- `createListing(data, imageFile?)` — upload image, insert row
- `getMyListings(userId, status?)` — donor's own listings, filtered
- `updateListing(id, data)` — edit listing
- `deleteListing(id)` — set status = 'expired'
- `getListingById(id)` — full details with donor info
- `getNearbyListings(lat, lng, radiusMeters)` — via PostGIS RPC

### notificationService.ts (new file):
- `getNotifications(userId)` — fetch last 20
- `markAllRead(userId)` — update read=true
- `markOneRead(id)` — single notification
- `subscribeToNotifications(userId, callback)` — Realtime channel

### profileService.ts (new file):
- `getDonorProfile(userId)` — join profiles + donor_profiles
- `updateDonorProfile(userId, data)` — update both tables
- `getRecipientProfile(userId)` — join profiles + recipient_profiles
- `updateRecipientProfile(userId, data)` — update both tables
- `uploadAvatar(userId, file)` — Storage upload

### imageService.ts (new file):
- `uploadListingImage(userId, file)` — upload to listing-images bucket, return public URL
- `deleteListingImage(url)` — delete from storage

---

## Design System (Carbon Grid — already established)
- Background: `#0D0D0D` with 28px dot-grid pattern
- Accent: `#7DFF12`
- Font headings: `Syne`
- Font mono/stats: `DM Mono`
- Cards: `rgba(255,255,255,0.03)` bg, `1px solid rgba(255,255,255,0.08)` border
- Hover: green left border glow `#7DFF12`
- All new pages match existing DonorDashboard/RecipientDashboard style

---

## Agent Assignment Plan

| Agent | Owns |
|-------|------|
| db-agent | Storage bucket + PostGIS RPC + notification trigger via MCP SQL |
| service-agent | listingService extensions + notificationService + profileService + imageService |
| create-listing-agent | CreateListing page (3-step form + image upload) |
| my-listings-agent | MyListings page + EditListingModal + DeleteConfirm |
| browse-agent | BrowseListings page + claim flow |
| profile-agent | DonorProfile + RecipientProfile pages |
| notifications-agent | Notifications bell + dropdown + Realtime in DashboardHeader |
| detail-agent | ListingDetail page + AppRouter wiring |
