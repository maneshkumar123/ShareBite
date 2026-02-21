import { supabase, apiRequest } from './api';
import type { ApiResponse } from '../types';

export const imageService = {
    uploadListingImage: async (userId: string, file: File): Promise<ApiResponse<string>> => {
        return apiRequest(async () => {
            const ext = file.name.split('.').pop() ?? 'jpg';
            const path = `${userId}/${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('listing-images')
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type,
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('listing-images')
                .getPublicUrl(path);

            return data.publicUrl;
        });
    },

    deleteListingImage: async (url: string): Promise<ApiResponse<null>> => {
        return apiRequest(async () => {
            // Extract path from URL: .../listing-images/userId/filename.ext
            const parts = url.split('/listing-images/');
            if (parts.length < 2) return null;
            const path = parts[1];

            const { error } = await supabase.storage
                .from('listing-images')
                .remove([path]);

            if (error) throw error;
            return null;
        });
    },
};
