import { supabase, apiRequest } from './api';
import type { ApiResponse } from '../types';

export interface DonorProfileData {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    organizationName: string;
    organizationType: string;
    contactPerson: string | null;
    address: string;
    latitude: number | null;
    longitude: number | null;
    isVerified: boolean;
}

export interface RecipientProfileData {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    organizationName: string | null;
    address: string;
    latitude: number | null;
    longitude: number | null;
    isCharity: boolean;
}

export const profileService = {
    getDonorProfile: async (userId: string): Promise<ApiResponse<DonorProfileData>> => {
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id, email, full_name, phone,
                    donor_profiles!id (
                        organization_name, organization_type,
                        contact_person, address, is_verified
                    )
                `)
                .eq('id', userId)
                .single();

            if (error) throw error;

            const dp = Array.isArray(data.donor_profiles) ? data.donor_profiles[0] : data.donor_profiles;

            return {
                id: data.id,
                email: data.email,
                fullName: data.full_name,
                phone: data.phone ?? null,
                organizationName: dp?.organization_name ?? '',
                organizationType: dp?.organization_type ?? 'other',
                contactPerson: dp?.contact_person ?? null,
                address: dp?.address ?? '',
                latitude: null,
                longitude: null,
                isVerified: dp?.is_verified ?? false,
            };
        });
    },

    updateDonorProfile: async (userId: string, data: {
        fullName?: string;
        phone?: string;
        organizationName?: string;
        organizationType?: string;
        contactPerson?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
    }): Promise<ApiResponse<null>> => {
        return apiRequest(async () => {
            // Update base profile
            if (data.fullName || data.phone) {
                const profileUpdates: Record<string, unknown> = {};
                if (data.fullName) profileUpdates.full_name = data.fullName;
                if (data.phone !== undefined) profileUpdates.phone = data.phone;
                const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', userId);
                if (error) throw error;
            }

            // Update donor profile
            const donorUpdates: Record<string, unknown> = {};
            if (data.organizationName) donorUpdates.organization_name = data.organizationName;
            if (data.organizationType) donorUpdates.organization_type = data.organizationType;
            if (data.contactPerson !== undefined) donorUpdates.contact_person = data.contactPerson;
            if (data.address) donorUpdates.address = data.address;
            if (data.latitude !== undefined && data.longitude !== undefined) {
                donorUpdates.location = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
            }

            if (Object.keys(donorUpdates).length > 0) {
                const { error } = await supabase.from('donor_profiles').update(donorUpdates).eq('id', userId);
                if (error) throw error;
            }

            return null;
        });
    },

    getRecipientProfile: async (userId: string): Promise<ApiResponse<RecipientProfileData>> => {
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id, email, full_name, phone,
                    recipient_profiles!id (
                        organization_name, address, is_charity
                    )
                `)
                .eq('id', userId)
                .single();

            if (error) throw error;

            const rp = Array.isArray(data.recipient_profiles) ? data.recipient_profiles[0] : data.recipient_profiles;

            return {
                id: data.id,
                email: data.email,
                fullName: data.full_name,
                phone: data.phone ?? null,
                organizationName: rp?.organization_name ?? null,
                address: rp?.address ?? '',
                latitude: null,
                longitude: null,
                isCharity: rp?.is_charity ?? false,
            };
        });
    },

    updateRecipientProfile: async (userId: string, data: {
        fullName?: string;
        phone?: string;
        organizationName?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        isCharity?: boolean;
    }): Promise<ApiResponse<null>> => {
        return apiRequest(async () => {
            if (data.fullName || data.phone !== undefined) {
                const profileUpdates: Record<string, unknown> = {};
                if (data.fullName) profileUpdates.full_name = data.fullName;
                if (data.phone !== undefined) profileUpdates.phone = data.phone;
                const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', userId);
                if (error) throw error;
            }

            const recipientUpdates: Record<string, unknown> = {};
            if (data.organizationName !== undefined) recipientUpdates.organization_name = data.organizationName;
            if (data.address) recipientUpdates.address = data.address;
            if (data.isCharity !== undefined) recipientUpdates.is_charity = data.isCharity;
            if (data.latitude !== undefined && data.longitude !== undefined) {
                recipientUpdates.location = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
            }

            if (Object.keys(recipientUpdates).length > 0) {
                const { error } = await supabase.from('recipient_profiles').update(recipientUpdates).eq('id', userId);
                if (error) throw error;
            }

            return null;
        });
    },
};
