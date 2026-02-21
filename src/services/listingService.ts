import { supabase, apiRequest } from './api';
import type { ApiResponse } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateListingData {
    title: string;
    description: string;
    quantity: number;
    quantityUnit: string;
    expiryTime: string; // ISO string
    address: string;
    latitude: number;
    longitude: number;
    imageUrl?: string;
}

export interface ListingDetail {
    id: string;
    title: string;
    description: string;
    quantity: number;
    quantityUnit: string;
    imageUrl: string | null;
    expiryTime: string;
    address: string;
    status: 'available' | 'claimed' | 'expired';
    donorId: string;
    donorName: string;
    donorOrgType: string;
    createdAt: string;
    claimedAt: string | null;
}

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
    imageUrl?: string | null;
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

    /**
     * Create a new food listing
     */
    createListing: async (userId: string, data: CreateListingData): Promise<ApiResponse<string>> => {
        return apiRequest(async () => {
            const locationWKT = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
            const { data: row, error } = await supabase
                .from('food_listings')
                .insert({
                    donor_id: userId,
                    title: data.title,
                    description: data.description,
                    quantity: data.quantity,
                    quantity_unit: data.quantityUnit,
                    expiry_time: data.expiryTime,
                    address: data.address,
                    location: locationWKT,
                    image_url: data.imageUrl ?? null,
                    status: 'available',
                })
                .select('id')
                .single();

            if (error) throw error;
            return row.id as string;
        });
    },

    /**
     * Get all listings for a donor, optionally filtered by status
     */
    getMyListings: async (userId: string, status?: 'available' | 'claimed' | 'expired'): Promise<ApiResponse<DonorListing[]>> => {
        return apiRequest(async () => {
            let query = supabase
                .from('food_listings')
                .select('id, title, status, quantity, quantity_unit, expiry_time, created_at, claimed_at, image_url')
                .eq('donor_id', userId)
                .order('created_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;
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
                imageUrl: row.image_url ?? null,
            }));
        });
    },

    /**
     * Update a listing owned by the given user
     */
    updateListing: async (id: string, userId: string, data: Partial<CreateListingData>): Promise<ApiResponse<null>> => {
        return apiRequest(async () => {
            const updates: Record<string, unknown> = {};
            if (data.title !== undefined) updates.title = data.title;
            if (data.description !== undefined) updates.description = data.description;
            if (data.quantity !== undefined) updates.quantity = data.quantity;
            if (data.quantityUnit !== undefined) updates.quantity_unit = data.quantityUnit;
            if (data.expiryTime !== undefined) updates.expiry_time = data.expiryTime;
            if (data.address !== undefined) updates.address = data.address;
            if (data.imageUrl !== undefined) updates.image_url = data.imageUrl;
            if (data.latitude !== undefined && data.longitude !== undefined) {
                updates.location = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
            }

            const { error } = await supabase
                .from('food_listings')
                .update(updates)
                .eq('id', id)
                .eq('donor_id', userId);

            if (error) throw error;
            return null;
        });
    },

    /**
     * Soft-delete a listing by setting status to expired
     */
    deleteListing: async (id: string, userId: string): Promise<ApiResponse<null>> => {
        return apiRequest(async () => {
            const { error } = await supabase
                .from('food_listings')
                .update({ status: 'expired' })
                .eq('id', id)
                .eq('donor_id', userId);

            if (error) throw error;
            return null;
        });
    },

    /**
     * Get full listing details by ID
     */
    getListingById: async (id: string): Promise<ApiResponse<ListingDetail>> => {
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('food_listings')
                .select(`
                    id, title, description, quantity, quantity_unit,
                    image_url, expiry_time, address, status,
                    donor_id, created_at, claimed_at,
                    profiles!donor_id ( full_name ),
                    donor_profiles!id ( organization_name, organization_type )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
            const donorProfile = Array.isArray(data.donor_profiles) ? data.donor_profiles[0] : data.donor_profiles;

            return {
                id: data.id,
                title: data.title,
                description: data.description ?? '',
                quantity: data.quantity,
                quantityUnit: data.quantity_unit,
                imageUrl: data.image_url ?? null,
                expiryTime: data.expiry_time,
                address: data.address,
                status: data.status as 'available' | 'claimed' | 'expired',
                donorId: data.donor_id,
                donorName: donorProfile?.organization_name ?? profile?.full_name ?? 'Donor',
                donorOrgType: donorProfile?.organization_type ?? 'other',
                createdAt: data.created_at,
                claimedAt: data.claimed_at ?? null,
            };
        });
    },
};
