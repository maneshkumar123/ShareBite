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
                .rpc('get_donor_profile', { p_user_id: userId });

            if (error) throw error;

            const d = data as {
                id: string; email: string; full_name: string; phone: string | null;
                organization_name: string | null; organization_type: string | null;
                contact_person: string | null; address: string | null;
                is_verified: boolean | null; latitude: number | null; longitude: number | null;
            };

            return {
                id: d.id,
                email: d.email,
                fullName: d.full_name,
                phone: d.phone ?? null,
                organizationName: d.organization_name ?? '',
                organizationType: d.organization_type ?? 'other',
                contactPerson: d.contact_person ?? null,
                address: d.address ?? '',
                latitude: d.latitude ?? null,
                longitude: d.longitude ?? null,
                isVerified: d.is_verified ?? false,
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
                .rpc('get_recipient_profile', { p_user_id: userId });

            if (error) throw error;

            const d = data as {
                id: string; email: string; full_name: string; phone: string | null;
                organization_name: string | null; address: string | null;
                is_charity: boolean | null; latitude: number | null; longitude: number | null;
            };

            return {
                id: d.id,
                email: d.email,
                fullName: d.full_name,
                phone: d.phone ?? null,
                organizationName: d.organization_name ?? null,
                address: d.address ?? '',
                latitude: d.latitude ?? null,
                longitude: d.longitude ?? null,
                isCharity: d.is_charity ?? false,
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
