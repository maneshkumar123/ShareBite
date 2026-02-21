import { supabase, apiRequest } from './api';
import type { ApiResponse } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DonorStats {
    total: number;
    active: number;
    claimed: number;
    mealsShared: number;
}

export interface DonorListing {
    id: string;
    title: string;
    status: 'available' | 'claimed' | 'expired';
    quantity: number;
    quantityUnit: string;
    expiryTime: string;
    createdAt: string;
    claimedAt: string | null;
}

export interface RecipientStats {
    totalClaimed: number;
    mealsReceived: number;
    nearbyCount: number;
}

export interface NearbyListing {
    id: string;
    title: string;
    quantity: number;
    quantityUnit: string;
    expiryTime: string;
    address: string;
    distanceKm: number;
    donorName: string;
}

// ─── Donor Methods ─────────────────────────────────────────────────────────────

export const listingService = {

    /**
     * Get aggregate stats for a donor's dashboard
     */
    getDonorStats: async (userId: string): Promise<ApiResponse<DonorStats>> => {
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('food_listings')
                .select('status, quantity')
                .eq('donor_id', userId);

            if (error) throw error;

            const rows = data ?? [];
            const total = rows.length;
            const active = rows.filter(r => r.status === 'available').length;
            const claimed = rows.filter(r => r.status === 'claimed').length;
            const mealsShared = rows
                .filter(r => r.status === 'claimed')
                .reduce((sum, r) => sum + (r.quantity ?? 0), 0);

            return { total, active, claimed, mealsShared };
        });
    },

    /**
     * Get recent listings for a donor
     */
    getDonorListings: async (userId: string, limit = 10): Promise<ApiResponse<DonorListing[]>> => {
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('food_listings')
                .select('id, title, status, quantity, quantity_unit, expiry_time, created_at, claimed_at')
                .eq('donor_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return (data ?? []).map(row => ({
                id: row.id,
                title: row.title,
                status: row.status as 'available' | 'claimed' | 'expired',
                quantity: row.quantity,
                quantityUnit: row.quantity_unit,
                expiryTime: row.expiry_time,
                createdAt: row.created_at,
                claimedAt: row.claimed_at ?? null,
            }));
        });
    },

    /**
     * Get aggregate stats for a recipient's dashboard
     */
    getRecipientStats: async (userId: string): Promise<ApiResponse<RecipientStats>> => {
        return apiRequest(async () => {
            // Claimed listings
            const { data: claimedData, error: claimedError } = await supabase
                .from('food_listings')
                .select('quantity')
                .eq('claimed_by', userId);

            if (claimedError) throw claimedError;

            const claimed = claimedData ?? [];
            const totalClaimed = claimed.length;
            const mealsReceived = claimed.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

            // Nearby count — use recipient's location from recipient_profiles
            const { data: profileData, error: profileError } = await supabase
                .from('recipient_profiles')
                .select('location')
                .eq('id', userId)
                .maybeSingle();

            if (profileError) throw profileError;

            let nearbyCount = 0;
            if (profileData?.location) {
                // Count nearby available, non-expired listings
                const { count, error: nearbyError } = await supabase
                    .from('food_listings')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'available')
                    .gt('expiry_time', new Date().toISOString())
                    .filter('location', 'not.is', null);

                if (!nearbyError) nearbyCount = count ?? 0;
            }

            return { totalClaimed, mealsReceived, nearbyCount };
        });
    },

    /**
     * Get nearby available listings for a recipient
     * Falls back to all available listings if no recipient location
     */
    getNearbyListings: async (userId: string, _radiusMeters = 10000): Promise<ApiResponse<NearbyListing[]>> => {
        return apiRequest(async () => {
            // Get recipient location
            const { data: profileData } = await supabase
                .from('recipient_profiles')
                .select('location')
                .eq('id', userId)
                .maybeSingle();

            // Query available, non-expired listings
            const { data, error } = await supabase
                .from('food_listings')
                .select('id, title, quantity, quantity_unit, expiry_time, address, location, donor_id')
                .eq('status', 'available')
                .gt('expiry_time', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            const rows = data ?? [];

            return rows.map(row => {
                // Calculate rough distance if both locations available
                let distanceKm = 0;
                if (profileData?.location && row.location) {
                    distanceKm = 0; // Server-side PostGIS preferred; placeholder for now
                }

                return {
                    id: row.id,
                    title: row.title,
                    quantity: row.quantity,
                    quantityUnit: row.quantity_unit,
                    expiryTime: row.expiry_time,
                    address: row.address ?? '',
                    distanceKm,
                    donorName: 'Donor',
                };
            });
        });
    },

    /**
     * Claim a listing for a recipient
     */
    claimListing: async (listingId: string, recipientId: string): Promise<ApiResponse<null>> => {
        return apiRequest(async () => {
            const { error } = await supabase
                .from('food_listings')
                .update({
                    status: 'claimed',
                    claimed_by: recipientId,
                    claimed_at: new Date().toISOString(),
                })
                .eq('id', listingId)
                .eq('status', 'available'); // Only claim if still available

            if (error) throw error;
            return null;
        });
    },
};
