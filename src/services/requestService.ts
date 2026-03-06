import { supabase, apiRequest, isSupabaseConfigured } from './api';
import type { ApiResponse } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ClaimRequestStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface ClaimRequestSummary {
    id: string;
    listingId: string;
    listingTitle: string;
    donorId: string;
    donorName: string;
    recipientId: string;
    recipientName: string;
    recipientOrgName?: string;
    recipientIsCharity?: boolean;
    status: ClaimRequestStatus;
    lastMessageBody?: string;
    lastMessageAt?: string;
    unreadCount: number;
    createdAt: string;
}

export interface ClaimMessage {
    id: string;
    requestId: string;
    senderId: string;
    senderName: string;
    body: string;
    isRead: boolean;
    createdAt: string;
}

export interface ClaimRequestDetail extends ClaimRequestSummary {
    messages: ClaimMessage[];
    listing: {
        title: string;
        quantity: number;
        quantityUnit: string;
        expiryTime: string;
        address: string;
    };
    donorPhone?: string; // only shown to recipient when status === 'accepted'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const sortByDate = <T extends { created_at: string }>(rows: T[]): T[] =>
    [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

const buildSummaryFromRow = (
    row: {
        id: string;
        listing_id: string;
        status: string;
        created_at: string;
        recipient_id?: string;
        donor_id?: string;
    },
    listingTitle: string,
    donorId: string,
    donorName: string,
    recipientId: string,
    recipientName: string,
    recipientOrgName: string | undefined,
    recipientIsCharity: boolean | undefined,
    messages: { body: string; is_read: boolean; sender_id: string; created_at: string }[],
    currentUserId: string,
): ClaimRequestSummary => {
    const sorted = sortByDate(messages);
    const last = sorted[sorted.length - 1];
    const unread = sorted.filter(m => m.sender_id !== currentUserId && !m.is_read).length;
    return {
        id: row.id,
        listingId: row.listing_id,
        listingTitle,
        donorId,
        donorName,
        recipientId,
        recipientName,
        recipientOrgName,
        recipientIsCharity,
        status: row.status as ClaimRequestStatus,
        lastMessageBody: last?.body,
        lastMessageAt: last?.created_at,
        unreadCount: unread,
        createdAt: row.created_at,
    };
};

// ── Service ────────────────────────────────────────────────────────────────────

export const requestService = {

    /**
     * Create a claim request, optionally with an opening message.
     * Returns the new request's ID.
     */
    createRequest: async (
        listingId: string,
        recipientId: string,
        message?: string,
    ): Promise<ApiResponse<{ requestId: string }>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { data: req, error: reqErr } = await supabase
                .from('claim_requests')
                .insert({ listing_id: listingId, recipient_id: recipientId })
                .select('id')
                .single();
            if (reqErr) throw reqErr;

            if (message?.trim()) {
                const { error: msgErr } = await supabase
                    .from('claim_messages')
                    .insert({ request_id: req.id, sender_id: recipientId, body: message.trim() });
                if (msgErr) throw msgErr;
            }

            return { requestId: req.id as string };
        });
    },

    /**
     * Returns the current user's request for a specific listing, or null if none.
     */
    getMyRequestForListing: async (
        listingId: string,
        recipientId: string,
    ): Promise<ApiResponse<Pick<ClaimRequestSummary, 'id' | 'status'> | null>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('claim_requests')
                .select('id, status')
                .eq('listing_id', listingId)
                .eq('recipient_id', recipientId)
                .maybeSingle();
            if (error) throw error;
            if (!data) return null;
            return { id: data.id as string, status: data.status as ClaimRequestStatus };
        });
    },

    /**
     * All requests made by this recipient, newest first.
     */
    getMyRequests: async (recipientId: string): Promise<ApiResponse<ClaimRequestSummary[]>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('claim_requests')
                .select(`
                    id, listing_id, status, created_at,
                    food_listings!listing_id ( title, donor_id ),
                    claim_messages ( id, body, is_read, sender_id, created_at )
                `)
                .eq('recipient_id', recipientId)
                .order('created_at', { ascending: false });
            if (error) throw error;

            const rows = data ?? [];
            // Batch-fetch donor names
            const donorIds = [...new Set(rows.map(r => (r.food_listings as any)?.donor_id).filter(Boolean))];
            const donorNames: Record<string, string> = {};
            if (donorIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('donor_profiles')
                    .select('id, organization_name')
                    .in('id', donorIds);
                (profiles ?? []).forEach((p: any) => { donorNames[p.id] = p.organization_name ?? ''; });
            }

            return rows.map(row => {
                const listing = row.food_listings as any;
                const msgs = (row.claim_messages as any[]) ?? [];
                const donorId = listing?.donor_id ?? '';
                return buildSummaryFromRow(
                    row,
                    listing?.title ?? '',
                    donorId,
                    donorNames[donorId] ?? 'Donor',
                    recipientId,
                    '',
                    undefined,
                    undefined,
                    msgs,
                    recipientId,
                );
            });
        });
    },

    /**
     * All requests across all of this donor's listings, newest first.
     */
    getDonorRequests: async (donorId: string): Promise<ApiResponse<ClaimRequestSummary[]>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            // Step 1: get this donor's listing IDs + titles
            const { data: listings, error: lErr } = await supabase
                .from('food_listings')
                .select('id, title')
                .eq('donor_id', donorId);
            if (lErr) throw lErr;
            if (!listings || listings.length === 0) return [];

            const listingMap: Record<string, string> = {};
            listings.forEach((l: any) => { listingMap[l.id] = l.title; });
            const listingIds = listings.map((l: any) => l.id as string);

            // Step 2: get all requests for those listings
            const { data, error } = await supabase
                .from('claim_requests')
                .select(`
                    id, listing_id, status, created_at, recipient_id,
                    profiles!recipient_id ( full_name ),
                    claim_messages ( id, body, is_read, sender_id, created_at )
                `)
                .in('listing_id', listingIds)
                .order('created_at', { ascending: false });
            if (error) throw error;

            const rows = data ?? [];
            // Batch-fetch recipient org info
            const recipientIds = [...new Set(rows.map(r => r.recipient_id).filter(Boolean))];
            const recipientOrgs: Record<string, { orgName?: string; isCharity?: boolean }> = {};
            if (recipientIds.length > 0) {
                const { data: rProfiles } = await supabase
                    .from('recipient_profiles')
                    .select('id, organization_name, is_charity')
                    .in('id', recipientIds);
                (rProfiles ?? []).forEach((p: any) => {
                    recipientOrgs[p.id] = { orgName: p.organization_name, isCharity: p.is_charity };
                });
            }

            return rows.map(row => {
                const profile = row.profiles as any;
                const msgs = (row.claim_messages as any[]) ?? [];
                const org = recipientOrgs[row.recipient_id] ?? {};
                return buildSummaryFromRow(
                    row,
                    listingMap[row.listing_id] ?? '',
                    donorId,
                    '',
                    row.recipient_id,
                    profile?.full_name ?? '',
                    org.orgName,
                    org.isCharity,
                    msgs,
                    donorId,
                );
            });
        });
    },

    /**
     * Full request detail including all messages and listing info.
     */
    getRequestWithMessages: async (requestId: string, currentUserId: string): Promise<ApiResponse<ClaimRequestDetail>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { data: req, error: rErr } = await supabase
                .from('claim_requests')
                .select(`
                    id, listing_id, status, created_at, recipient_id,
                    food_listings!listing_id ( title, quantity, quantity_unit, expiry_time, address, donor_id ),
                    profiles!recipient_id ( full_name ),
                    claim_messages ( id, sender_id, body, is_read, created_at )
                `)
                .eq('id', requestId)
                .single();
            if (rErr) throw rErr;

            const listing = req.food_listings as any;
            const donorId = listing?.donor_id ?? '';
            const recipientProfile = req.profiles as any;

            // Fetch donor org name + phone
            const [{ data: donorProfile }, { data: donorUser }, { data: recipientOrg }] = await Promise.all([
                supabase.from('donor_profiles').select('organization_name').eq('id', donorId).maybeSingle(),
                supabase.from('profiles').select('phone').eq('id', donorId).maybeSingle(),
                supabase.from('recipient_profiles').select('organization_name, is_charity').eq('id', req.recipient_id).maybeSingle(),
            ]);

            // Batch-fetch sender names for messages
            const msgs = sortByDate((req.claim_messages as any[]) ?? []);
            const senderIds = [...new Set(msgs.map((m: any) => m.sender_id))];
            const senderNames: Record<string, string> = {};
            if (senderIds.length > 0) {
                const { data: senders } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', senderIds);
                (senders ?? []).forEach((s: any) => { senderNames[s.id] = s.full_name ?? ''; });
            }

            const unread = msgs.filter((m: any) => m.sender_id !== currentUserId && !m.is_read).length;

            return {
                id: req.id,
                listingId: req.listing_id,
                listingTitle: listing?.title ?? '',
                donorId,
                donorName: (donorProfile as any)?.organization_name ?? '',
                donorPhone: req.status === 'accepted' ? (donorUser as any)?.phone ?? undefined : undefined,
                recipientId: req.recipient_id,
                recipientName: recipientProfile?.full_name ?? '',
                recipientOrgName: (recipientOrg as any)?.organization_name ?? undefined,
                recipientIsCharity: (recipientOrg as any)?.is_charity ?? undefined,
                status: req.status as ClaimRequestStatus,
                lastMessageBody: msgs[msgs.length - 1]?.body,
                lastMessageAt: msgs[msgs.length - 1]?.created_at,
                unreadCount: unread,
                createdAt: req.created_at,
                messages: msgs.map((m: any) => ({
                    id: m.id,
                    requestId,
                    senderId: m.sender_id,
                    senderName: senderNames[m.sender_id] ?? '',
                    body: m.body,
                    isRead: m.is_read,
                    createdAt: m.created_at,
                })),
                listing: {
                    title: listing?.title ?? '',
                    quantity: listing?.quantity ?? 0,
                    quantityUnit: listing?.quantity_unit ?? '',
                    expiryTime: listing?.expiry_time ?? '',
                    address: listing?.address ?? '',
                },
            };
        });
    },

    /** Send a message in a request thread. */
    sendMessage: async (requestId: string, senderId: string, body: string): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { error } = await supabase
                .from('claim_messages')
                .insert({ request_id: requestId, sender_id: senderId, body: body.trim() });
            if (error) throw error;
            return null;
        });
    },

    /** Mark all unread messages from the other party as read. */
    markMessagesRead: async (requestId: string, currentUserId: string): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { error } = await supabase
                .from('claim_messages')
                .update({ is_read: true })
                .eq('request_id', requestId)
                .eq('is_read', false)
                .neq('sender_id', currentUserId);
            if (error) throw error;
            return null;
        });
    },

    /** Accept a request (donor). Atomic RPC. */
    acceptRequest: async (requestId: string): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { error } = await supabase.rpc('accept_claim_request', { p_request_id: requestId });
            if (error) throw error;
            return null;
        });
    },

    /** Reject a single request (donor). */
    rejectRequest: async (requestId: string): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { error } = await supabase
                .from('claim_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId)
                .eq('status', 'pending');
            if (error) throw error;
            return null;
        });
    },

    /** Withdraw a request (recipient). */
    withdrawRequest: async (requestId: string): Promise<ApiResponse<null>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            const { error } = await supabase
                .from('claim_requests')
                .update({ status: 'withdrawn' })
                .eq('id', requestId)
                .eq('status', 'pending');
            if (error) throw error;
            return null;
        });
    },

    /**
     * For the sidebar unread badge.
     */
    getUnreadCount: async (userId: string, role: 'donor' | 'recipient'): Promise<ApiResponse<number>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        return apiRequest(async () => {
            let requestIds: string[] = [];

            if (role === 'recipient') {
                const { data, error } = await supabase
                    .from('claim_requests')
                    .select('id')
                    .eq('recipient_id', userId)
                    .in('status', ['pending', 'accepted']);
                if (error) throw error;
                requestIds = (data ?? []).map((r: any) => r.id as string);
            } else {
                const { data: listings, error: lErr } = await supabase
                    .from('food_listings')
                    .select('id')
                    .eq('donor_id', userId);
                if (lErr) throw lErr;
                if (listings && listings.length > 0) {
                    const { data, error } = await supabase
                        .from('claim_requests')
                        .select('id')
                        .in('listing_id', listings.map((l: any) => l.id))
                        .eq('status', 'pending');
                    if (error) throw error;
                    requestIds = (data ?? []).map((r: any) => r.id as string);
                }
            }

            if (requestIds.length === 0) return 0;

            const { count, error: cErr } = await supabase
                .from('claim_messages')
                .select('id', { count: 'exact', head: true })
                .in('request_id', requestIds)
                .eq('is_read', false)
                .neq('sender_id', userId);
            if (cErr) throw cErr;

            return count ?? 0;
        });
    },

    /**
     * For MyListings badge: returns a map of listingId -> pending request count.
     */
    getPendingCountsForListings: async (listingIds: string[]): Promise<ApiResponse<Record<string, number>>> => {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured' };
        if (listingIds.length === 0) return { success: true, data: {} };
        return apiRequest(async () => {
            const { data, error } = await supabase
                .from('claim_requests')
                .select('listing_id')
                .in('listing_id', listingIds)
                .eq('status', 'pending');
            if (error) throw error;

            const counts: Record<string, number> = {};
            (data ?? []).forEach((r: any) => {
                counts[r.listing_id] = (counts[r.listing_id] ?? 0) + 1;
            });
            return counts;
        });
    },

    /**
     * Subscribe to new messages in a request thread.
     */
    subscribeToMessages: (
        requestId: string,
        onMessage: (msg: ClaimMessage) => void,
    ): RealtimeChannel => {
        return supabase
            .channel(`claim_messages:${requestId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'claim_messages',
                    filter: `request_id=eq.${requestId}`,
                },
                async (payload) => {
                    const rec = payload.new as any;
                    // Fetch sender name (postgres_changes doesn't include joined data)
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', rec.sender_id)
                        .maybeSingle();
                    onMessage({
                        id: rec.id,
                        requestId: rec.request_id,
                        senderId: rec.sender_id,
                        senderName: (profile as any)?.full_name ?? '',
                        body: rec.body,
                        isRead: rec.is_read,
                        createdAt: rec.created_at,
                    });
                },
            )
            .subscribe();
    },
};
