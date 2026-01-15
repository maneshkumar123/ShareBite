# ShareBite Phase 2: Database Schema & Supabase Setup

## Overview

This plan covers the complete Supabase database setup including:
- Database schema (.sql file ready to run)
- Storage bucket configuration for food images
- Row Level Security (RLS) policies
- Realtime subscriptions for notifications
- Environment configuration for local dev + Vercel deployment

---

## Current State Summary

**Completed (Phase 1):**
- Landing page: Hero, HowItWorks, WhyShareBite, Footer
- Auth pages: Login, Register (with Donor/Recipient role toggle)
- Routing: React Router with persistent layout
- Types defined: User, FoodListing, Notification, Location
- Services structure: authService, listingService, geolocationService (stubs)

**Design Decisions Confirmed:**
- Two roles: `donor` and `recipient` (charities = recipients with `is_charity: true`)
- Claim-only workflow (no pickup confirmation needed)
- Real-time notifications using Supabase Postgres Changes
- Image uploads for food listings using Supabase Storage
- Basic analytics tables included

---

## Database Schema

### File: `supabase/schema.sql`

```sql
-- ============================================
-- SHAREBITE DATABASE SCHEMA
-- Supabase PostgreSQL
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('donor', 'recipient');
CREATE TYPE listing_status AS ENUM ('available', 'claimed', 'expired');
CREATE TYPE organization_type AS ENUM ('restaurant', 'cafe', 'grocery', 'bakery', 'catering', 'other');

-- ============================================
-- PROFILES TABLE
-- Links to Supabase auth.users
-- ============================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role user_role NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DONOR PROFILES (Extension of profiles)
-- ============================================

CREATE TABLE donor_profiles (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    organization_name TEXT NOT NULL,
    organization_type organization_type NOT NULL,
    address TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    contact_person TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RECIPIENT PROFILES (Extension of profiles)
-- ============================================

CREATE TABLE recipient_profiles (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    organization_name TEXT,
    address TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    is_charity BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOOD LISTINGS
-- ============================================

CREATE TABLE food_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    quantity_unit TEXT NOT NULL DEFAULT 'servings',
    image_url TEXT,
    expiry_time TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT NOT NULL,
    status listing_status DEFAULT 'available',
    claimed_by UUID REFERENCES profiles(id),
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES food_listings(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'new_listing',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS: Daily Stats
-- ============================================

CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    total_listings_created INTEGER DEFAULT 0,
    total_listings_claimed INTEGER DEFAULT 0,
    total_listings_expired INTEGER DEFAULT 0,
    total_meals_shared INTEGER DEFAULT 0,
    active_donors INTEGER DEFAULT 0,
    active_recipients INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS: User Activity Log
-- ============================================

CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Geospatial indexes for proximity queries
CREATE INDEX idx_food_listings_location ON food_listings USING GIST (location);
CREATE INDEX idx_donor_profiles_location ON donor_profiles USING GIST (location);
CREATE INDEX idx_recipient_profiles_location ON recipient_profiles USING GIST (location);

-- Status and time indexes
CREATE INDEX idx_food_listings_status ON food_listings(status);
CREATE INDEX idx_food_listings_expiry ON food_listings(expiry_time);
CREATE INDEX idx_food_listings_donor ON food_listings(donor_id);
CREATE INDEX idx_food_listings_claimed_by ON food_listings(claimed_by);

-- Notification indexes
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_read ON notifications(recipient_id, read);

-- Analytics indexes
CREATE INDEX idx_daily_stats_date ON daily_stats(date);
CREATE INDEX idx_user_activity_user ON user_activity(user_id);
CREATE INDEX idx_user_activity_created ON user_activity(created_at);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Find nearby listings within radius (km)
CREATE OR REPLACE FUNCTION get_nearby_listings(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km INTEGER DEFAULT 10
)
RETURNS SETOF food_listings AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM food_listings
    WHERE status = 'available'
      AND expiry_time > NOW()
      AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_km * 1000  -- Convert km to meters
      )
    ORDER BY
        ST_Distance(
            location,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        );
END;
$$ LANGUAGE plpgsql;

-- Auto-expire old listings
CREATE OR REPLACE FUNCTION expire_old_listings()
RETURNS void AS $$
BEGIN
    UPDATE food_listings
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'available'
      AND expiry_time < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_donor_profiles_updated_at
    BEFORE UPDATE ON donor_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_recipient_profiles_updated_at
    BEFORE UPDATE ON recipient_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_food_listings_updated_at
    BEFORE UPDATE ON food_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Donor Profiles: Same as profiles
CREATE POLICY "Donor profiles are viewable by everyone"
    ON donor_profiles FOR SELECT USING (true);

CREATE POLICY "Donors can update own profile"
    ON donor_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Donors can insert own profile"
    ON donor_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Recipient Profiles: Same as profiles
CREATE POLICY "Recipient profiles are viewable by everyone"
    ON recipient_profiles FOR SELECT USING (true);

CREATE POLICY "Recipients can update own profile"
    ON recipient_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Recipients can insert own profile"
    ON recipient_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Food Listings: Everyone can read, donors can create/update their own
CREATE POLICY "Food listings are viewable by everyone"
    ON food_listings FOR SELECT USING (true);

CREATE POLICY "Donors can create listings"
    ON food_listings FOR INSERT
    WITH CHECK (
        auth.uid() = donor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'donor'
        )
    );

CREATE POLICY "Donors can update own listings"
    ON food_listings FOR UPDATE
    USING (auth.uid() = donor_id);

CREATE POLICY "Recipients can claim listings"
    ON food_listings FOR UPDATE
    USING (
        status = 'available'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'recipient'
        )
    );

-- Notifications: Users can only see their own
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- User Activity: Users can see their own, system can insert
CREATE POLICY "Users can view own activity"
    ON user_activity FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can log activity"
    ON user_activity FOR INSERT WITH CHECK (true);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable realtime for food_listings (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE food_listings;

-- ============================================
-- STORAGE BUCKET (Run in Supabase Dashboard or via API)
-- ============================================

-- Note: Storage bucket creation via SQL is limited.
-- Create bucket 'listing-images' in Supabase Dashboard with:
-- - Public bucket: Yes (for CDN delivery)
-- - Allowed MIME types: image/jpeg, image/png, image/webp
-- - Max file size: 5MB

-- Storage policies (run in SQL editor after bucket creation):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('listing-images', 'listing-images', true);

-- Policy: Anyone can view images
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');

-- Policy: Authenticated users can upload
-- CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'listing-images' AND auth.role() = 'authenticated');

-- Policy: Users can update/delete their own images
-- CREATE POLICY "Users can manage own images" ON storage.objects FOR UPDATE
-- USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## Environment Configuration

### Local Development: `.env.local`

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Vercel Deployment

Add these same environment variables in Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Apply to Production, Preview, and Development environments

---

## Implementation Steps

### Step 1: Supabase Project Setup
1. Create new Supabase project (or use existing)
2. Note the project URL and anon key from Settings → API
3. Enable PostGIS extension: Database → Extensions → Search "postgis" → Enable

### Step 2: Run Database Schema
1. Go to SQL Editor in Supabase Dashboard
2. Paste the entire schema.sql content
3. Run the query
4. Verify tables created in Table Editor

### Step 3: Configure Storage
1. Go to Storage in Supabase Dashboard
2. Create new bucket: `listing-images`
3. Set to Public bucket
4. Configure policies (use SQL from schema or dashboard UI)

### Step 4: Configure Authentication
1. Go to Authentication → Providers
2. Enable Email (already default)
3. Optionally enable Google and GitHub OAuth
4. Configure redirect URLs for your domain

### Step 5: Update Environment Files
1. Create `.env.local` in project root
2. Add Supabase URL and anon key
3. Restart dev server

### Step 6: Update Services
Files to modify:
- `src/services/authService.ts` - Connect to real auth
- `src/services/listingService.ts` - Connect to real tables
- `src/services/api.ts` - Already configured for Supabase

---

## Next Phase (After Database Setup)

### Phase 2B: Authentication Integration
1. Update `authService.ts` to create profile on signup
2. Implement profile fetching on login
3. Test full auth flow with real database

### Phase 3: Donor Dashboard
1. Create listing creation form with image upload
2. Show donor's active/claimed/expired listings
3. Implement listing management (edit, delete)

### Phase 4: Recipient Dashboard
1. Browse nearby listings with map
2. Claim functionality
3. View claimed history

### Phase 5: Notifications System
1. Subscribe to real-time notifications
2. Show notification badge in header
3. Notification dropdown/page

### Phase 6: Analytics Dashboard
1. Admin view of daily stats
2. Charts for meals shared over time
3. User activity metrics

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/schema.sql` | CREATE | Database schema |
| `.env.local` | CREATE | Local environment variables |
| `.env.example` | CREATE | Template for other developers |
| `src/services/authService.ts` | MODIFY | Real auth implementation |
| `src/services/listingService.ts` | MODIFY | Real listing CRUD |
| `src/types/index.ts` | MODIFY | Add missing types if needed |

---

## Verification Checklist

After running schema:
- [ ] All 7 tables created (profiles, donor_profiles, recipient_profiles, food_listings, notifications, daily_stats, user_activity)
- [ ] PostGIS extension enabled
- [ ] RLS enabled on all tables
- [ ] Realtime enabled for notifications and food_listings
- [ ] Storage bucket created with correct policies
- [ ] Environment variables set in `.env.local`
- [ ] Test signup creates profile correctly
- [ ] Test login returns user with profile data
