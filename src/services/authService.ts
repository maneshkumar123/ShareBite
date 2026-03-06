/**
 * Authentication Service
 * 
 * Handles all authentication operations with Supabase:
 * - User registration (profile created via database trigger)
 * - User login with profile fetching
 * - Role-specific profile creation (after successful signup)
 * - Session management
 */

import { supabase, apiRequest, isSupabaseConfigured } from './api';
import type { Session } from '@supabase/supabase-js';
import type { ApiResponse } from '../types';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    // Auth fields
    email: string;
    password: string;

    // Profile fields (common) - passed to trigger via metadata
    fullName: string;
    phone?: string;
    role: 'donor' | 'recipient';

    // Role-specific fields (stored after signup in role_profiles table)
    organizationName?: string;
    organizationType?: 'restaurant' | 'cafe' | 'grocery' | 'bakery' | 'catering' | 'other';
    address?: string;
    isCharity?: boolean;
}

export interface AuthUser {
    id: string;
    email: string;
    role: 'donor' | 'recipient' | null;  // null for new OAuth users before role is selected
    fullName: string;
    phone?: string;
    avatarUrl?: string;
    createdAt: string;
    hasCompletedProfile: boolean;

    // Extended profile based on role
    donorProfile?: {
        organizationName: string;
        organizationType: string;
        address: string;
        isVerified: boolean;
    };
    recipientProfile?: {
        organizationName?: string;
        address: string;
        isCharity: boolean;
    };
}

// ==============================================
// AUTHENTICATION SERVICE
// ==============================================

