import { apiRequest } from './api';
import type {
    FoodListing,
    Location,
    ListingStatus,
    ApiResponse,
    PaginatedResponse,
} from '../types';

export interface CreateListingData {
    title: string;
    description: string;
    quantity: number;
    quantityUnit: string;
    expiryTime: string;
    location: Location;
}

// Food listing service (placeholder for Supabase integration)
export const listingService = {
    // Create new listing
    create: async (_listingData: CreateListingData): Promise<ApiResponse<FoodListing>> => {
        return apiRequest(async () => {
            // TODO: Implement Supabase insert
            // const { data, error } = await supabase.from('listings').insert([listingData]);
            throw new Error('Not implemented - will be connected to Supabase');
        });
    },

    // Get all listings
    getAll: async (
        _page: number = 1,
        _pageSize: number = 20
    ): Promise<ApiResponse<PaginatedResponse<FoodListing>>> => {
        return apiRequest(async () => {
            // TODO: Implement Supabase query with pagination
            throw new Error('Not implemented - will be connected to Supabase');
        });
    },

    // Get nearby listings
    getNearby: async (
        _userLocation: Location,
        _radiusKm: number = 10
    ): Promise<ApiResponse<FoodListing[]>> => {
        return apiRequest(async () => {
            // TODO: Implement geolocation-based query
            throw new Error('Not implemented - will be connected to Supabase');
        });
    },

    // Get listing by ID
    getById: async (_id: string): Promise<ApiResponse<FoodListing>> => {
        return apiRequest(async () => {
            // TODO: Implement Supabase query
            throw new Error('Not implemented - will be connected to Supabase');
        });
    },

    // Claim listing
    claim: async (_listingId: string): Promise<ApiResponse<FoodListing>> => {
        return apiRequest(async () => {
            // TODO: Implement Supabase update
            throw new Error('Not implemented - will be connected to Supabase');
        });
    },

    // Update listing status
    updateStatus: async (
        _listingId: string,
        _status: ListingStatus
    ): Promise<ApiResponse<FoodListing>> => {
        return apiRequest(async () => {
            // TODO: Implement Supabase update
            throw new Error('Not implemented - will be connected to Supabase');
        });
    },
};
