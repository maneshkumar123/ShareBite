# Auth & Profile Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the auth → email verify → profile setup → dashboard flow with Mapbox GL JS map integration and a working recipient dashboard, so all routes and user flows function without errors.

**Architecture:** ProfileSetup reads Supabase user metadata to pre-fill org data collected during registration. A Mapbox GL JS interactive map in ProfileSetup gives users visual confirmation of their captured location. A basic RecipientDashboard is created to unblock recipients from hitting the router's dead end. AuthSuccess is cleaned up to remove stale placeholder content.

**Tech Stack:** React 19, TypeScript, Supabase JS v2, Mapbox GL JS v3, React Router v7, CSS Modules

---

## Context & Current State

- `.env.local` is present with all 3 env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_ACCESS_TOKEN`
- `handle_new_user` trigger on `auth.users` auto-creates `profiles` rows on signup ✅
- `authService.createRoleProfile()` upserts into `donor_profiles` / `recipient_profiles` using `SRID=4326;POINT(lng lat)` PostGIS format ✅
- `geolocationService` uses Mapbox Geocoding API v5 for address → coords ✅
- `FormField` supports `type: 'select'` ✅
- TypeScript build is currently clean ✅
- **Missing**: ProfileSetup doesn't pre-fill from metadata, no Mapbox map, no RecipientDashboard, stale AuthSuccess, no recipient routes in AppRouter

---

## Task 1: Install Mapbox GL JS

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/components/common/MapPicker.tsx`
- Create: `src/components/common/MapPicker.css`

**Step 1: Install packages**

```bash
npm install mapbox-gl
npm install --save-dev @types/mapbox-gl
```

Expected: mapbox-gl ~3.x installed, @types/mapbox-gl as devDep.

**Step 2: Create `src/components/common/MapPicker.tsx`**

This is a reusable map component that shows a draggable marker. Parent passes in `latitude`, `longitude`, and `onLocationChange` callback.

```tsx
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapPicker.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface MapPickerProps {
    latitude: number;
    longitude: number;
    onLocationChange: (lat: number, lng: number) => void;
}

const MapPicker: React.FC<MapPickerProps> = ({ latitude, longitude, onLocationChange }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const marker = useRef<mapboxgl.Marker | null>(null);

    // Initialize map once
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [longitude, latitude],
            zoom: 14,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Draggable marker
        marker.current = new mapboxgl.Marker({ color: '#7DFF12', draggable: true })
            .setLngLat([longitude, latitude])
            .addTo(map.current);

        marker.current.on('dragend', () => {
            const lngLat = marker.current!.getLngLat();
            onLocationChange(lngLat.lat, lngLat.lng);
        });

        return () => {
            map.current?.remove();
            map.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update marker position when lat/lng props change externally
    useEffect(() => {
        if (!map.current || !marker.current) return;
        marker.current.setLngLat([longitude, latitude]);
        map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
    }, [latitude, longitude]);

    return <div ref={mapContainer} className="map-picker" />;
};

export default MapPicker;
```

**Step 3: Create `src/components/common/MapPicker.css`**

```css
.map-picker {
    width: 100%;
    height: 260px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 0.75rem;
}
```

**Step 4: Export from `src/components/common/index.ts`**

Add to existing exports:
```ts
export { default as MapPicker } from './MapPicker';
```

Check if `src/components/common/index.ts` exists first — if it uses named re-exports, add the MapPicker there.

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/components/common/MapPicker.tsx src/components/common/MapPicker.css package.json package-lock.json
git commit -m "feat: add MapPicker component with Mapbox GL JS dark theme"
```

---

## Task 2: Fix ProfileSetup — Pre-fill from Metadata + Add Map

**Files:**
- Modify: `src/pages/ProfileSetup.tsx`
- Modify: `src/pages/ProfileSetup.css` (add map section styles)

**Step 1: Read the current ProfileSetup.tsx** (`src/pages/ProfileSetup.tsx:44-55`)

The `useEffect` has a TODO comment at line 50-53:
```ts
if (user) {
    // In a real implementation, you'd fetch this from user metadata
    // For now, we'll leave it empty
}
```

**Step 2: Replace the useEffect with metadata pre-fill**

Replace lines 44-55 with:

```ts
useEffect(() => {
    if (user?.hasCompletedProfile) {
        navigate(user.role === 'donor' ? ROUTES.DONOR_DASHBOARD : ROUTES.RECIPIENT_DASHBOARD);
        return;
    }

    // Pre-fill from registration metadata stored in Supabase user object
    const prefillFromMetadata = async () => {
        const { data } = await supabase.auth.getUser();
        const meta = data.user?.user_metadata;
        if (!meta) return;
        setFormData((prev) => ({
            ...prev,
            organizationName: (meta.organization_name as string) || '',
            organizationType: (meta.organization_type as string) || 'restaurant',
            address: (meta.address as string) || '',
            isCharity: String(Boolean(meta.is_charity)),
        }));
    };

    prefillFromMetadata();
}, [user, navigate]);
```

Add the import at the top of the file:
```ts
import { supabase } from '@services/api';
```

**Step 3: Integrate MapPicker into ProfileSetup JSX**

Add `MapPicker` import:
```ts
import MapPicker from '@components/common/MapPicker';
```

Add state for map display:
```ts
const [showMap, setShowMap] = useState(false);
```

Replace the location capture section (the `profile-setup__location` div) with this updated version that shows the map after location is captured:

```tsx
<div className="profile-setup__location">
    <label>
        Location <span className="required">*</span>
    </label>
    <p className="profile-setup__location-hint">
        We need your location to match you with nearby {isDonor ? 'recipients' : 'food donors'}
    </p>

    <div className="profile-setup__location-buttons">
        <Button
            type="button"
            variant="secondary"
            onClick={handleGetCurrentLocation}
            disabled={isGettingLocation}
        >
            {isGettingLocation && locationMethod === null
                ? 'Getting Location...'
                : '📍 Use Current Location'}
        </Button>

        <span className="profile-setup__location-or">OR</span>

        <Button
            type="button"
            variant="secondary"
            onClick={handleGeocodeAddress}
            disabled={isGettingLocation || !formData.address.trim()}
        >
            {isGettingLocation && locationMethod === 'geocode'
                ? 'Finding Address...'
                : '🗺️ Find on Map'}
        </Button>
    </div>

    {location && (
        <>
            <div className="profile-setup__location-success">
                ✓ Location captured — drag the pin below to adjust
            </div>
            <MapPicker
                latitude={location.latitude}
                longitude={location.longitude}
                onLocationChange={(lat, lng) => setLocation({ latitude: lat, longitude: lng })}
            />
        </>
    )}

    {errors.location && (
        <span className="form-field__error">{errors.location}</span>
    )}
