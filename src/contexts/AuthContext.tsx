/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Integrates with Supabase auth service for persistent sessions.
 */

import React, { createContext, useState, useContext, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { ApiResponse } from '../types';
import { authService, type AuthUser, type RegisterData } from '@services/authService';

// ==============================================
// CONTEXT TYPE DEFINITIONS
// ==============================================

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isProfileLoading: boolean;
    login: (email: string, password: string) => Promise<ApiResponse<AuthUser>>;
    register: (data: RegisterData) => Promise<ApiResponse<AuthUser>>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    signInWithGoogle: () => Promise<ApiResponse<null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==============================================
// AUTH PROVIDER COMPONENT
// ==============================================

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProfileLoading, setIsProfileLoading] = useState(true);

    // Prevents the onAuthStateChange listener from overwriting user state
    // while login() or register() is actively handling authentication.
    // Without this, signInWithPassword triggers multiple SIGNED_IN events
    // that race with the login() profile fetch, causing null flickers.
    const manualAuthInProgressRef = useRef(false);

    /**
     * Refresh user data from database
     */
    const refreshUser = useCallback(async () => {
        const response = await authService.getCurrentUser();
        if (response.success && response.data) {
            setUser(response.data);
        } else {
            setUser(null);
        }
    }, []);

    /**
     * Phase 1 — instant: read session from localStorage (no network).
     * Phase 2 — async:   enrich user with full DB profile in the background.
     *
     * This is the standard Supabase SPA pattern:
     *   getSession() → sets auth state immediately from the JWT.
     *   fetchUserProfile() → runs after, never blocks routing.
     */
    useEffect(() => {
        // Phase 1: resolve auth state instantly from the cached session.
        authService.getInitialSession().then((session) => {
            if (manualAuthInProgressRef.current) return;

            if (session) {
                // User is authenticated — set basic user from JWT metadata now.
                setUser(authService.buildUserFromSession(session));
                setIsLoading(false);

                // Phase 2: enrich with full DB profile in the background.
                authService.fetchUserProfile(session.user.id).then((fullUser) => {
                    if (fullUser && !manualAuthInProgressRef.current) {
                        setUser(fullUser);
                    }
                    setIsProfileLoading(false);
                });
            } else {
                setUser(null);
                setIsLoading(false);
                setIsProfileLoading(false);
            }
        });

        // Listen for future changes: sign-in from another tab, sign-out, etc.
        // INITIAL_SESSION is intentionally ignored — handled above via getInitialSession().
        const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
            if (manualAuthInProgressRef.current) return;

            if (event === 'SIGNED_OUT') {
                setUser(null);
                return;
            }
            // TOKEN_REFRESHED, INITIAL_SESSION, USER_UPDATED don't require re-routing.
            if (event !== 'SIGNED_IN') return;

            if (session) {
                setUser(authService.buildUserFromSession(session));
                setIsProfileLoading(true);
                authService.fetchUserProfile(session.user.id).then((fullUser) => {
                    if (fullUser && !manualAuthInProgressRef.current) {
                        setUser(fullUser);
                    }
                    setIsProfileLoading(false);
                });
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    /**
     * Login user
     * Sets manualAuthInProgressRef to prevent the listener from interfering
     */
    const login = useCallback(async (email: string, password: string): Promise<ApiResponse<AuthUser>> => {
        setIsLoading(true);
        manualAuthInProgressRef.current = true;
        try {
            const response = await authService.login({ email, password });
            if (response.success && response.data) {
                setUser(response.data);
                setIsProfileLoading(false);
            }
            return response;
        } finally {
            setIsLoading(false);
            setTimeout(() => { manualAuthInProgressRef.current = false; }, 1000);
        }
    }, []);

    /**
     * Register new user
     */
    const register = useCallback(async (data: RegisterData): Promise<ApiResponse<AuthUser>> => {
        setIsLoading(true);
        manualAuthInProgressRef.current = true;
        try {
            const response = await authService.register(data);
            if (response.success && response.data) {
                setUser(response.data);
            }
            return response;
        } finally {
            setIsLoading(false);
            setTimeout(() => { manualAuthInProgressRef.current = false; }, 1000);
        }
    }, []);

    /**
     * Logout user
     * Note: Don't set isLoading here to avoid blocking the UI during logout
     */
    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } finally {
            setUser(null);
        }
    }, []);

    const signInWithGoogle = useCallback(async (): Promise<ApiResponse<null>> => {
        return authService.signInWithGoogle();
    }, []);

    const value: AuthContextType = {
        user,
        isAuthenticated: user !== null,
        isLoading,
        isProfileLoading,
        login,
        register,
        logout,
        refreshUser,
        signInWithGoogle,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ==============================================
// CUSTOM HOOK
// ==============================================

/**
 * Hook to access auth context
 * Must be used within AuthProvider
 */
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
