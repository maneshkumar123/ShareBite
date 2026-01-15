// User and Authentication Types
export const UserRole = {
    DONOR: 'donor',
    RECIPIENT: 'recipient',
    CHARITY: 'charity',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface User {
    id: string;
    email: string;
    role: UserRole;
    name: string;
    phone?: string;
    createdAt: string;
    profile?: DonorProfile | RecipientProfile;
}

export interface DonorProfile {
    restaurantName: string;
    address: string;
    location: Location;
    contactPerson: string;
}

export interface RecipientProfile {
    organizationName?: string;
    address: string;
    location: Location;
    isCharity: boolean;
}

// Location Types
export interface Location {
    latitude: number;
    longitude: number;
    address: string;
}

// Food Listing Types
export const ListingStatus = {
    AVAILABLE: 'available',
    CLAIMED: 'claimed',
    EXPIRED: 'expired',
} as const;

export type ListingStatus = typeof ListingStatus[keyof typeof ListingStatus];

export interface FoodListing {
    id: string;
    donorId: string;
    donor: User;
    title: string;
    description: string;
    quantity: number;
    quantityUnit: string;
    expiryTime: string;
    location: Location;
    status: ListingStatus;
    createdAt: string;
    claimedBy?: string;
    claimedAt?: string;
}

// Notification Types
export interface Notification {
    id: string;
    recipientId: string;
    listingId: string;
    listing?: FoodListing;
    message: string;
    read: boolean;
    createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}
