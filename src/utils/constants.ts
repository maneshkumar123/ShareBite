// Application Constants

// Routes
export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    AUTH_SUCCESS: '/auth/success',
    FORGOT_PASSWORD: '/forgot-password',
    DONOR_DASHBOARD: '/donor/dashboard',
    CREATE_LISTING: '/donor/create-listing',
    RECIPIENT_DASHBOARD: '/recipient/dashboard',
    BROWSE_LISTINGS: '/recipient/browse',
    LISTING_DETAILS: '/listing/:id',
    PROFILE: '/profile',
} as const;

// API Endpoints (will be configured with Supabase)
export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        ME: '/auth/me',
    },
    LISTINGS: {
        CREATE: '/listings',
        GET_ALL: '/listings',
        GET_BY_ID: '/listings/:id',
        CLAIM: '/listings/:id/claim',
        NEARBY: '/listings/nearby',
    },
    USERS: {
        PROFILE: '/users/profile',
        UPDATE: '/users/profile',
    },
    NOTIFICATIONS: {
        GET_ALL: '/notifications',
        MARK_READ: '/notifications/:id/read',
    },
} as const;

// Default values
export const DEFAULT_PAGE_SIZE = 20;
export const NEARBY_RADIUS_KM = 10;
export const MIN_PASSWORD_LENGTH = 8;

// Validation messages
export const VALIDATION_MESSAGES = {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    PASSWORD_TOO_SHORT: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    PASSWORDS_DONT_MATCH: 'Passwords do not match',
    INVALID_PHONE: 'Please enter a valid phone number',
} as const;

// Status colors (for UI)
export const STATUS_COLORS = {
    available: '#10b981',
    claimed: '#f59e0b',
    expired: '#ef4444',
} as const;