</div>
```

Remove unused `showMap` state if added (use `location` as the condition instead).

**Step 4: Add map section styling to `ProfileSetup.css`**

Append at end of file:
```css
.profile-setup__location-success {
    font-size: 0.875rem;
    color: #7DFF12;
    margin-bottom: 0.5rem;
}
```

(Only if it's not already defined in the file — check first.)

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/pages/ProfileSetup.tsx src/pages/ProfileSetup.css
git commit -m "feat: prefill ProfileSetup from user metadata, add Mapbox map with draggable pin"
```

---

## Task 3: Create RecipientDashboard

**Files:**
- Create: `src/pages/recipient/RecipientDashboard.tsx`
- Create: `src/pages/recipient/RecipientDashboard.css`

**Step 1: Check what donor dashboard looks like for patterns**

Read `src/pages/donor/DonorDashboard.tsx` to understand the pattern. The dashboard uses `StatsCard`, `DashboardLayout`, etc.

**Step 2: Create `src/pages/recipient/RecipientDashboard.tsx`**

```tsx
import React from 'react';
import { useAuth } from '@contexts/AuthContext';
import { StatsCard } from '@components/common';
import './RecipientDashboard.css';

const RecipientDashboard: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className="recipient-dashboard">
            <div className="recipient-dashboard__header">
                <h1>Welcome back, {user?.fullName?.split(' ')[0] || 'there'} 👋</h1>
                <p className="recipient-dashboard__subtitle">
                    Find and claim surplus food near you
                </p>
            </div>

            <div className="recipient-dashboard__stats">
                <StatsCard
                    title="Meals Claimed"
                    value="0"
                    icon="🤝"
                    description="Total meals you've claimed"
                />
                <StatsCard
                    title="Nearby Listings"
                    value="0"
                    icon="📍"
                    description="Available food near you"
                />
                <StatsCard
                    title="This Month"
                    value="0"
                    icon="📅"
                    description="Meals claimed this month"
                />
            </div>

            <div className="recipient-dashboard__empty">
                <div className="recipient-dashboard__empty-icon">🍽️</div>
                <h3>No listings near you yet</h3>
                <p>When donors post surplus food in your area, it will appear here.</p>
            </div>
        </div>
    );
};

export default RecipientDashboard;
```

**Step 3: Create `src/pages/recipient/RecipientDashboard.css`**

```css
.recipient-dashboard {
    padding: 2rem;
    color: #F7F7F7;
}

.recipient-dashboard__header {
    margin-bottom: 2rem;
}

.recipient-dashboard__header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
}

.recipient-dashboard__subtitle {
    color: #888;
    margin: 0;
}

.recipient-dashboard__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
}

.recipient-dashboard__empty {
    text-align: center;
    padding: 4rem 2rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
}

.recipient-dashboard__empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.recipient-dashboard__empty h3 {
    font-size: 1.125rem;
    margin: 0 0 0.5rem;
}

.recipient-dashboard__empty p {
    color: #888;
    margin: 0;
}
```

**Step 4: Commit**

```bash
git add src/pages/recipient/RecipientDashboard.tsx src/pages/recipient/RecipientDashboard.css
git commit -m "feat: add basic RecipientDashboard page"
```

---

## Task 4: Add Recipient Routes to AppRouter

**Files:**
- Modify: `src/router/AppRouter.tsx`

**Step 1: Add RecipientDashboard import at top of AppRouter.tsx**

After the donor import line:
```ts
import RecipientDashboard from '@pages/recipient/RecipientDashboard';
```

