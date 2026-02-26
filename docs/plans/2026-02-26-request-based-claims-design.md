# Request-Based Claims — Design Doc

**Date:** 2026-02-26
**Status:** Approved

---

## Problem

The current claim flow is instant and exclusive: the first recipient to click "Claim This Food" locks the listing. Donors have no say in who receives their food and no way to contact or evaluate claimants. This replaces it with a request-based system where multiple recipients can express interest, donors choose who to accept, and both parties can communicate in real-time before pickup.

---

## Flow

### Recipient

```
Listing Detail (available)
  ↓ "Request to Claim" button
  ↓ Inline textarea (optional message) + "Send Request"
  ↓ requestService.createRequest(listingId, recipientId, message?)
  ↓ Button replaced by "Request Pending — View in My Requests →"

/recipient/requests
  ├─ List of all requests (pending / accepted / rejected)
  ├─ Each card: listing title, donor org, status badge, last message snippet, unread dot
  └─ Click card → ClaimRequestChat component
      ├─ Listing summary card at top
      ├─ Scrollable message thread (real-time via Supabase)
      ├─ Message input + send
      └─ "Withdraw Request" button (pending only)

Accepted request → green banner + donor phone shown for pickup coordination
```

### Donor

```
MyListings
  └─ Each listing row gets "N requests" badge if pending requests exist

Listing Detail (own listing)
  └─ "Your Listing · 3 pending requests →" link to /donor/requests

/donor/requests
  ├─ Requests grouped by listing
  ├─ Each card: recipient name + org, listing title, status badge, last message snippet, unread dot
  └─ Click card → ClaimRequestChat component
      ├─ Listing summary card at top
      ├─ Recipient profile summary (org name, is_charity)
      ├─ Scrollable message thread (real-time)
      ├─ Message input + send
      └─ "Accept" + "Reject" buttons (pending only)

Accept → confirm modal → accept_claim_request() RPC fires atomically:
  - claim_request.status → accepted
  - food_listing.status → claimed, claimed_by, claimed_at set
  - All other pending requests on same listing → rejected
```

---

## Architecture

### Database

#### New table: `claim_requests`
```sql
CREATE TYPE claim_request_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');

CREATE TABLE claim_requests (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  listing_id    uuid NOT NULL REFERENCES food_listings(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        claim_request_status NOT NULL DEFAULT 'pending',
  created_at    timestamptz DEFAULT now(),
  UNIQUE (listing_id, recipient_id)
);

CREATE INDEX ON claim_requests(listing_id);
CREATE INDEX ON claim_requests(recipient_id);
```

#### New table: `claim_messages`
```sql
CREATE TABLE claim_messages (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  request_id  uuid NOT NULL REFERENCES claim_requests(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        text NOT NULL,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON claim_messages(request_id);
CREATE INDEX ON claim_messages(created_at);
```

#### New RPC: `accept_claim_request(p_request_id uuid)`
Atomic transaction:
1. Verify calling user is the donor of the listing
2. Set `claim_requests.status = 'accepted'` for p_request_id
3. Set `food_listings.status = 'claimed'`, `claimed_by = recipient_id`, `claimed_at = now()`
4. Set all other `claim_requests.status = 'rejected'` for same listing_id

#### RLS policies
- `claim_requests`: recipient can SELECT/INSERT/UPDATE (withdraw) their own rows; donor can SELECT rows on their listings; donor can UPDATE status via RPC only
- `claim_messages`: sender can INSERT; both parties (recipient + donor of the listing) can SELECT and UPDATE `is_read`

#### Supabase Realtime
Enable postgres_changes on `claim_messages` (INSERT). Subscribe per `request_id` channel when chat is open.

### Modified tables
`food_listings` — no schema changes. `status`, `claimed_by`, `claimed_at` still used, now set by the RPC instead of direct update.

---

## New Files

| File | Purpose |
|------|---------|
| `src/services/requestService.ts` | All claim request + message operations |
| `src/pages/donor/DonorRequests.tsx` + `.css` | Donor requests inbox |
| `src/pages/recipient/RecipientRequests.tsx` + `.css` | Recipient requests inbox |
| `src/components/requests/ClaimRequestChat.tsx` + `.css` | Shared chat thread component |

## Modified Files

| File | Change |
|------|--------|
| `src/utils/constants.ts` | Add `DONOR_REQUESTS`, `RECIPIENT_REQUESTS` routes |
| `src/router/AppRouter.tsx` | Register both new routes inside dashboard layouts |
| `src/pages/listing/ListingDetailPage.tsx` | Recipient: inline request form. Donor: request count link |
| `src/pages/donor/MyListings.tsx` | Add pending request count badge per row |
| `src/components/dashboard/Sidebar/Sidebar.tsx` | Add "Requests" nav item with unread badge |

---

## requestService.ts API

```ts
// Create a new claim request (recipient)
createRequest(listingId: string, recipientId: string, message?: string): Promise<ApiResponse<{ requestId: string }>>

// Get all requests for the current recipient
getMyRequests(recipientId: string): Promise<ApiResponse<ClaimRequestSummary[]>>

// Get all requests across donor's listings
getDonorRequests(donorId: string): Promise<ApiResponse<ClaimRequestSummary[]>>

// Get request detail + messages for a specific request
getRequestWithMessages(requestId: string): Promise<ApiResponse<ClaimRequestDetail>>

// Get the current user's request on a specific listing (for listing detail page)
getMyRequestForListing(listingId: string, recipientId: string): Promise<ApiResponse<ClaimRequestSummary | null>>

// Send a message in a request thread
sendMessage(requestId: string, senderId: string, body: string): Promise<ApiResponse<null>>

// Mark all unread messages in a request as read (for the current user)
markMessagesRead(requestId: string, userId: string): Promise<ApiResponse<null>>

// Accept a request (donor) — calls accept_claim_request RPC
acceptRequest(requestId: string): Promise<ApiResponse<null>>

// Reject a request (donor)
rejectRequest(requestId: string): Promise<ApiResponse<null>>

// Withdraw a request (recipient)
withdrawRequest(requestId: string): Promise<ApiResponse<null>>

// Subscribe to new messages in a request thread (real-time)
subscribeToMessages(requestId: string, onMessage: (msg: ClaimMessage) => void): RealtimeChannel

// Get unread message count for sidebar badge
getUnreadCount(userId: string): Promise<ApiResponse<number>>
```

---

## Key Types

```ts
type ClaimRequestStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

interface ClaimRequestSummary {
  id: string;
  listingId: string;
  listingTitle: string;
  donorName: string;         // for recipient view
  recipientName: string;     // for donor view
  recipientOrgName?: string; // for donor view
  recipientIsCharity?: boolean;
  status: ClaimRequestStatus;
  lastMessageBody?: string;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
}

interface ClaimRequestDetail extends ClaimRequestSummary {
  messages: ClaimMessage[];
  listing: { title: string; quantity: number; quantityUnit: string; expiryTime: string; address: string; };
  donorPhone?: string;       // shown to recipient only when accepted
}

interface ClaimMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderName: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}
```

---

## What Does NOT Change

- `ProfileSetup`, `AuthCallback`, Google OAuth flow — untouched
- `DonorDashboard` stats (meals shared counts accepted claims via `food_listings.status = 'claimed'`) — still works
- `RecipientDashboard` nearby listings feed — still queries `status = 'available'`
- Existing `notifications` table — not extended in this feature (real-time chat covers in-app communication)
