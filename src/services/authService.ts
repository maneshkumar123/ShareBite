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
    role: 'donor' | 'recipient';
    fullName: string;
    phone?: string;
    avatarUrl?: string;
    createdAt: string;

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
     */
    logout: async (): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured' };
        }

        return apiRequest(async () => {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return null;
        });
    },

    /**
     * Get current authenticated user with profile
     */
    getCurrentUser: async (): Promise<ApiResponse<AuthUser | null>> => {
        if (!isSupabaseConfigured()) {
            return { success: true, data: null };
        }

        return apiRequest(async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            return await authService.fetchUserProfile(user.id);
        });
    },

    /**
     * Fetch complete user profile from database
     */
    fetchUserProfile: async (userId: string): Promise<AuthUser | null> => {
        // Fetch base profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error('Error fetching profile:', profileError);
            return null;
        }

        const authUser: AuthUser = {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            fullName: profile.full_name,
            phone: profile.phone,
            avatarUrl: profile.avatar_url,
            createdAt: profile.created_at,
        };

        // Fetch role-specific profile (may not exist yet - created during onboarding)
        // Using maybeSingle() returns null instead of error when no row exists
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
     * Listen for auth state changes
     */
    onAuthStateChange: (callback: (user: AuthUser | null) => void) => {
        return supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                // Give time for trigger to create profile
                await new Promise(resolve => setTimeout(resolve, 300));
                const profile = await authService.fetchUserProfile(session.user.id);
                callback(profile);
            } else if (event === 'SIGNED_OUT') {
                callback(null);
            }
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
};
