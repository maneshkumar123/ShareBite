-- ============================================
-- SHAREBITE: AUTO-CREATE PROFILE TRIGGER
-- Run this in Supabase SQL Editor
-- 
-- This trigger automatically creates a profile
-- when a new user signs up, solving the RLS
-- timing issue.
-- ============================================

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER  -- Runs with elevated privileges, bypasses RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Create base profile from auth metadata
    INSERT INTO public.profiles (id, email, role, full_name, phone)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'recipient'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        NEW.raw_user_meta_data->>'phone'
    );
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- DONE! 
-- Now when a user signs up, their profile is
-- automatically created by this trigger.
-- ============================================
