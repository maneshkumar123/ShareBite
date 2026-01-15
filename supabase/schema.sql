-- ============================================
-- SHAREBITE DATABASE SCHEMA
-- Supabase PostgreSQL
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: ENABLE EXTENSIONS (Must be first)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================
-- STEP 2: CREATE ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('donor', 'recipient');
CREATE TYPE listing_status AS ENUM ('available', 'claimed', 'expired');
CREATE TYPE organization_type AS ENUM ('restaurant', 'cafe', 'grocery', 'bakery', 'catering', 'other');

-- ============================================
-- STEP 3: PROFILES TABLE
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
-- STEP 4: DONOR PROFILES (Extension of profiles)
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
-- STEP 5: RECIPIENT PROFILES (Extension of profiles)
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
-- STEP 6: FOOD LISTINGS
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
-- STEP 7: NOTIFICATIONS
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
-- STEP 8: ANALYTICS - Daily Stats
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
-- STEP 9: ANALYTICS - User Activity Log
-- ============================================

CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 10: CREATE INDEXES FOR PERFORMANCE
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
-- STEP 11: CREATE HELPER FUNCTIONS
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
RETURNS TABLE (
    id UUID,
    donor_id UUID,
    title TEXT,
    description TEXT,
    quantity INTEGER,
    quantity_unit TEXT,
    image_url TEXT,
    expiry_time TIMESTAMPTZ,
    address TEXT,
    status listing_status,
    created_at TIMESTAMPTZ,
    distance_meters DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fl.id,
        fl.donor_id,
        fl.title,
        fl.description,
        fl.quantity,
        fl.quantity_unit,
        fl.image_url,
        fl.expiry_time,
        fl.address,
        fl.status,
        fl.created_at,
        ST_Distance(
            fl.location,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) AS distance_meters,
        ST_Y(fl.location::geometry) AS lat,
        ST_X(fl.location::geometry) AS lng
    FROM food_listings fl
    WHERE fl.status = 'available'
      AND fl.expiry_time > NOW()
      AND ST_DWithin(
          fl.location,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_km * 1000  -- Convert km to meters
      )
    ORDER BY distance_meters ASC;
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
-- STEP 12: CREATE TRIGGERS
-- ============================================

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
-- STEP 13: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 14: PROFILES POLICIES
-- ============================================

CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 15: DONOR PROFILES POLICIES
-- ============================================

CREATE POLICY "Donor profiles are viewable by everyone"
    ON donor_profiles FOR SELECT USING (true);

CREATE POLICY "Donors can update own profile"
    ON donor_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Donors can insert own profile"
    ON donor_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 16: RECIPIENT PROFILES POLICIES
-- ============================================

CREATE POLICY "Recipient profiles are viewable by everyone"
    ON recipient_profiles FOR SELECT USING (true);

CREATE POLICY "Recipients can update own profile"
    ON recipient_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Recipients can insert own profile"
    ON recipient_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 17: FOOD LISTINGS POLICIES
-- ============================================

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

-- ============================================
-- STEP 18: NOTIFICATIONS POLICIES
-- ============================================

CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- ============================================
-- STEP 19: USER ACTIVITY POLICIES
-- ============================================

CREATE POLICY "Users can view own activity"
    ON user_activity FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can log activity"
    ON user_activity FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 20: ENABLE REALTIME SUBSCRIPTIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE food_listings;

-- ============================================
-- DONE! Now create storage bucket manually:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create bucket: 'listing-images'
-- 3. Set to Public bucket
-- ============================================
