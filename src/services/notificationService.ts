import { supabase, apiRequest } from './api';
import type { ApiResponse } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface AppNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    listingId: string | null;
    createdAt: string;
}

export const notificationService = {
    getNotifications: async (userId: string): Promise<ApiResponse<AppNotification[]>> => {
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, type, title, message, read, listing_id, created_at')
                .eq('recipient_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            return (data ?? []).map(row => ({
                id: row.id,
                type: row.type,
                title: row.title,
                message: row.message,
                read: row.read,
                listingId: row.listing_id ?? null,
                createdAt: row.created_at,
            }));
        });
    },

    markAllRead: async (userId: string): Promise<ApiResponse<null>> => {
        return apiRequest(async () => {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('recipient_id', userId)
                .eq('read', false);

            if (error) throw error;
            return null;
        });
    },

    markOneRead: async (id: string): Promise<ApiResponse<null>> => {
        return apiRequest(async () => {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id);

            if (error) throw error;
            return null;
        });
    },

    subscribeToNotifications: (
        userId: string,
        onNew: (notification: AppNotification) => void
    ): RealtimeChannel => {
        return supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_id=eq.${userId}`,
                },
                (payload) => {
                    const row = payload.new as Record<string, unknown>;
                    onNew({
                        id: row.id as string,
                        type: row.type as string,
                        title: row.title as string,
                        message: row.message as string,
                        read: row.read as boolean,
                        listingId: (row.listing_id as string) ?? null,
                        createdAt: row.created_at as string,
                    });
                }
            )
            .subscribe();
    },

    unsubscribe: async (channel: RealtimeChannel): Promise<void> => {
        await supabase.removeChannel(channel);
    },
};
