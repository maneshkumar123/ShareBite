# Request-Based Claims Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace instant claims with a request-based system where multiple recipients can express interest, donor picks who to accept, and both parties can chat in real-time via a dedicated Requests inbox page.

**Architecture:** New `claim_requests` + `claim_messages` tables. `requestService.ts` handles all DB operations. Two new dashboard pages (`/donor/requests`, `/recipient/requests`) with a shared `ClaimRequestChat` component for the chat panel. Supabase Realtime (postgres_changes INSERT on `claim_messages`) drives live messages. The listing detail page replaces the "Claim" button with an inline request form; the old `claimListing` method is no longer called from the UI.

**Tech Stack:** React + TypeScript, Supabase JS v2 (postgres_changes Realtime), React Router v6, existing `apiRequest`/`isSupabaseConfigured` pattern from `src/services/api.ts`.

**Supabase project ID:** `vcvaeyzrnabkhbwhbxgr`

---

### Task 1: Database Migration

**Files:**
- No source files — migration applied via Supabase MCP tool

**Step 1: Apply the migration**

Use `mcp__supabase__apply_migration` with `project_id: vcvaeyzrnabkhbwhbxgr`, `name: add_claim_requests_and_messages`, and the SQL below:

```sql
-- ── Enums ──────────────────────────────────────────────────────────────────────
CREATE TYPE claim_request_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');

-- ── Tables ─────────────────────────────────────────────────────────────────────
CREATE TABLE claim_requests (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  listing_id    uuid NOT NULL REFERENCES food_listings(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  status        claim_request_status NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, recipient_id)
);
CREATE INDEX ON claim_requests (listing_id);
CREATE INDEX ON claim_requests (recipient_id);
CREATE INDEX ON claim_requests (status);

CREATE TABLE claim_messages (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  request_id  uuid NOT NULL REFERENCES claim_requests(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(trim(body)) > 0),
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON claim_messages (request_id);
CREATE INDEX ON claim_messages (created_at);

-- ── RPC: accept_claim_request ───────────────────────────────────────────────────
-- Atomically accepts one request, marks listing as claimed, rejects all others.
CREATE OR REPLACE FUNCTION accept_claim_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing_id   uuid;
  v_recipient_id uuid;
  v_donor_id     uuid;
BEGIN
  SELECT cr.listing_id, cr.recipient_id, fl.donor_id
    INTO v_listing_id, v_recipient_id, v_donor_id
    FROM claim_requests cr
    JOIN food_listings  fl ON fl.id = cr.listing_id
   WHERE cr.id = p_request_id;

  IF v_listing_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_donor_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized: caller is not the listing donor';
  END IF;

  -- Accept this request
  UPDATE claim_requests SET status = 'accepted' WHERE id = p_request_id;

  -- Claim the listing
  UPDATE food_listings
     SET status     = 'claimed',
         claimed_by = v_recipient_id,
         claimed_at = now()
   WHERE id = v_listing_id;

  -- Reject all other pending requests for this listing
  UPDATE claim_requests
     SET status = 'rejected'
   WHERE listing_id = v_listing_id
     AND id        != p_request_id
     AND status     = 'pending';
END;
$$;

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE claim_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_messages  ENABLE ROW LEVEL SECURITY;

-- claim_requests: recipients view their own
CREATE POLICY "recipient_select_own_requests"
  ON claim_requests FOR SELECT
  USING (recipient_id = auth.uid());

-- claim_requests: donors view requests on their listings
CREATE POLICY "donor_select_requests_on_listings"
  ON claim_requests FOR SELECT
  USING (listing_id IN (SELECT id FROM food_listings WHERE donor_id = auth.uid()));

-- claim_requests: recipients create (one per listing enforced by UNIQUE)
CREATE POLICY "recipient_insert_request"
  ON claim_requests FOR INSERT
  WITH CHECK (recipient_id = auth.uid());

-- claim_requests: recipients can withdraw their own pending requests
CREATE POLICY "recipient_withdraw_request"
  ON claim_requests FOR UPDATE
  USING (recipient_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'withdrawn');

-- claim_requests: donors can reject pending requests on their listings
CREATE POLICY "donor_reject_request"
  ON claim_requests FOR UPDATE
  USING (
    status = 'pending'
    AND listing_id IN (SELECT id FROM food_listings WHERE donor_id = auth.uid())
  )
  WITH CHECK (status = 'rejected');

-- claim_messages: both parties in a request can read messages
CREATE POLICY "parties_select_messages"
  ON claim_messages FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM claim_requests WHERE recipient_id = auth.uid()
      UNION
      SELECT cr.id FROM claim_requests cr
        JOIN food_listings fl ON fl.id = cr.listing_id
       WHERE fl.donor_id = auth.uid()
    )
  );

-- claim_messages: either party can send
CREATE POLICY "parties_insert_messages"
  ON claim_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND request_id IN (
      SELECT id FROM claim_requests WHERE recipient_id = auth.uid()
      UNION
      SELECT cr.id FROM claim_requests cr
        JOIN food_listings fl ON fl.id = cr.listing_id
       WHERE fl.donor_id = auth.uid()
    )
  );

-- claim_messages: either party can mark as read (only allowed to flip to true)
CREATE POLICY "parties_mark_read"
  ON claim_messages FOR UPDATE
  USING (
    request_id IN (
      SELECT id FROM claim_requests WHERE recipient_id = auth.uid()
      UNION
      SELECT cr.id FROM claim_requests cr
        JOIN food_listings fl ON fl.id = cr.listing_id
       WHERE fl.donor_id = auth.uid()
    )
  )
  WITH CHECK (is_read = true);

-- ── Realtime ───────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE claim_messages;
```

**Step 2: Verify migration**

