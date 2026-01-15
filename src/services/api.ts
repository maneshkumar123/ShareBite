/**
 * Supabase Client Configuration
 * 
 * This file initializes the Supabase client with proper configuration
 * for authentication and database access.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ApiResponse } from '../types';

// ==============================================
// ENVIRONMENT VALIDATION
// ==============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables in development
if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
    console.warn(
        '⚠️ Supabase credentials not configured.\n' +
        'Create a .env.local file with:\n' +
        '  VITE_SUPABASE_URL=your-project-url\n' +
        '  VITE_SUPABASE_ANON_KEY=your-anon-key\n'
    );
}

// ==============================================
// SUPABASE CLIENT
// ==============================================

/**
 * Supabase client instance
 * Configured with:
 * - Auto token refresh
 * - Session persistence in localStorage
 * - Proper headers for API calls
 */
export const supabase: SupabaseClient = createClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
    }
);

/**
 * Check if Supabase is properly configured
 */
export const isSupabaseConfigured = (): boolean => {
    return Boolean(supabaseUrl && supabaseAnonKey);
};

// ==============================================
// API UTILITIES
// ==============================================

/**
 * Generic API request handler with error handling
 */
export const apiRequest = async <T>(
    request: () => Promise<T>
): Promise<ApiResponse<T>> => {
    try {
        const data = await request();
        return {
            success: true,
            data,
        };
    } catch (error) {
        console.error('API Error:', error);
        return {
            success: false,
            error: handleApiError(error),
        };
    }
};

/**
 * Extract error message from various error types
 */
export const handleApiError = (error: unknown): string => {
    if (error instanceof Error) {
        // Handle Supabase-specific errors
        if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
            const code = (error as { code: string }).code;
            switch (code) {
                case 'user_already_exists':
                    return 'An account with this email already exists';
                case 'invalid_credentials':
                    return 'Invalid email or password';
                case 'email_not_confirmed':
                    return 'Please confirm your email before logging in';
                default:
                    return error.message;
            }
        }
        return error.message;
    }
    return 'An unexpected error occurred';
};
