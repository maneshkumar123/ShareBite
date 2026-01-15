/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Integrates with Supabase auth service for persistent sessions.
 */

import React, { createContext, useState, useContext, useEffect, useCallback, type ReactNode } from 'react';
import type { ApiResponse } from '../types';
import { authService, type AuthUser, type RegisterData } from '@services/authService';

// ==============================================
// CONTEXT TYPE DEFINITIONS
// ==============================================

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<ApiResponse<AuthUser>>;
    register: (data: RegisterData) => Promise<ApiResponse<AuthUser>>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==============================================
// AUTH PROVIDER COMPONENT
// ==============================================

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
     * Check for existing session on mount
     * Also sets up auth state change listener
     */
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await authService.getCurrentUser();
                if (response.success && response.data) {
                    setUser(response.data);
                }
            } catch (error) {
                console.error('Auth check error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();

        // Listen for auth state changes (e.g., token refresh, logout from another tab)
        const { data: { subscription } } = authService.onAuthStateChange((authUser) => {
            setUser(authUser);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    /**
     * Login user
     */
    const login = useCallback(async (email: string, password: string): Promise<ApiResponse<AuthUser>> => {
        setIsLoading(true);
        try {
            const response = await authService.login({ email, password });
            if (response.success && response.data) {
                setUser(response.data);
            }
            return response;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Register new user
     */
    const register = useCallback(async (data: RegisterData): Promise<ApiResponse<AuthUser>> => {
        setIsLoading(true);
        try {
            const response = await authService.register(data);
            if (response.success && response.data) {
                setUser(response.data);
            }
            return response;
        } finally {
            setIsLoading(false);
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

    const value: AuthContextType = {
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
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