Run `mcp__supabase__list_tables` and confirm `claim_requests` and `claim_messages` appear.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add claim_requests and claim_messages DB migration"
```

---

### Task 2: Add routes to constants.ts and AppRouter.tsx

**Files:**
- Modify: `src/utils/constants.ts`
- Modify: `src/router/AppRouter.tsx`

**Step 1: Add routes to constants.ts**

In `src/utils/constants.ts`, add to the ROUTES object after `MY_LISTINGS`:

```ts
DONOR_REQUESTS: '/donor/requests',
```

After `RECIPIENT_PROFILE`:

```ts
RECIPIENT_REQUESTS: '/recipient/requests',
```

And add to `PAGE_TITLES`:

```ts
'/donor/requests':    'Requests',
'/recipient/requests': 'Requests',
```

**Step 2: Register pages in AppRouter.tsx**

Add two imports after the existing donor/recipient imports:

```ts
import DonorRequests    from '@pages/donor/DonorRequests';
import RecipientRequests from '@pages/recipient/RecipientRequests';
```

Inside the `<Route element={<DonorDashboardLayout />}>` block, after the existing donor routes:

```tsx
<Route path={ROUTES.DONOR_REQUESTS} element={<DonorRequests />} />
```

Inside the `<Route element={<RecipientDashboardLayout />}>` block, after the existing recipient routes:

```tsx
<Route path={ROUTES.RECIPIENT_REQUESTS} element={<RecipientRequests />} />
```

**Step 3: Type-check**

```bash
cd /d/ShareBiteNew && npx tsc --noEmit 2>&1
```

Expected: errors only for missing DonorRequests/RecipientRequests modules (files don't exist yet) — that's acceptable at this stage.

**Step 4: Commit**

```bash
git add src/utils/constants.ts src/router/AppRouter.tsx
git commit -m "feat: add DONOR_REQUESTS and RECIPIENT_REQUESTS routes"
```

---

### Task 3: Create requestService.ts

**Files:**
- Create: `src/services/requestService.ts`

**Step 1: Create the file**

```ts
import { supabase, apiRequest, isSupabaseConfigured } from './api';
import type { ApiResponse } from './api';
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
     * Used by ListingDetailPage to know if the recipient already has a pending/accepted/rejected request.
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
     * Used by ClaimRequestChat.
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
     * Returns total unread message count across all requests the user is involved in.
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
     * For MyListings badge: returns a map of listingId → pending request count.
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
     * Returns the RealtimeChannel — caller must call channel.unsubscribe() on cleanup.
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
```

**Step 2: Type-check**

```bash
cd /d/ShareBiteNew && npx tsc --noEmit 2>&1
```

Expected: 0 errors (imports for DonorRequests/RecipientRequests are in AppRouter but those files don't exist yet — that error is acceptable).

**Step 3: Commit**

```bash
git add src/services/requestService.ts
git commit -m "feat: add requestService with claim requests and real-time messaging"
```

---

### Task 4: Update ListingDetailPage.tsx

**Files:**
- Modify: `src/pages/listing/ListingDetailPage.tsx`

Replace the instant-claim flow with an inline request form for recipients, and show a request count link for donors.

**Step 1: Add the request form state and logic**

At the top of `ListingDetailPage.tsx`, add these imports after the existing ones:

```ts
import { requestService } from '@services/requestService';
import type { ClaimRequestStatus } from '@services/requestService';
```

Inside the `ListingDetailPage` component, replace the claim-related state:

```ts
// Replace these lines:
//   const [showModal, setShowModal] = useState(false);
//   const [claiming, setClaiming] = useState(false);
//   const [claimSuccess, setClaimSuccess] = useState(false);

const [myRequest, setMyRequest] = useState<{ id: string; status: ClaimRequestStatus } | null>(null);
const [showRequestForm, setShowRequestForm] = useState(false);
const [requestMessage, setRequestMessage] = useState('');
const [submittingRequest, setSubmittingRequest] = useState(false);
const [requestError, setRequestError] = useState<string | null>(null);
const [pendingCount, setPendingCount] = useState(0);
```

After the listing fetch useEffect, add:

```ts
// Load existing request state for recipient
useEffect(() => {
    if (!listing || !user || isDonor) return;
    requestService.getMyRequestForListing(listing.id, user.id).then(res => {
        if (res.success && res.data) setMyRequest(res.data);
    });
}, [listing?.id, user?.id, isDonor]);

// Load pending count for donor
useEffect(() => {
    if (!listing || !isDonor) return;
    requestService.getPendingCountsForListings([listing.id]).then(res => {
        if (res.success && res.data) setPendingCount(res.data[listing.id] ?? 0);
    });
}, [listing?.id, isDonor]);
```

Replace the `handleClaim` callback and `canClaim` variable with:

```ts
const handleSubmitRequest = useCallback(async () => {
    if (!user?.id || !listing || submittingRequest) return;
    setSubmittingRequest(true);
    setRequestError(null);
    const res = await requestService.createRequest(listing.id, user.id, requestMessage || undefined);
    if (res.success && res.data) {
        setMyRequest({ id: res.data.requestId, status: 'pending' });
        setShowRequestForm(false);
        setRequestMessage('');
    } else {
        setRequestError(res.error ?? 'Failed to send request');
    }
    setSubmittingRequest(false);
}, [user?.id, listing, requestMessage, submittingRequest]);

const canRequest = isRecipient && listing?.status === 'available' && !isExpired && !myRequest;
```

**Step 2: Update the JSX action section**

Replace the entire `{/* Action */}` `<div className="ldp-action">` block with:

```tsx
{/* Action */}
<div className="ldp-action">
    {isDonor ? (
        <div className="ldp-your-listing">
            Your Listing
            {pendingCount > 0 && (
                <Link
                    to={ROUTES.DONOR_REQUESTS}
                    className="ldp-requests-link"
                    onClick={e => e.stopPropagation()}
                >
                    · {pendingCount} pending request{pendingCount !== 1 ? 's' : ''} →
                </Link>
            )}
        </div>
    ) : myRequest ? (
        <div className={`ldp-request-status ldp-request-status--${myRequest.status}`}>
            {myRequest.status === 'pending'  && '⏳ Request sent — waiting for donor'}
            {myRequest.status === 'accepted' && '✓ Request accepted! Contact donor to arrange pickup.'}
            {myRequest.status === 'rejected' && 'Request was not accepted.'}
            {myRequest.status === 'withdrawn' && 'Request withdrawn.'}
            <Link to={ROUTES.RECIPIENT_REQUESTS} className="ldp-requests-link">
                View in My Requests →
            </Link>
        </div>
    ) : listing?.status === 'available' && !isExpired ? (
        showRequestForm ? (
            <div className="ldp-request-form">
                <p className="ldp-request-form-label">Add a message (optional)</p>
                <textarea
                    className="ldp-request-textarea"
                    placeholder="E.g. We're a food bank serving 50 families, can collect by 3 pm..."
                    value={requestMessage}
                    onChange={e => setRequestMessage(e.target.value)}
                    maxLength={500}
                    rows={3}
                    disabled={submittingRequest}
                />
                {requestError && <p className="ldp-request-error" role="alert">{requestError}</p>}
                <div className="ldp-request-form-actions">
                    <button
                        className="ldp-request-cancel"
                        onClick={() => { setShowRequestForm(false); setRequestMessage(''); setRequestError(null); }}
                        disabled={submittingRequest}
                    >
                        Cancel
                    </button>
                    <button
                        className="ldp-request-submit"
                        onClick={handleSubmitRequest}
                        disabled={submittingRequest}
                    >
                        {submittingRequest ? <><SpinnerIcon /> Sending…</> : 'Send Request'}
                    </button>
                </div>
            </div>
        ) : (
            <button className="ldp-claim-btn" onClick={() => setShowRequestForm(true)}>
                Request to Claim
            </button>
        )
    ) : (
        <div className="ldp-status-note">
            {listing?.status === 'claimed'
                ? 'This listing has already been claimed.'
                : 'This listing has expired.'}
        </div>
    )}