**Step 2: Add RecipientDashboardLayout component (after DonorDashboardLayout)**

```tsx
const RecipientDashboardLayout: React.FC = () => {
    return (
        <ProtectedRoute requiredRole="recipient">
            <DashboardLayout userRole="recipient" />
        </ProtectedRoute>
    );
};
```

**Step 3: Add recipient routes inside the Routes block (after the donor routes block)**

```tsx
{/* Recipient Dashboard Routes */}
<Route element={<RecipientDashboardLayout />}>
    <Route path={ROUTES.RECIPIENT_DASHBOARD} element={<RecipientDashboard />} />
    <Route path={ROUTES.PROFILE} element={<ProfilePlaceholder />} />
</Route>
```

**Step 4: Fix the ProtectedRoute role-based redirect** (line 74 currently)

The current code redirects non-matching roles to ROUTES.HOME for recipients. Fix it to redirect recipients to their dashboard:

```tsx
if (requiredRole && user?.role !== requiredRole) {
    if (user?.role === 'donor') {
        return <Navigate to={ROUTES.DONOR_DASHBOARD} replace />;
    }
    if (user?.role === 'recipient') {
        return <Navigate to={ROUTES.RECIPIENT_DASHBOARD} replace />;
    }
    return <Navigate to={ROUTES.HOME} replace />;
}
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/router/AppRouter.tsx
git commit -m "feat: add recipient dashboard routes and fix role redirect"
```

---

## Task 5: Clean Up AuthSuccess Page

**Files:**
- Modify: `src/pages/auth/AuthSuccess.tsx`

**Step 1: Remove the "Dashboard Coming Soon" block**

Delete lines 108-115 (the `success-coming-soon` div):
```tsx
{/* Dashboard Coming Soon */}
<div className="success-coming-soon">
    <h4>Dashboard Coming Soon!</h4>
    <p>
        We're building your personalized {isDonor ? 'donor' : 'recipient'} dashboard.
        You'll be able to {isDonor ? 'post listings and manage donations' : 'find food and track claims'} here.
    </p>
</div>
```

**Step 2: Add a "Go to Dashboard" button for authenticated users with complete profiles**

Replace the `success-actions` div with:

```tsx
<div className="success-actions">
    {user?.hasCompletedProfile ? (
        <>
            <Link
                to={user.role === 'donor' ? ROUTES.DONOR_DASHBOARD : ROUTES.RECIPIENT_DASHBOARD}
                className="success-btn-primary"
            >
                Go to Dashboard
            </Link>
            <button onClick={handleLogout} className="success-btn-secondary">
                Sign Out
            </button>
        </>
    ) : isFromLogin ? (
        <>
            <Link to={ROUTES.PROFILE_SETUP} className="success-btn-primary">
                Complete Profile
            </Link>
            <button onClick={handleLogout} className="success-btn-secondary">
                Sign Out
            </button>
        </>
    ) : (
        <>
            <Link to={ROUTES.HOME} className="success-btn-primary">
                Back to Home
            </Link>
            <Link to={ROUTES.LOGIN} className="success-btn-secondary">
                Sign In
            </Link>
        </>
    )}
</div>
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/pages/auth/AuthSuccess.tsx
git commit -m "fix: clean up AuthSuccess - remove stale placeholder, add proper dashboard/profile links"
```

---

## Task 6: Verify Full Build & Check DashboardLayout for Recipient Support

**Files:**
- Check: `src/components/dashboard/DashboardLayout.tsx` (ensure `userRole="recipient"` is handled)

**Step 1: Read DashboardLayout**

Check if `userRole="recipient"` affects sidebar nav items, header display, etc. The sidebar might only show donor-specific links.

**Step 2: Fix recipient sidebar nav if needed**

The Sidebar component likely uses `userRole` to determine navigation links. Ensure recipient nav links (Browse, Profile) are shown when `userRole === 'recipient'`.

**Step 3: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Note any warnings.

**Step 4: Fix any build errors found**

If TypeScript errors or import errors appear, fix them one by one.

**Step 5: Final commit if any fixes made**

```bash
git add -p
git commit -m "fix: ensure build passes and DashboardLayout supports recipient role"
```

---

## Task 7: End-to-End Smoke Test

**Manual test sequence:**

1. Start dev server: `npm run dev`
2. Register a new donor account → should land on `/auth/verify-email`
3. Verify email (check inbox) → link opens `/auth/success` → auto-redirects to `/profile-setup`
4. On ProfileSetup: org name/type/address should be pre-filled from registration
5. Click "Use Current Location" → browser asks for GPS → marker appears on Mapbox map
6. Drag marker to adjust → submit → should redirect to `/donor/dashboard`
7. Register a recipient account → repeat steps 2-6 → should redirect to `/recipient/dashboard`
8. Login as existing user with complete profile → should go straight to dashboard
9. Login as user without complete profile → should redirect to `/profile-setup`

**Expected results:**
- All redirects work correctly
- Mapbox map renders with dark theme
- Profile pre-fill works for users who registered with org data
- Both donor and recipient dashboards load without errors
- No TypeScript/console errors
