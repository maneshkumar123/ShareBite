// Application Constants

// Routes
export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    VERIFY_EMAIL: '/auth/verify-email',
    AUTH_SUCCESS: '/auth/success',
    AUTH_CALLBACK: '/auth/callback',      // OAuth PKCE callback landing page
    GOOGLE_SETUP: '/auth/google-setup',   // role selection for new Google users
    FORGOT_PASSWORD: '/forgot-password',
    PROFILE_SETUP: '/profile-setup',
    // Donor
    DONOR_DASHBOARD: '/donor/dashboard',
    CREATE_LISTING: '/donor/create-listing',
    MY_LISTINGS: '/donor/listings',
    DONOR_REQUESTS: '/donor/requests',
    PROFILE: '/profile',
    // Recipient
    RECIPIENT_DASHBOARD: '/recipient/dashboard',
    BROWSE_LISTINGS: '/recipient/browse',
    RECIPIENT_PROFILE: '/recipient/profile',
    RECIPIENT_REQUESTS: '/recipient/requests',
    // Dynamic
    LISTING_DETAILS: '/listing/:id',
} as const;

/** Maps route pathnames to human-readable page titles shown in the header */
export const PAGE_TITLES: Record<string, string> = {
    '/donor/dashboard': 'Dashboard',
    '/donor/create-listing': 'Create Listing',
    '/donor/listings': 'My Listings',
    '/profile': 'Profile',
    '/recipient/dashboard': 'Dashboard',
    '/recipient/browse': 'Browse Food',
    '/recipient/profile': 'Profile',
    '/donor/requests': 'Requests',
    '/recipient/requests': 'Requests',
};

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