</div>
```

Also add `import { Link } from 'react-router-dom';` to the imports (it's not currently imported — verify first with Grep).

**Step 3: Update mobile sticky bar**

Replace `canClaim` with `canRequest`, and replace the sticky bar button's `onClick` to open the form:

```tsx
{canRequest && (
    <div className="ldp-sticky-bar">
        <div className="ldp-sticky-info">
            <span className="ldp-sticky-title">{listing.title}</span>
            <span className="ldp-sticky-expiry">{timeLeft}</span>
        </div>
        <button
            className="ldp-sticky-claim-btn"
            onClick={() => { setShowRequestForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
            Request
        </button>
    </div>
)}
```

**Step 4: Remove the old ConfirmModal usage**

Delete the `{showModal && <ConfirmModal .../>}` block — no longer needed. Keep the `ConfirmModal` component definition in the file for now (it does no harm; it will be removed in a later cleanup).

**Step 5: Add CSS for new elements to `ListingDetailPage.css`**

```css
/* Request Status */
.ldp-request-status {
    padding: 1rem;
    border-radius: 12px;
    font-size: 0.875rem;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.ldp-request-status--pending  { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); color: #f59e0b; }
.ldp-request-status--accepted { background: rgba(125,255,18,0.1); border: 1px solid rgba(125,255,18,0.25); color: #7DFF12; }
.ldp-request-status--rejected,
.ldp-request-status--withdrawn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #888; }

.ldp-requests-link { color: #7DFF12; text-decoration: none; font-size: 0.8125rem; }
.ldp-requests-link:hover { text-decoration: underline; }

/* Request Form */
.ldp-request-form { display: flex; flex-direction: column; gap: 0.75rem; }
.ldp-request-form-label { font-size: 0.8125rem; color: #888; margin: 0; }
.ldp-request-textarea {
    width: 100%;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    color: #F7F7F7;
    font-size: 0.875rem;
    padding: 0.75rem;
    resize: vertical;
    font-family: inherit;
    line-height: 1.5;
}
.ldp-request-textarea:focus { outline: none; border-color: rgba(125,255,18,0.4); }
.ldp-request-error { font-size: 0.8125rem; color: #f87171; margin: 0; }
.ldp-request-form-actions { display: flex; gap: 0.75rem; }
.ldp-request-cancel {
    flex: 1;
    padding: 0.75rem;
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: #888;
    font-size: 0.875rem;
    cursor: pointer;
}
.ldp-request-submit {
    flex: 2;
    padding: 0.75rem;
    border-radius: 10px;
    background: linear-gradient(135deg, #7DFF12, #5AC00A);
    border: none;
    color: #121212;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
}
.ldp-request-submit:disabled { opacity: 0.65; cursor: not-allowed; }
```

**Step 6: Type-check**

```bash
cd /d/ShareBiteNew && npx tsc --noEmit 2>&1
```

Expected: 0 errors (apart from missing DonorRequests/RecipientRequests module errors from AppRouter, which are fine until those files exist).

**Step 7: Commit**

```bash
git add src/pages/listing/ListingDetailPage.tsx src/pages/listing/ListingDetailPage.css
git commit -m "feat: replace instant claim with inline request form on ListingDetailPage"
```

---

### Task 5: Add pending request badges to MyListings.tsx

**Files:**
- Modify: `src/pages/donor/MyListings.tsx`

**Step 1: Import requestService**

Add after the existing imports:

```ts
import { requestService } from '@services/requestService';
```

**Step 2: Add state + fetch**

Inside the `MyListings` component, add:

```ts
const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
```

After the `loadListings` callback, add a new effect:

```ts
useEffect(() => {
    if (listings.length === 0) return;
    const availableIds = listings.filter(l => l.status === 'available').map(l => l.id);
    if (availableIds.length === 0) return;
    requestService.getPendingCountsForListings(availableIds).then(res => {
        if (res.success && res.data) setPendingCounts(res.data);
    });
}, [listings]);
```

**Step 3: Add badge to the card JSX**

Inside the card render, after `<StatusPill status={listing.status} />`, add:

```tsx
{(pendingCounts[listing.id] ?? 0) > 0 && (
    <span className="ml-requests-badge">
        {pendingCounts[listing.id]} req
    </span>
)}
```

**Step 4: Add CSS to MyListings.css**

```css
.ml-requests-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 20px;
    background: rgba(125, 255, 18, 0.15);
    color: #7DFF12;
    border: 1px solid rgba(125, 255, 18, 0.3);
    white-space: nowrap;
}
```

**Step 5: Type-check + commit**

```bash
cd /d/ShareBiteNew && npx tsc --noEmit 2>&1
git add src/pages/donor/MyListings.tsx src/pages/donor/MyListings.css
git commit -m "feat: add pending request count badge to MyListings"
```

---

### Task 6: Add Requests nav item to Sidebar.tsx

**Files:**
- Modify: `src/components/dashboard/Sidebar/Sidebar.tsx`

The Sidebar needs a "Requests" nav item for both roles, with a live unread badge. Since the Sidebar receives `userRole` as a prop but not `userId`, we need to pull the user from `useAuth` inside the component.

**Step 1: Add imports**

```ts
import { useEffect, useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { requestService } from '@services/requestService';
```

**Step 2: Add IconInbox**

```tsx
const IconInbox = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
);
```

**Step 3: Update DONOR_NAV and RECIPIENT_NAV**

```ts
const DONOR_NAV: NavItem[] = [
    { path: ROUTES.DONOR_DASHBOARD, label: 'Dashboard',  icon: <IconGrid />  },
    { path: ROUTES.CREATE_LISTING,  label: 'New Listing', icon: <IconPlus /> },
    { path: ROUTES.MY_LISTINGS,     label: 'My Listings', icon: <IconList />  },
    { path: ROUTES.DONOR_REQUESTS,  label: 'Requests',    icon: <IconInbox /> },
    { path: ROUTES.PROFILE,         label: 'Profile',     icon: <IconUser />  },
];

const RECIPIENT_NAV: NavItem[] = [
    { path: ROUTES.RECIPIENT_DASHBOARD, label: 'Dashboard',  icon: <IconGrid />   },
    { path: ROUTES.BROWSE_LISTINGS,     label: 'Browse Food', icon: <IconSearch /> },
    { path: ROUTES.RECIPIENT_REQUESTS,  label: 'Requests',    icon: <IconInbox />  },
    { path: ROUTES.RECIPIENT_PROFILE,   label: 'Profile',     icon: <IconUser />   },
];
```

**Step 4: Add unread state inside the component**

```tsx
export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, userRole }) => {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user?.id) return;
        const fetchUnread = () => {
            requestService.getUnreadCount(user.id, userRole).then(res => {
                if (res.success && res.data != null) setUnreadCount(res.data);
            });
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 30_000); // refresh every 30s
        return () => clearInterval(interval);
    }, [user?.id, userRole]);
    // ... rest of component
```

**Step 5: Show badge on the Requests link**

In the nav items render, replace the simple `<NavLink>` for items matching `DONOR_REQUESTS` / `RECIPIENT_REQUESTS`:

```tsx
{navItems.map((item) => {
    const isRequests =
        item.path === ROUTES.DONOR_REQUESTS ||
        item.path === ROUTES.RECIPIENT_REQUESTS;
    return (
        <li key={item.path}>
            <NavLink
                to={item.path}
                onClick={onClose}
                end={
                    item.path === ROUTES.DONOR_DASHBOARD ||
                    item.path === ROUTES.RECIPIENT_DASHBOARD
                }
                className={({ isActive }) =>
                    `sb__link ${isActive ? 'sb__link--active' : ''}`
                }
            >
                <span className="sb__link-icon">{item.icon}</span>
                <span className="sb__link-label">{item.label}</span>
                {isRequests && unreadCount > 0 && (
                    <span className="sb__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </NavLink>
        </li>
    );
})}
```

**Step 6: Add badge CSS to Sidebar.css**

```css
.sb__badge {
    margin-left: auto;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #7DFF12;
    color: #121212;
    font-size: 0.6875rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

**Step 7: Type-check + commit**

```bash
cd /d/ShareBiteNew && npx tsc --noEmit 2>&1
git add src/components/dashboard/Sidebar/Sidebar.tsx src/components/dashboard/Sidebar/Sidebar.css
git commit -m "feat: add Requests nav item with unread badge to Sidebar"
```

---

### Task 7: Create ClaimRequestChat component

**Files:**
- Create: `src/components/requests/ClaimRequestChat.tsx`
- Create: `src/components/requests/ClaimRequestChat.css`

This component renders: listing summary card, scrollable message list, message input, and role-specific action buttons. It manages the Realtime subscription internally.

**Step 1: Create `src/components/requests/ClaimRequestChat.tsx`**

```tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { requestService } from '@services/requestService';
import type { ClaimMessage, ClaimRequestDetail, ClaimRequestStatus } from '@services/requestService';
import './ClaimRequestChat.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

// ── Status Badge ───────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: ClaimRequestStatus }> = ({ status }) => {
    const map: Record<ClaimRequestStatus, { label: string; cls: string }> = {
        pending:   { label: 'Pending',   cls: 'crc-badge--pending'   },
        accepted:  { label: 'Accepted',  cls: 'crc-badge--accepted'  },
        rejected:  { label: 'Rejected',  cls: 'crc-badge--rejected'  },
        withdrawn: { label: 'Withdrawn', cls: 'crc-badge--withdrawn' },
    };
    const { label, cls } = map[status];
    return <span className={`crc-badge ${cls}`}>{label}</span>;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ClaimRequestChatProps {
    requestId: string;
    currentUserId: string;
    userRole: 'donor' | 'recipient';
    onAccept?: () => void;  // donor only
    onReject?: () => void;  // donor only
    onWithdraw?: () => void; // recipient only
    onStatusChange?: (newStatus: ClaimRequestStatus) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ClaimRequestChat: React.FC<ClaimRequestChatProps> = ({
    requestId,
    currentUserId,
    userRole,
    onAccept,
    onReject,
    onWithdraw,
    onStatusChange,
}) => {
    const [detail, setDetail] = useState<ClaimRequestDetail | null>(null);
    const [messages, setMessages] = useState<ClaimMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendText, setSendText] = useState('');
    const [sending, setSending] = useState(false);
    const [actioning, setActioning] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'accept' | 'reject' | 'withdraw' | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Load initial data
    useEffect(() => {
        setLoading(true);
        requestService.getRequestWithMessages(requestId, currentUserId).then(res => {
            if (res.success && res.data) {
                setDetail(res.data);
                setMessages(res.data.messages);
                // Mark messages as read
                requestService.markMessagesRead(requestId, currentUserId);
            }
            setLoading(false);
        });
    }, [requestId, currentUserId]);

    // Real-time subscription
    useEffect(() => {
        const channel = requestService.subscribeToMessages(requestId, (newMsg) => {
            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            // Mark as read if the message is from the other party
            if (newMsg.senderId !== currentUserId) {
                requestService.markMessagesRead(requestId, currentUserId);
            }
        });
        return () => { channel.unsubscribe(); };
    }, [requestId, currentUserId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSend = useCallback(async () => {
        const body = sendText.trim();
        if (!body || sending) return;
        setSending(true);
        const res = await requestService.sendMessage(requestId, currentUserId, body);
        if (res.success) {
            setSendText('');
            // Optimistic: message will arrive via Realtime
        }
        setSending(false);
    }, [sendText, sending, requestId, currentUserId]);

    const handleAction = async (action: 'accept' | 'reject' | 'withdraw') => {
        setActioning(true);
        let res;
        if (action === 'accept')   res = await requestService.acceptRequest(requestId);
        else if (action === 'reject')  res = await requestService.rejectRequest(requestId);
        else                           res = await requestService.withdrawRequest(requestId);

        if (res.success) {
            const newStatus: ClaimRequestStatus = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'withdrawn';
            setDetail(prev => prev ? { ...prev, status: newStatus } : prev);
            onStatusChange?.(newStatus);
            if (action === 'accept') onAccept?.();
            if (action === 'reject') onReject?.();
            if (action === 'withdraw') onWithdraw?.();
        }
        setActioning(false);
        setConfirmAction(null);
    };

    if (loading) {
        return (
            <div className="crc-loading">
                <div className="crc-spinner" />
            </div>
        );
    }

    if (!detail) {
        return <div className="crc-error">Could not load request.</div>;
    }

    const isPending = detail.status === 'pending';
    const isAccepted = detail.status === 'accepted';
    const canSend = isPending || isAccepted;

    return (
        <div className="crc">
            {/* ── Listing Summary Card ──── */}
            <div className="crc-listing-card">
                <div className="crc-listing-info">
                    <p className="crc-listing-title">{detail.listing.title}</p>
                    <p className="crc-listing-meta">
                        {detail.listing.quantity} {detail.listing.quantityUnit}
                        {detail.listing.address && ` · ${detail.listing.address}`}
                    </p>
                </div>
                <StatusBadge status={detail.status} />
            </div>

            {/* ── Accepted Banner (recipient) ──── */}
            {isAccepted && userRole === 'recipient' && detail.donorPhone && (
                <div className="crc-accepted-banner">
                    <span>✓ Accepted — contact the donor to arrange pickup</span>
                    <a href={`tel:${detail.donorPhone}`} className="crc-phone-link">{detail.donorPhone}</a>
                </div>
            )}

            {/* ── Recipient Info (donor view) ──── */}
            {userRole === 'donor' && (
                <div className="crc-recipient-info">
                    <span className="crc-recipient-name">{detail.recipientName}</span>
                    {detail.recipientOrgName && (
                        <span className="crc-recipient-org">
                            {detail.recipientOrgName}
                            {detail.recipientIsCharity && ' · Charity'}
                        </span>
                    )}
                </div>
            )}

            {/* ── Messages ──── */}
            <div className="crc-messages">
                {messages.length === 0 ? (
                    <p className="crc-no-messages">No messages yet. Start the conversation.</p>
                ) : (
                    messages.map(msg => {
                        const isOwn = msg.senderId === currentUserId;
                        return (
                            <div key={msg.id} className={`crc-msg ${isOwn ? 'crc-msg--own' : 'crc-msg--other'}`}>
                                {!isOwn && <p className="crc-msg-sender">{msg.senderName}</p>}
                                <div className="crc-msg-bubble">{msg.body}</div>
                                <p className="crc-msg-time">{formatTime(msg.createdAt)}</p>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* ── Input ──── */}
            {canSend ? (
                <div className="crc-input-row">
                    <textarea
                        className="crc-input"
                        value={sendText}
                        onChange={e => setSendText(e.target.value)}
                        placeholder="Type a message…"
                        rows={2}
                        disabled={sending}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <button className="crc-send-btn" onClick={handleSend} disabled={sending || !sendText.trim()}>
                        {sending ? '…' : '↑'}
                    </button>
                </div>
            ) : (
                <p className="crc-closed-note">
                    {detail.status === 'rejected'  && 'This request was not accepted.'}
                    {detail.status === 'withdrawn' && 'This request was withdrawn.'}
                    {detail.status === 'accepted' && userRole === 'donor' && 'Request accepted.'}
                </p>
            )}

            {/* ── Actions ──── */}
            {isPending && (
                <div className="crc-actions">
                    {userRole === 'donor' && (
                        <>
                            <button className="crc-btn-reject" onClick={() => setConfirmAction('reject')} disabled={actioning}>
                                Decline
                            </button>
                            <button className="crc-btn-accept" onClick={() => setConfirmAction('accept')} disabled={actioning}>
                                Accept Request
                            </button>
                        </>
                    )}
                    {userRole === 'recipient' && (
                        <button className="crc-btn-withdraw" onClick={() => setConfirmAction('withdraw')} disabled={actioning}>
                            Withdraw Request
                        </button>
                    )}
                </div>
            )}

            {/* ── Confirm Modal ──── */}
            {confirmAction && (
                <div className="crc-confirm-overlay" onClick={() => setConfirmAction(null)}>
                    <div className="crc-confirm" onClick={e => e.stopPropagation()}>
                        <p className="crc-confirm-text">
                            {confirmAction === 'accept' && 'Accept this request? All other pending requests on this listing will be rejected.'}
                            {confirmAction === 'reject' && 'Decline this request?'}
                            {confirmAction === 'withdraw' && 'Withdraw your claim request?'}
                        </p>
                        <div className="crc-confirm-actions">
                            <button className="crc-btn-cancel" onClick={() => setConfirmAction(null)} disabled={actioning}>Cancel</button>
                            <button
                                className={confirmAction === 'accept' ? 'crc-btn-accept' : 'crc-btn-reject'}
                                onClick={() => handleAction(confirmAction)}
                                disabled={actioning}
                            >
                                {actioning ? '…' : confirmAction === 'accept' ? 'Confirm Accept' : confirmAction === 'reject' ? 'Confirm Decline' : 'Confirm Withdraw'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
```

**Step 2: Create `src/components/requests/ClaimRequestChat.css`**

```css
.crc {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: #1a1a1a;
}

/* Listing summary card */
.crc-listing-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
}
.crc-listing-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #F7F7F7;
    margin: 0 0 0.2rem;
}
.crc-listing-meta {
    font-size: 0.8125rem;
    color: #888;
    margin: 0;
}

/* Status badge */
.crc-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    flex-shrink: 0;
}
.crc-badge--pending   { background: rgba(245,158,11,0.15); color: #f59e0b; }
.crc-badge--accepted  { background: rgba(125,255,18,0.15); color: #7DFF12; }
.crc-badge--rejected,
.crc-badge--withdrawn { background: rgba(255,255,255,0.07); color: #888; }

/* Accepted banner */
.crc-accepted-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1.25rem;
    background: rgba(125,255,18,0.08);
    border-bottom: 1px solid rgba(125,255,18,0.2);
    font-size: 0.8125rem;
    color: #7DFF12;
    flex-shrink: 0;
}
.crc-phone-link { color: #7DFF12; font-weight: 600; text-decoration: none; }
.crc-phone-link:hover { text-decoration: underline; }

/* Recipient info (donor view) */
.crc-recipient-info {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
}
.crc-recipient-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #F7F7F7;
}
.crc-recipient-org {
    font-size: 0.8125rem;
    color: #888;
    margin-left: 0.5rem;
}

/* Messages list */
.crc-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 0;
}
.crc-no-messages {
    font-size: 0.875rem;
    color: #555;
    text-align: center;
    margin: auto;
}
.crc-msg { display: flex; flex-direction: column; max-width: 80%; }
.crc-msg--own   { align-self: flex-end; align-items: flex-end; }
.crc-msg--other { align-self: flex-start; align-items: flex-start; }
.crc-msg-sender { font-size: 0.75rem; color: #888; margin: 0 0 0.25rem; }
.crc-msg-bubble {
    padding: 0.6rem 0.875rem;
    border-radius: 14px;
    font-size: 0.875rem;
    line-height: 1.5;
    word-break: break-word;
}
.crc-msg--own   .crc-msg-bubble { background: #7DFF12; color: #121212; border-radius: 14px 14px 4px 14px; }
.crc-msg--other .crc-msg-bubble { background: rgba(255,255,255,0.08); color: #F7F7F7; border-radius: 14px 14px 14px 4px; }
.crc-msg-time { font-size: 0.6875rem; color: #555; margin: 0.25rem 0 0; }

/* Input */
.crc-input-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
    align-items: flex-end;
}
.crc-input {
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: #F7F7F7;
    font-size: 0.875rem;
    padding: 0.6rem 0.875rem;
    resize: none;
    font-family: inherit;
    line-height: 1.5;
}
.crc-input:focus { outline: none; border-color: rgba(125,255,18,0.4); }
.crc-send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #7DFF12;
    border: none;
    color: #121212;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
.crc-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Closed note */
.crc-closed-note {
    padding: 0.75rem 1.25rem;
    font-size: 0.8125rem;
    color: #555;
    text-align: center;
    border-top: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
}

/* Actions */
.crc-actions {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
}
.crc-btn-accept {
    flex: 2;
    padding: 0.75rem;
    border-radius: 10px;
    background: linear-gradient(135deg, #7DFF12, #5AC00A);
    border: none;
    color: #121212;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
}
.crc-btn-reject, .crc-btn-withdraw {
    flex: 1;
    padding: 0.75rem;
    border-radius: 10px;
    background: rgba(248,113,113,0.1);
    border: 1px solid rgba(248,113,113,0.25);
    color: #f87171;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
}
.crc-btn-accept:disabled,
.crc-btn-reject:disabled,
.crc-btn-withdraw:disabled { opacity: 0.5; cursor: not-allowed; }

/* Confirm modal */
.crc-confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: inherit;
}
.crc-confirm {
    background: #242424;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 320px;
    width: 90%;
}
.crc-confirm-text { font-size: 0.9375rem; color: #F7F7F7; margin: 0 0 1.25rem; line-height: 1.5; }
.crc-confirm-actions { display: flex; gap: 0.75rem; }
.crc-btn-cancel {
    flex: 1;
    padding: 0.7rem;
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: #888;
    font-size: 0.875rem;
    cursor: pointer;
}

/* Loading / error */
.crc-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}
.crc-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255,255,255,0.1);
    border-top-color: #7DFF12;
    border-radius: 50%;
    animation: crc-spin 0.8s linear infinite;
}
@keyframes crc-spin { to { transform: rotate(360deg); } }
.crc-error { padding: 2rem; text-align: center; color: #f87171; font-size: 0.875rem; }
```

**Step 3: Type-check + commit**

```bash
cd /d/ShareBiteNew && npx tsc --noEmit 2>&1
git add src/components/requests/
git commit -m "feat: add ClaimRequestChat shared component with real-time messaging"
```

---

### Task 8: Create RecipientRequests.tsx

**Files:**
- Create: `src/pages/recipient/RecipientRequests.tsx`
- Create: `src/pages/recipient/RecipientRequests.css`

Split-panel layout: left = request list, right = chat panel. On mobile, show list until a request is selected, then show the chat.

**Step 1: Create `src/pages/recipient/RecipientRequests.tsx`**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { requestService } from '@services/requestService';
import type { ClaimRequestSummary, ClaimRequestStatus } from '@services/requestService';
import { ClaimRequestChat } from '@components/requests/ClaimRequestChat';
import './RecipientRequests.css';

const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const STATUS_LABEL: Record<ClaimRequestStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Not Accepted',
    withdrawn: 'Withdrawn',
};

const RecipientRequests: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<ClaimRequestSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false); // mobile: show chat panel

    const loadRequests = useCallback(async () => {
        if (!user) return;
        const res = await requestService.getMyRequests(user.id);
        if (res.success && res.data) setRequests(res.data);
        setLoading(false);
    }, [user]);

    useEffect(() => { loadRequests(); }, [loadRequests]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        setShowChat(true);
    };

    const handleStatusChange = (newStatus: ClaimRequestStatus) => {
        setRequests(prev => prev.map(r => r.id === selectedId ? { ...r, status: newStatus, unreadCount: 0 } : r));
    };

    const selected = requests.find(r => r.id === selectedId);

    return (
        <div className="rreq-page">
            <div className="rreq-header">
                <h1>My Requests</h1>
                <p className="rreq-subtitle">{requests.length} request{requests.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="rreq-layout">
                {/* ── Left: List ── */}
                <div className={`rreq-list-panel ${showChat ? 'rreq-list-panel--hidden-mobile' : ''}`}>
                    {loading ? (
                        <div className="rreq-loading">
                            {[0,1,2].map(i => <div key={i} className="rreq-skeleton" style={{ animationDelay: `${i*80}ms` }} />)}
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="rreq-empty">
                            <p className="rreq-empty-title">No requests yet</p>
                            <p className="rreq-empty-sub">Browse listings and send a claim request to get started.</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <button
                                key={req.id}
                                className={`rreq-card ${selectedId === req.id ? 'rreq-card--active' : ''}`}
                                onClick={() => handleSelect(req.id)}
                            >
                                <div className="rreq-card-top">
                                    <span className="rreq-card-title">{req.listingTitle}</span>
                                    {req.unreadCount > 0 && (
                                        <span className="rreq-unread">{req.unreadCount}</span>
                                    )}
                                </div>
                                <p className="rreq-card-donor">{req.donorName}</p>
                                {req.lastMessageBody && (
                                    <p className="rreq-card-snippet">{req.lastMessageBody}</p>
                                )}
                                <div className="rreq-card-footer">
                                    <span className={`rreq-status rreq-status--${req.status}`}>
                                        {STATUS_LABEL[req.status]}
                                    </span>
                                    <span className="rreq-time">{formatRelative(req.lastMessageAt ?? req.createdAt)}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* ── Right: Chat ── */}
                <div className={`rreq-chat-panel ${!showChat ? 'rreq-chat-panel--hidden-mobile' : ''}`}>
                    {selectedId && user ? (
                        <div className="rreq-chat-wrap" style={{ position: 'relative' }}>
                            {/* Mobile back button */}
                            <button className="rreq-back-btn" onClick={() => setShowChat(false)}>
                                ← Back to Requests
                            </button>
                            <ClaimRequestChat
                                requestId={selectedId}
                                currentUserId={user.id}
                                userRole="recipient"
                                onStatusChange={handleStatusChange}
                                onWithdraw={() => loadRequests()}
                            />
                        </div>
                    ) : (
                        <div className="rreq-empty-chat">
                            <p>Select a request to view the conversation</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecipientRequests;
```

**Step 2: Create `src/pages/recipient/RecipientRequests.css`**

```css
.rreq-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.rreq-header {
    padding: 1.5rem 1.5rem 1rem;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
}
.rreq-header h1 { font-size: 1.5rem; font-weight: 700; color: #F7F7F7; margin: 0 0 0.25rem; }
.rreq-subtitle { font-size: 0.875rem; color: #888; margin: 0; }

.rreq-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

/* List panel */
.rreq-list-panel {
    width: 320px;
    flex-shrink: 0;
    border-right: 1px solid rgba(255,255,255,0.07);
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

/* Chat panel */
.rreq-chat-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

/* Request card */
.rreq-card {
    width: 100%;
    text-align: left;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    padding: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}
.rreq-card:hover,
.rreq-card--active { background: rgba(125,255,18,0.06); border-color: rgba(125,255,18,0.2); }

.rreq-card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.rreq-card-title { font-size: 0.9375rem; font-weight: 600; color: #F7F7F7; }
.rreq-unread {
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 9px; background: #7DFF12; color: #121212;
    font-size: 0.6875rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.rreq-card-donor { font-size: 0.8125rem; color: #888; margin: 0; }
.rreq-card-snippet {
    font-size: 0.8125rem;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
}
.rreq-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 0.25rem; }
.rreq-status { font-size: 0.6875rem; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
.rreq-status--pending   { background: rgba(245,158,11,0.12); color: #f59e0b; }
.rreq-status--accepted  { background: rgba(125,255,18,0.12); color: #7DFF12; }
.rreq-status--rejected,
.rreq-status--withdrawn { background: rgba(255,255,255,0.06); color: #666; }
.rreq-time { font-size: 0.6875rem; color: #555; }

/* Empty / loading */
.rreq-loading { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.rreq-skeleton {
    height: 80px; border-radius: 12px;
    background: linear-gradient(90deg, #1e1e1e 0px, #2a2a2a 200px, #1e1e1e 400px);
    background-size: 400px;
    animation: rreq-shimmer 1.4s infinite;
}
@keyframes rreq-shimmer { to { background-position: 400px 0; } }

.rreq-empty { padding: 3rem 1.5rem; text-align: center; }
.rreq-empty-title { font-size: 1rem; font-weight: 600; color: #F7F7F7; margin: 0 0 0.5rem; }
.rreq-empty-sub { font-size: 0.875rem; color: #666; margin: 0; }

.rreq-empty-chat { flex: 1; display: flex; align-items: center; justify-content: center; }
.rreq-empty-chat p { font-size: 0.875rem; color: #555; }

/* Back button (mobile only) */
.rreq-back-btn {
    display: none;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    color: #7DFF12;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
}
.rreq-chat-wrap { display: flex; flex-direction: column; height: 100%; }

/* Mobile */
@media (max-width: 768px) {
    .rreq-list-panel { width: 100%; border-right: none; }
    .rreq-list-panel--hidden-mobile { display: none; }
    .rreq-chat-panel { position: absolute; inset: 0; z-index: 5; background: #121212; }
    .rreq-chat-panel--hidden-mobile { display: none; }
    .rreq-back-btn { display: block; }
}
```

**Step 3: Type-check + commit**

```bash
cd /d/ShareBiteNew && npx tsc --noEmit 2>&1
git add src/pages/recipient/RecipientRequests.tsx src/pages/recipient/RecipientRequests.css
git commit -m "feat: add RecipientRequests inbox page"
```

---

### Task 9: Create DonorRequests.tsx

**Files:**
- Create: `src/pages/donor/DonorRequests.tsx`
- Create: `src/pages/donor/DonorRequests.css`

Same split-panel layout as RecipientRequests. Left panel groups requests by listing title. Right panel shows ClaimRequestChat with Accept/Reject actions.

**Step 1: Create `src/pages/donor/DonorRequests.tsx`**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { requestService } from '@services/requestService';
import type { ClaimRequestSummary, ClaimRequestStatus } from '@services/requestService';
import { ClaimRequestChat } from '@components/requests/ClaimRequestChat';
import './DonorRequests.css';

const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const STATUS_LABEL: Record<ClaimRequestStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Declined',
    withdrawn: 'Withdrawn',
};

const DonorRequests: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<ClaimRequestSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending'>('pending');

    const loadRequests = useCallback(async () => {
        if (!user) return;
        const res = await requestService.getDonorRequests(user.id);
        if (res.success && res.data) setRequests(res.data);
        setLoading(false);
    }, [user]);

    useEffect(() => { loadRequests(); }, [loadRequests]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        setShowChat(true);
    };

    const handleStatusChange = (newStatus: ClaimRequestStatus) => {
        setRequests(prev => prev.map(r => r.id === selectedId ? { ...r, status: newStatus, unreadCount: 0 } : r));
    };

    const filtered = filter === 'pending'
        ? requests.filter(r => r.status === 'pending')
        : requests;

    // Group by listing
    const grouped: Record<string, ClaimRequestSummary[]> = {};
    filtered.forEach(r => {
        if (!grouped[r.listingId]) grouped[r.listingId] = [];
        grouped[r.listingId].push(r);
    });

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="dreq-page">
            <div className="dreq-header">
                <div>
                    <h1>Requests</h1>
                    <p className="dreq-subtitle">
                        {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="dreq-tabs">
                    <button
                        className={`dreq-tab ${filter === 'pending' ? 'dreq-tab--active' : ''}`}
                        onClick={() => setFilter('pending')}
                    >
                        Pending
                    </button>
                    <button
                        className={`dreq-tab ${filter === 'all' ? 'dreq-tab--active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                </div>
            </div>

            <div className="dreq-layout">
                {/* ── Left: List ── */}
                <div className={`dreq-list-panel ${showChat ? 'dreq-list-panel--hidden-mobile' : ''}`}>
                    {loading ? (
                        <div className="dreq-loading">
                            {[0,1,2].map(i => <div key={i} className="dreq-skeleton" style={{ animationDelay: `${i*80}ms` }} />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="dreq-empty">
                            <p className="dreq-empty-title">
                                {filter === 'pending' ? 'No pending requests' : 'No requests yet'}
                            </p>
                            <p className="dreq-empty-sub">
                                {filter === 'pending'
                                    ? 'Recipients will appear here when they request your listings.'
                                    : 'Switch to "Pending" to see active requests.'}
                            </p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([listingId, reqs]) => (
                            <div key={listingId} className="dreq-group">
                                <p className="dreq-group-label">{reqs[0].listingTitle}</p>
                                {reqs.map(req => (
                                    <button
                                        key={req.id}
                                        className={`dreq-card ${selectedId === req.id ? 'dreq-card--active' : ''}`}
                                        onClick={() => handleSelect(req.id)}
                                    >
                                        <div className="dreq-card-top">
                                            <span className="dreq-card-name">
                                                {req.recipientName}
                                                {req.recipientOrgName && (
                                                    <span className="dreq-card-org"> · {req.recipientOrgName}</span>
                                                )}
                                            </span>
                                            {req.unreadCount > 0 && (
                                                <span className="dreq-unread">{req.unreadCount}</span>
                                            )}
                                        </div>
                                        {req.lastMessageBody && (
                                            <p className="dreq-card-snippet">{req.lastMessageBody}</p>
                                        )}
                                        <div className="dreq-card-footer">
                                            <span className={`dreq-status dreq-status--${req.status}`}>
                                                {STATUS_LABEL[req.status]}
                                            </span>
                                            <span className="dreq-time">{formatRelative(req.lastMessageAt ?? req.createdAt)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {/* ── Right: Chat ── */}
                <div className={`dreq-chat-panel ${!showChat ? 'dreq-chat-panel--hidden-mobile' : ''}`}>
                    {selectedId && user ? (
                        <div className="dreq-chat-wrap" style={{ position: 'relative' }}>
                            <button className="dreq-back-btn" onClick={() => setShowChat(false)}>
                                ← Back to Requests
                            </button>
                            <ClaimRequestChat
                                requestId={selectedId}
                                currentUserId={user.id}
                                userRole="donor"
                                onStatusChange={handleStatusChange}
                                onAccept={() => loadRequests()}
                                onReject={() => loadRequests()}
                            />
                        </div>
                    ) : (
                        <div className="dreq-empty-chat">
                            <p>Select a request to review and chat</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DonorRequests;
```

**Step 2: Create `src/pages/donor/DonorRequests.css`**

```css
.dreq-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.dreq-header {
    padding: 1.5rem 1.5rem 1rem;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}
.dreq-header h1 { font-size: 1.5rem; font-weight: 700; color: #F7F7F7; margin: 0 0 0.25rem; }
.dreq-subtitle { font-size: 0.875rem; color: #888; margin: 0; }

.dreq-tabs { display: flex; gap: 0.5rem; }
.dreq-tab {
    padding: 0.4rem 1rem;
    border-radius: 20px;
    font-size: 0.8125rem;
    font-weight: 600;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #888;
    cursor: pointer;
    transition: all 0.15s;
}
.dreq-tab--active {
    background: rgba(125,255,18,0.12);
    border-color: rgba(125,255,18,0.3);
    color: #7DFF12;
}

.dreq-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.dreq-list-panel {
    width: 320px;
    flex-shrink: 0;
    border-right: 1px solid rgba(255,255,255,0.07);
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.dreq-chat-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

/* Group label */
.dreq-group { display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 0.75rem; }
.dreq-group-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 0.25rem;
}

/* Request card */
.dreq-card {
    width: 100%;
    text-align: left;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    padding: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}
.dreq-card:hover,
.dreq-card--active { background: rgba(125,255,18,0.06); border-color: rgba(125,255,18,0.2); }

.dreq-card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.dreq-card-name { font-size: 0.9375rem; font-weight: 600; color: #F7F7F7; }
.dreq-card-org { font-weight: 400; color: #888; }
.dreq-unread {
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 9px; background: #7DFF12; color: #121212;
    font-size: 0.6875rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.dreq-card-snippet {
    font-size: 0.8125rem; color: #666;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;
}
.dreq-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 0.25rem; }
.dreq-status { font-size: 0.6875rem; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
.dreq-status--pending   { background: rgba(245,158,11,0.12); color: #f59e0b; }
.dreq-status--accepted  { background: rgba(125,255,18,0.12); color: #7DFF12; }
.dreq-status--rejected,
.dreq-status--withdrawn { background: rgba(255,255,255,0.06); color: #666; }
.dreq-time { font-size: 0.6875rem; color: #555; }

/* Empty / loading */
.dreq-loading { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.dreq-skeleton {
    height: 80px; border-radius: 12px;
    background: linear-gradient(90deg, #1e1e1e 0px, #2a2a2a 200px, #1e1e1e 400px);
    background-size: 400px;
    animation: dreq-shimmer 1.4s infinite;
}
@keyframes dreq-shimmer { to { background-position: 400px 0; } }
.dreq-empty { padding: 3rem 1.5rem; text-align: center; }
.dreq-empty-title { font-size: 1rem; font-weight: 600; color: #F7F7F7; margin: 0 0 0.5rem; }
.dreq-empty-sub { font-size: 0.875rem; color: #666; margin: 0; }

.dreq-empty-chat { flex: 1; display: flex; align-items: center; justify-content: center; }
.dreq-empty-chat p { font-size: 0.875rem; color: #555; }

.dreq-back-btn {
    display: none;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    color: #7DFF12;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
}
.dreq-chat-wrap { display: flex; flex-direction: column; height: 100%; }

@media (max-width: 768px) {
    .dreq-list-panel { width: 100%; border-right: none; }
    .dreq-list-panel--hidden-mobile { display: none; }
    .dreq-chat-panel { position: absolute; inset: 0; z-index: 5; background: #121212; }
    .dreq-chat-panel--hidden-mobile { display: none; }
    .dreq-back-btn { display: block; }
    .dreq-header { flex-direction: column; gap: 0.75rem; }
}
```

**Step 3: Final type-check**

```bash
cd /d/ShareBiteNew && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/pages/donor/DonorRequests.tsx src/pages/donor/DonorRequests.css
git commit -m "feat: add DonorRequests inbox page with grouped requests and accept/reject actions"
```

---

## Manual verification checklist

After all 9 tasks, test these flows in the browser (`npm run dev`):

1. **Recipient → Request to Claim**
   - Open a listing as a recipient → see "Request to Claim" button
   - Click → textarea appears → submit → button replaced by "Request Pending" + link
   - Check `/recipient/requests` → card appears with "Pending" badge

2. **Donor → View Requests**
   - Check `/donor/listings` → listing with a pending request shows "1 req" badge
   - Check `/donor/requests` → request card appears, grouped by listing
   - Open the request → see recipient info + chat panel

3. **Chat**
   - Send a message as donor → appears on recipient's side in real-time (open two browsers)
   - Unread badge in sidebar updates

4. **Accept flow**
   - Donor clicks "Accept Request" → confirms → listing status becomes "claimed" in DB
   - Recipient's status badge changes to "Accepted"
   - Donor phone shown to recipient in chat

5. **Reject / Withdraw**
   - Donor declines a request → status changes to "Declined"
   - Recipient withdraws → status changes to "Withdrawn"