export const authService = {
    /**
     * Check if Supabase is configured
     */
    isConfigured: isSupabaseConfigured,

    /**
     * Register a new user
     * 
     * Flow:
     * 1. signUp creates user in auth.users with metadata
     * 2. Database trigger (handle_new_user) automatically creates base profile
     * 3. Role-specific profiles are created later during onboarding/profile setup
     * 
     * This approach is more robust as it doesn't require the session to be
     * established immediately after signup.
     */
    register: async (data: RegisterData): Promise<ApiResponse<AuthUser>> => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        return apiRequest(async () => {
            // Create auth user with metadata
            // The database trigger will use this metadata to create the base profile
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/success`,
                    data: {
                        // These are passed to the trigger via raw_user_meta_data
                        full_name: data.fullName,
                        role: data.role,
                        phone: data.phone || null,
                        // Also store role-specific data for later use
                        organization_name: data.organizationName || null,
                        organization_type: data.organizationType || null,
                        address: data.address || null,
                        is_charity: data.isCharity || false,
                    },
                },
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('Registration failed');

            // Return immediately - the trigger handles base profile creation
            // Role-specific profiles will be created during onboarding when user
            // sets their location on the map
            return {
                id: authData.user.id,
                email: data.email,
                role: data.role,
                fullName: data.fullName,
                phone: data.phone,
                createdAt: new Date().toISOString(),
                hasCompletedProfile: false, // Extended profile not created yet
            } as AuthUser;
        });
    },

    /**
     * Login user and fetch their profile
     */
    login: async (credentials: LoginCredentials): Promise<ApiResponse<AuthUser>> => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        return apiRequest(async () => {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password,
            });

            if (error) throw error;
            if (!data.user) throw new Error('Login failed');

            // Fetch user profile
            const profile = await authService.fetchUserProfile(data.user.id);
            if (!profile) throw new Error('Failed to fetch user profile');

            return profile;
        });
    },

    /**
     * Logout current user
     * Signs out from Supabase (clears server session + localStorage tokens),
     * removes all Supabase Realtime channels, and purges any residual
     * auth keys from storage so the next login starts completely fresh.
     */
    logout: async (): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        return apiRequest(async () => {
            // 1. Tear down all Realtime subscriptions so no stale listeners
            //    fire after the session is gone.
            supabase.removeAllChannels();

            // 2. Sign out from Supabase (revokes refresh token server-side
            //    and clears its own localStorage keys).
            const { error } = await supabase.auth.signOut({ scope: 'local' });
            if (error) throw error;

            // 3. Purge any residual Supabase auth keys that signOut may
            //    not have cleaned up (edge-case with stale tabs / race conditions).
            const storage = globalThis?.localStorage;
            if (storage) {
                Object.keys(storage).forEach((key) => {
                    if (key.startsWith('sb-') && (key.endsWith('-auth-token') || key.endsWith('-auth-token-code-verifier'))) {
                        storage.removeItem(key);
                    }
                });
            }

            return null;
        });
    },

    /**
     * Build a minimal AuthUser directly from the Supabase JWT session.
     * Uses user_metadata set during registration — no database call needed.
     * This is used for instant auth state on load; profile is enriched later.
     */
    buildUserFromSession: (session: Session): AuthUser => {
        const { user } = session;
        const meta = user.user_metadata || {};
        return {
            id: user.id,
            email: user.email!,
            role: (meta.role as 'donor' | 'recipient') || null,
            fullName: meta.full_name || user.email!,
            phone: meta.phone || undefined,
            avatarUrl: meta.avatar_url || undefined,
            createdAt: user.created_at,
            hasCompletedProfile: false, // enriched once fetchUserProfile completes
        };
    },

    /**
     * Get the current session from localStorage — instant, no network call.
     * This is the Supabase-recommended way to initialise auth state in a SPA.
     */
    getInitialSession: async (): Promise<Session | null> => {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    /**
     * Get current authenticated user with profile
     */
    getCurrentUser: async (): Promise<ApiResponse<AuthUser | null>> => {
        if (!isSupabaseConfigured()) {
            return { success: true, data: null };
        }

        return apiRequest(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return null;

            return await authService.fetchUserProfile(session.user.id);
        });
    },

    /**
     * Fetch complete user profile from database
     */
    fetchUserProfile: async (userId: string): Promise<AuthUser | null> => {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error('[authService] Error fetching base profile:', profileError);
            return null;
        }

        const authUser: AuthUser = {
            id: profile.id,
            email: profile.email,
            role: (profile.role as 'donor' | 'recipient') || null,
            fullName: profile.full_name,
            phone: profile.phone,
            avatarUrl: profile.avatar_url,
            createdAt: profile.created_at,
            hasCompletedProfile: false,
        };

        // Fetch role-specific profile (may not exist yet — created during onboarding)
        if (profile.role === 'donor') {
            const { data: donorProfile } = await supabase
                .from('donor_profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (donorProfile) {
                authUser.donorProfile = {
                    organizationName: donorProfile.organization_name,
                    organizationType: donorProfile.organization_type,
                    address: donorProfile.address,
                    isVerified: donorProfile.is_verified,
                };
                authUser.hasCompletedProfile = true;
            }
        } else if (profile.role === 'recipient') {
            const { data: recipientProfile } = await supabase
                .from('recipient_profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (recipientProfile) {
                authUser.recipientProfile = {
                    organizationName: recipientProfile.organization_name,
                    address: recipientProfile.address,
                    isCharity: recipientProfile.is_charity,
                };
                authUser.hasCompletedProfile = true;
            }
        }

        return authUser;
    },

    /**
     * Create or update role-specific profile
     * Called during onboarding or profile setup
     */
    createRoleProfile: async (
        userId: string,
        role: 'donor' | 'recipient',
        profileData: {
            organizationName?: string;
            organizationType?: string;
            address: string;
            isCharity?: boolean;
            latitude?: number;
            longitude?: number;
        }
    ): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        return apiRequest(async () => {
            const location = profileData.latitude && profileData.longitude
                ? `SRID=4326;POINT(${profileData.longitude} ${profileData.latitude})`
                : 'SRID=4326;POINT(0 0)';

            if (role === 'donor') {
                const { error } = await supabase
                    .from('donor_profiles')
                    .upsert({
                        id: userId,
                        organization_name: profileData.organizationName || '',
                        organization_type: profileData.organizationType || 'other',
                        address: profileData.address,
                        location: location,
                    });

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('recipient_profiles')
                    .upsert({
                        id: userId,
                        organization_name: profileData.organizationName || null,
                        address: profileData.address,
                        is_charity: profileData.isCharity || false,
                        location: location,
                    });

                if (error) throw error;
            }

            return null;
        });
    },

    /**
     * Listen for future auth state changes (sign-in, sign-out, token refresh).
     * Passes the raw Supabase event and session — the caller decides what to do.
     * Initial session setup is handled separately via getInitialSession().
     */
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    /**
     * Send password reset email
     */
    resetPassword: async (email: string): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        return apiRequest(async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            return null;
        });
    },

    /**
     * Initiate Google OAuth sign-in.
     * Triggers a browser redirect — the promise resolves only on error;
     * on success the browser navigates away before this resolves.
     */
    signInWithGoogle: async (): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        return apiRequest(async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    scopes: 'email profile',
                },
            });
            if (error) throw error;
            return null;
        });
    },

    /**
     * Set role for a new OAuth user.
     * Updates both the profiles table (DB source of truth) and JWT metadata
     * (so buildUserFromSession picks up the role on reload).
     * Also stores extra data so ProfileSetup can pre-fill its fields.
     */
    setUserRole: async (
        userId: string,
        role: 'donor' | 'recipient',
        extraData?: {
            organizationName?: string;
            organizationType?: string;
            isCharity?: boolean;
        }
    ): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        return apiRequest(async () => {
            // 1. Write role to profiles table
            const { error: dbError } = await supabase
                .from('profiles')
                .update({ role })
                .eq('id', userId);
            if (dbError) throw dbError;

            // 2. Persist role + extra data into JWT metadata.
            //    ProfileSetup reads organization_name / organization_type / is_charity
            //    from metadata to pre-fill its form.
            const metadata: Record<string, unknown> = { role };
            if (extraData?.organizationName) metadata.organization_name = extraData.organizationName;
            if (extraData?.organizationType) metadata.organization_type = extraData.organizationType;
            if (extraData?.isCharity !== undefined) metadata.is_charity = extraData.isCharity;

            const { error: metaError } = await supabase.auth.updateUser({ data: metadata });
            if (metaError) throw metaError;

            return null;
        });
    },
};
