# Google OAuth Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace non-functional GitHub/Google social buttons on Login with a working Google Sign-In flow via Supabase, including a role-selection gate for new users so the DB is populated identically to email signup.

**Architecture:** `signInWithOAuth` triggers a browser redirect to Google; Supabase PKCE flow auto-exchanges the `?code=` on return to `/auth/callback`; `onAuthStateChange(SIGNED_IN)` fires and AuthContext sets user; `AuthCallback` page detects new vs returning user and routes accordingly; new users go through `GoogleSetup` (role + basic info) then the existing `ProfileSetup` (address + map).

**Tech Stack:** Supabase JS v2 (`signInWithOAuth`, `updateUser`), React Router v6, TypeScript, Vite (no test framework — use `npm run type-check` for verification)

---

## Pre-flight: Supabase Dashboard Config (Do This First)

These are manual steps in the browser. The code will not work until these are done.

**Step 1: Enable Google provider**
1. Go to Supabase Dashboard → your project → Authentication → Providers
2. Find Google, toggle it ON
3. You need a Google OAuth client — go to [console.cloud.google.com](https://console.cloud.google.com), create a project, enable "Google+ API", create OAuth 2.0 credentials (Web application type)
4. In Google Cloud Console, add these **Authorized redirect URIs**:
   - `https://vcvaeyzrnabkhbwhbxgr.supabase.co/auth/v1/callback`
5. Copy the Client ID and Client Secret from Google Cloud Console into the Supabase Google provider fields
6. Save

**Step 2: Add allowed redirect URLs in Supabase**
1. Supabase Dashboard → Authentication → URL Configuration
2. Under "Redirect URLs", add:
   - `http://localhost:5173/auth/callback`
   - `http://localhost:5174/auth/callback` (Vite sometimes uses this port)
   - Your production URL when you deploy: `https://yourdomain.com/auth/callback`
3. Save

---

## Task 1: Add new routes to constants.ts

**Files:**
- Modify: `src/utils/constants.ts`

**Step 1: Add two route constants**

In `src/utils/constants.ts`, add `AUTH_CALLBACK` and `GOOGLE_SETUP` to the `ROUTES` object:

```typescript
export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    VERIFY_EMAIL: '/auth/verify-email',
    AUTH_SUCCESS: '/auth/success',
    AUTH_CALLBACK: '/auth/callback',      // ← NEW: OAuth PKCE callback landing page
    GOOGLE_SETUP: '/auth/google-setup',   // ← NEW: role selection for new Google users
    FORGOT_PASSWORD: '/forgot-password',
    PROFILE_SETUP: '/profile-setup',
    // Donor
    DONOR_DASHBOARD: '/donor/dashboard',
    CREATE_LISTING: '/donor/create-listing',
    MY_LISTINGS: '/donor/listings',
    PROFILE: '/profile',
    // Recipient
    RECIPIENT_DASHBOARD: '/recipient/dashboard',
    BROWSE_LISTINGS: '/recipient/browse',
    RECIPIENT_PROFILE: '/recipient/profile',
    // Dynamic
    LISTING_DETAILS: '/listing/:id',
} as const;
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/utils/constants.ts
git commit -m "feat: add AUTH_CALLBACK and GOOGLE_SETUP routes"
```

---

## Task 2: Allow null role in AuthUser type

**Files:**
- Modify: `src/services/authService.ts` (type definition + buildUserFromSession + fetchUserProfile)

**Why:** New Google users have no role in the DB until they pick one in GoogleSetup. `AuthUser.role` must allow `null` so AuthCallback can detect this state.

**Step 1: Update the AuthUser interface**

Change `role: 'donor' | 'recipient'` to allow null:

```typescript
export interface AuthUser {
    id: string;
    email: string;
    role: 'donor' | 'recipient' | null;  // null for new OAuth users before role is selected
    fullName: string;
    phone?: string;
    avatarUrl?: string;
    createdAt: string;
    hasCompletedProfile: boolean;
    donorProfile?: {
        organizationName: string;
        organizationType: string;
        address: string;
        isVerified: boolean;
    };
    recipientProfile?: {
        organizationName?: string;
        address: string;
        isCharity: boolean;
    };
}
```

**Step 2: Fix buildUserFromSession — remove the hardcoded 'donor' fallback**

Find this line in `buildUserFromSession`:
```typescript
role: (meta.role as 'donor' | 'recipient') || 'donor',
```
Change to:
```typescript
role: (meta.role as 'donor' | 'recipient') || null,
```

This means new Google users (no role in JWT metadata) get `role: null` instead of the misleading `'donor'` default.

**Step 3: Fix fetchUserProfile — handle null role from DB**

Find the `authUser` construction in `fetchUserProfile`. Change:
```typescript
const authUser: AuthUser = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.full_name,
    phone: profile.phone,
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
    hasCompletedProfile: false,
};
```
to:
```typescript
const authUser: AuthUser = {
    id: profile.id,
    email: profile.email,
    role: (profile.role as 'donor' | 'recipient') || null,
    fullName: profile.full_name,
    phone: profile.phone,
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
    hasCompletedProfile: false,
};
```

**Step 4: Type-check — expect TypeScript errors in other files**

```bash
npm run type-check
```

Expected: TypeScript errors in `ProfileSetup.tsx` and possibly `AppRouter.tsx` where `user.role` is passed to functions expecting non-null `'donor' | 'recipient'`. Note these files — you will fix them in the next step.

**Step 5: Fix ProfileSetup.tsx — add null role guard**

Open `src/pages/ProfileSetup.tsx`. In the `useEffect` that runs on mount (the one that checks `user?.hasCompletedProfile`), add a guard for null role BEFORE the profile-complete check:

```typescript
useEffect(() => {
    // Guard: if role is not set, user shouldn't be here (send back to google-setup)
    if (user && !user.role) {
        navigate(ROUTES.GOOGLE_SETUP, { replace: true });
        return;
    }

    // Redirect if profile is already complete
    if (user?.hasCompletedProfile) {
        navigate(user.role === 'donor' ? ROUTES.DONOR_DASHBOARD : ROUTES.RECIPIENT_DASHBOARD);
        return;
    }
    // ... rest of the effect unchanged
```

Also add `ROUTES` to the imports if not already there — it should already be imported.

For the submit handler in ProfileSetup where it calls `authService.createRoleProfile(user!.id, user!.role, ...)`, add a non-null assertion or guard:
```typescript
await authService.createRoleProfile(user!.id, user!.role!, {
```
(The `!` is safe here because the guard above ensures role is set before the form can be submitted.)

**Step 6: Type-check again — should be clean**

```bash
npm run type-check
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src/services/authService.ts src/pages/ProfileSetup.tsx
git commit -m "feat: allow null role in AuthUser for new OAuth users"
```

---

## Task 3: Add signInWithGoogle and setUserRole to authService

**Files:**
- Modify: `src/services/authService.ts`

**Step 1: Add signInWithGoogle method**

Add this method to the `authService` object (after the existing `resetPassword` method):

```typescript
/**
 * Initiate Google OAuth sign-in.
 * Triggers a browser redirect — the promise resolves only on error;
 * on success the browser navigates away.
 */
signInWithGoogle: async (): Promise<ApiResponse<null>> => {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase is not configured' };
    }

    return apiRequest(async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                scopes: 'email profile',
            },
        });
        if (error) throw error;
        return null;
    });
},
```

**Step 2: Add setUserRole method**

Add this method after `signInWithGoogle`:

```typescript
/**
 * Set role for a new OAuth user.
 * Updates both the profiles table (DB source of truth) and JWT metadata
 * (so buildUserFromSession works correctly on page reload).
 * Also stores role-specific metadata so ProfileSetup can pre-fill fields.
 */
setUserRole: async (
    userId: string,
    role: 'donor' | 'recipient',
    extraData?: {
        organizationName?: string;
        organizationType?: string;
        isCharity?: boolean;
    }
): Promise<ApiResponse<null>> => {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase is not configured' };
    }

    return apiRequest(async () => {
        // 1. Write role to profiles table
        const { error: dbError } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', userId);
        if (dbError) throw dbError;

        // 2. Persist role + extra data into JWT metadata.
        //    ProfileSetup reads organization_name / organization_type / is_charity
        //    from metadata to pre-fill its form — store them here.
        const metadata: Record<string, unknown> = { role };
        if (extraData?.organizationName) metadata.organization_name = extraData.organizationName;
        if (extraData?.organizationType) metadata.organization_type = extraData.organizationType;
        if (extraData?.isCharity !== undefined) metadata.is_charity = extraData.isCharity;

        const { error: metaError } = await supabase.auth.updateUser({ data: metadata });
        if (metaError) throw metaError;

        return null;
    });
},
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/services/authService.ts
git commit -m "feat: add signInWithGoogle and setUserRole to authService"
```

---

## Task 4: Expose signInWithGoogle in AuthContext

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

**Step 1: Add signInWithGoogle to the context type**

Find `AuthContextType` interface. Add one line:

```typescript
interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isProfileLoading: boolean;
    login: (email: string, password: string) => Promise<ApiResponse<AuthUser>>;
    register: (data: RegisterData) => Promise<ApiResponse<AuthUser>>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    signInWithGoogle: () => Promise<ApiResponse<null>>;  // ← NEW
}
```

**Step 2: Add the implementation inside AuthProvider**

After the `logout` callback definition, add:

```typescript
const signInWithGoogle = useCallback(async (): Promise<ApiResponse<null>> => {
    return authService.signInWithGoogle();
}, []);
```

**Step 3: Add to context value**

Find the `value` object near the bottom of `AuthProvider`. Add `signInWithGoogle`:

```typescript
const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    isProfileLoading,
    login,
    register,
    logout,
    refreshUser,
    signInWithGoogle,  // ← NEW
};
```

**Step 4: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: expose signInWithGoogle in AuthContext"
```

---

## Task 5: Update Login.tsx and Login.css

**Files:**
- Modify: `src/components/auth/Login.tsx`
- Modify: `src/components/auth/Login.css`

**Step 1: Update the useAuth destructure in Login.tsx**

Find:
```typescript
const { login, isAuthenticated, user } = useAuth();
```
Change to:
```typescript
const { login, isAuthenticated, user, signInWithGoogle } = useAuth();
```

**Step 2: Add isGoogleLoading state**

After the existing `useState` declarations (after `rememberMe`), add:
```typescript
const [isGoogleLoading, setIsGoogleLoading] = useState(false);
```

**Step 3: Add handleGoogleSignIn handler**

After the `handleSubmit` function, add:

```typescript
const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrors({});
    const result = await signInWithGoogle();
    if (!result.success) {
        // Only reached if OAuth setup failed (provider not configured, network error)
        setErrors({ submit: result.error || 'Google sign-in failed. Please try again.' });
        setIsGoogleLoading(false);
    }
    // On success, browser redirects to /auth/callback — this component unmounts
};
```

**Step 4: Replace the social buttons section in the JSX**

Find the `{/* Social Login Buttons */}` section (lines ~274–291 in original). Replace the entire `<div className="login-social">` block with:

```tsx
{/* Social Login */}
<div className="login-social">
    <button
        type="button"
        className="login-social-btn login-social-btn--full"
        onClick={handleGoogleSignIn}
        disabled={isSubmitting || isGoogleLoading}
    >
        {isGoogleLoading ? (
            <>
                <span className="spinner"></span>
                Connecting...
            </>
        ) : (
            <>
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
            </>
        )}
    </button>
</div>
```

**Step 5: Update Login.css — make single button full-width**

Find the `.login-social` rule in `Login.css`:
```css
.login-social {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 1rem;
}
```
Change to:
```css
.login-social {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 1rem;
}
```

Also add the full-width modifier class after the `.login-social-btn:disabled` rule:
```css
.login-social-btn--full {
    width: 100%;
    font-size: 0.9375rem;
    font-weight: 600;
    padding: 14px 20px;
}
```

Also in the responsive section, remove the `grid-template-columns: 1fr` override since it's already 1 column:
```css
/* Remove or update this block in @media (max-width: 640px): */
.login-social {
    grid-template-columns: 1fr;  /* already 1fr at all sizes, can leave or remove */
}
```

**Step 6: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 7: Browser smoke test**

```bash
npm run dev
```

Navigate to `/login`. Verify:
- Only the Google button is shown (no GitHub)
- Button is full width
- Clicking shows "Connecting..." spinner (then redirects to Google if dashboard is configured, or shows an error message if not configured yet)

**Step 8: Commit**

```bash
git add src/components/auth/Login.tsx src/components/auth/Login.css
git commit -m "feat: remove GitHub button, wire Google sign-in on Login"
```

---

## Task 6: Create AuthCallback page

**Files:**
- Create: `src/pages/auth/AuthCallback.tsx`

**Purpose:** Landing page after Google OAuth redirect. Shows a spinner while Supabase SDK finishes the PKCE code exchange and AuthContext sets the user. Then routes based on profile state.

**Step 1: Create the file**

Create `src/pages/auth/AuthCallback.tsx` with this exact content:

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { ROUTES } from '@utils/constants';

/**
 * AuthCallback
 *
 * Landing page for the Supabase Google OAuth PKCE redirect.
 * The Supabase JS SDK automatically detects the ?code= param and exchanges
 * it for a session (detectSessionInUrl: true is the default).
 * Once the exchange completes, onAuthStateChange fires SIGNED_IN and
 * AuthContext sets the user. We watch for that and redirect accordingly:
 *
 *   - user.role is null   → new Google user → /auth/google-setup
 *   - role set, no profile → existing auth path → /profile-setup
 *   - role set, complete  → dashboard
 *
 * Timeout fallback: if user never arrives after 8 seconds, send to login.
 */
const AuthCallback: React.FC = () => {
    const { user, isProfileLoading } = useAuth();
    const navigate = useNavigate();
    const [timedOut, setTimedOut] = useState(false);

    // 8-second safety net in case the OAuth session never arrives
    useEffect(() => {
        const timer = setTimeout(() => setTimedOut(true), 8000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Timeout with no user → something went wrong → back to login
        if (timedOut && !user) {
            navigate(ROUTES.LOGIN, { replace: true });
            return;
        }

        // No user yet — keep waiting for onAuthStateChange(SIGNED_IN)
        if (!user) return;

        // User exists but profile enrichment (fetchUserProfile) is still running.
        // Wait for it — we need hasCompletedProfile to be accurate.
        if (isProfileLoading) return;

        if (!user.role) {
            // New Google user — no role set in DB yet
            navigate(ROUTES.GOOGLE_SETUP, { replace: true });
        } else if (!user.hasCompletedProfile) {
            // Has role but hasn't completed address/location setup
            navigate(ROUTES.PROFILE_SETUP, { replace: true });
        } else {
            // Fully set up — go straight to dashboard
            navigate(
                user.role === 'donor' ? ROUTES.DONOR_DASHBOARD : ROUTES.RECIPIENT_DASHBOARD,
                { replace: true }
            );
        }
    }, [user, isProfileLoading, timedOut, navigate]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#121212',
            flexDirection: 'column',
            gap: '1rem',
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(125, 255, 18, 0.15)',
                borderTop: '3px solid #7DFF12',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
                Completing sign in...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default AuthCallback;
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/pages/auth/AuthCallback.tsx
git commit -m "feat: add AuthCallback page for OAuth PKCE redirect handling"
```

---

## Task 7: Create GoogleSetup page

**Files:**
- Create: `src/pages/auth/GoogleSetup.tsx`
- Create: `src/pages/auth/GoogleSetup.css`

**Purpose:** Collects role + basic org info from new Google users. Writes to DB + JWT metadata, then hands off to the existing ProfileSetup for address/location.

**Step 1: Create GoogleSetup.css**

Create `src/pages/auth/GoogleSetup.css`:

```css
/* Google Setup Page — same dark aesthetic as Login/Register */

.google-setup-page {
    min-height: 100vh;
    background-color: #121212;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    font-family: var(--font-family, 'Inter', sans-serif);
}

.google-setup-container {
    max-width: 520px;
    width: 100%;
    background: rgba(30, 30, 30, 0.8);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 3rem;
}

/* Header */
.google-setup-header {
    text-align: center;
    margin-bottom: 2rem;
}

.google-setup-google-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 1.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #F7F7F7;
}

.google-setup-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #F7F7F7;
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
}

.google-setup-subtitle {
    font-size: 0.9375rem;
    color: #888;
    margin: 0;
    line-height: 1.5;
}

/* Form */
.google-setup-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.google-setup-role-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.google-setup-section-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #888;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.google-setup-fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* Error */
.google-setup-error {
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.25);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: #f87171;
}

/* Submit button */
.google-setup-submit {
    width: 100%;
    padding: 1rem;
    background: linear-gradient(135deg, #7DFF12, #5AC00A);
    color: #121212;
    border: none;
    border-radius: 12px;
    font-size: 0.9375rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    letter-spacing: 0.01em;
}

.google-setup-submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(125, 255, 18, 0.3);
}

.google-setup-submit:disabled {
    opacity: 0.65;
    cursor: not-allowed;
    transform: none;
}

/* Spinner — matches the one in Login.css */
.google-setup-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(18, 18, 18, 0.3);
    border-top-color: #121212;
    border-radius: 50%;
    animation: google-spin 0.8s linear infinite;
    flex-shrink: 0;
}

@keyframes google-spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
    .google-setup-container {
        padding: 2rem 1.5rem;
    }

    .google-setup-title {
        font-size: 1.5rem;
    }
}
```

**Step 2: Create GoogleSetup.tsx**

Create `src/pages/auth/GoogleSetup.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleToggle } from '../../components/auth/RoleToggle';
import type { UserRole } from '../../components/auth/RoleToggle';
import { FormField } from '../../components/auth/FormField';
import type { FormFieldConfig } from '../../components/auth/FormField';
import { useAuth } from '@contexts/AuthContext';
import { authService } from '@services/authService';
import { ROUTES } from '@utils/constants';
import './GoogleSetup.css';

// Fields shown when role = donor
const DONOR_FIELDS: FormFieldConfig[] = [
    {
        name: 'organizationName',
        type: 'text',
        label: 'Organization Name',
        placeholder: 'Your restaurant or business name',
        required: true,
    },
    {
        name: 'organizationType',
        type: 'select',
        label: 'Organization Type',
        placeholder: 'Select type',
        required: true,
        options: [
            { value: 'restaurant', label: 'Restaurant' },
            { value: 'cafe', label: 'Café' },
            { value: 'grocery', label: 'Grocery Store' },
            { value: 'bakery', label: 'Bakery' },
            { value: 'catering', label: 'Catering Service' },
            { value: 'other', label: 'Other' },
        ],
    },
];

// Fields shown when role = recipient
const RECIPIENT_FIELDS: FormFieldConfig[] = [
    {
        name: 'organizationName',
        type: 'text',
        label: 'Organization Name (Optional)',
        placeholder: 'If registering for an organization',
        required: false,
    },
    {
        name: 'isCharity',
        type: 'select',
        label: 'Account Type',
        placeholder: 'Select type',
        required: true,
        options: [
            { value: 'false', label: 'Individual' },
            { value: 'true', label: 'Charity / NGO' },
        ],
    },
];

const GoogleSetup: React.FC = () => {
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();

    const [role, setRole] = useState<UserRole>('recipient');
    const [formData, setFormData] = useState<Record<string, string>>({
        organizationName: '',
        organizationType: 'restaurant',
        isCharity: 'false',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Guard: if user already has a role, they shouldn't be on this page
    useEffect(() => {
        if (!user) return;
        if (user.role) {
            navigate(
                user.hasCompletedProfile
                    ? (user.role === 'donor' ? ROUTES.DONOR_DASHBOARD : ROUTES.RECIPIENT_DASHBOARD)
                    : ROUTES.PROFILE_SETUP,
                { replace: true }
            );
        }
    }, [user, navigate]);

    const activeFields = role === 'donor' ? DONOR_FIELDS : RECIPIENT_FIELDS;

    const handleInputChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        activeFields.forEach(field => {
            if (field.required && !formData[field.name]?.trim()) {
                newErrors[field.name] = `${field.label} is required`;
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || !user) return;

        setIsSubmitting(true);
        setErrors({});

        const result = await authService.setUserRole(user.id, role, {
            organizationName: formData.organizationName || undefined,
            organizationType: role === 'donor' ? formData.organizationType : undefined,
            isCharity: role === 'recipient' ? formData.isCharity === 'true' : undefined,
        });

        if (!result.success) {
            setErrors({ submit: result.error || 'Failed to save. Please try again.' });
            setIsSubmitting(false);
            return;
        }

        // Re-fetch profile so AuthContext reflects the new role
        await refreshUser();
        navigate(ROUTES.PROFILE_SETUP, { replace: true });
    };

    return (
        <div className="google-setup-page">
            <div className="google-setup-container">
                <div className="google-setup-header">
                    <div className="google-setup-google-icon">
                        <svg viewBox="0 0 24 24" width="28" height="28">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    </div>
                    <h1 className="google-setup-title">One last step</h1>
                    <p className="google-setup-subtitle">
                        Tell us how you'll be using ShareBite to complete your account setup.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="google-setup-form">
                    <div className="google-setup-role-section">
                        <p className="google-setup-section-label">I want to</p>
                        <RoleToggle
                            selectedRole={role}
                            onRoleChange={setRole}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="google-setup-fields">
                        {activeFields.map(field => (
                            <FormField
                                key={`${role}-${field.name}`}
                                field={field}
                                value={formData[field.name] || ''}
                                onChange={handleInputChange}
                                onBlur={() => {}}
                                error={errors[field.name]}
                                disabled={isSubmitting}
                            />
                        ))}
                    </div>

                    {errors.submit && (
                        <div className="google-setup-error">{errors.submit}</div>
                    )}

                    <button
                        type="submit"
                        className="google-setup-submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="google-setup-spinner" />
                                Setting up...
                            </>
                        ) : (
                            'Continue to Profile Setup'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default GoogleSetup;
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors. If `FormFieldConfig` is missing some fields that GoogleSetup uses (like `options`), verify the type in `FormField.tsx` and adjust the field definitions if needed.

**Step 4: Commit**

```bash
git add src/pages/auth/GoogleSetup.tsx src/pages/auth/GoogleSetup.css
git commit -m "feat: add GoogleSetup page for new Google OAuth user onboarding"
```

---

## Task 8: Register new routes in AppRouter

**Files:**
- Modify: `src/router/AppRouter.tsx`

**Step 1: Add imports**

Add two import lines after the existing auth page imports:

```typescript
import AuthCallback from '@pages/auth/AuthCallback';
import GoogleSetup from '@pages/auth/GoogleSetup';
```

**Step 2: Add routes**

These pages must be standalone routes — NOT wrapped in `RootLayout` (which has Header/Footer) and NOT protected. Add them right after the `<BrowserRouter>` + `<Routes>` opening, before the `<Route element={<RootLayout />}>` block:

```tsx
export const AppRouter: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                {/* OAuth callback routes — standalone, no layout wrapper */}
                <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
                <Route path={ROUTES.GOOGLE_SETUP} element={<GoogleSetup />} />

                {/* Public Routes - With Header/Footer */}
                <Route element={<RootLayout />}>
                    {/* ... existing routes unchanged ... */}
                </Route>

                {/* ... rest of routes unchanged ... */}
            </Routes>
        </BrowserRouter>
    );
};
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 4: Build check**

```bash
npm run build
```

Expected: successful build, no TypeScript errors, no Vite errors.

**Step 5: Commit**

```bash
git add src/router/AppRouter.tsx
git commit -m "feat: register AuthCallback and GoogleSetup routes in AppRouter"
```

---

## Task 9: End-to-end verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Verify Login page UI**
- Navigate to `http://localhost:5173/login`
- Confirm: only Google button visible, full-width, no GitHub button

**Step 3: Verify new Google user flow** (requires Supabase dashboard config from Pre-flight)
1. Click "Continue with Google" on login page
2. Complete Google sign-in with a new Google account
3. Should land on `/auth/callback` (spinner briefly visible)
4. Should redirect to `/auth/google-setup`
5. Select a role (e.g., Donor), fill in org name + type
6. Click "Continue to Profile Setup"
7. Should redirect to `/profile-setup` with org name pre-filled
8. Complete address + map location
9. Should redirect to `/donor/dashboard`
10. Check Supabase Dashboard → Table Editor → `profiles` table: verify `role = 'donor'` is set
11. Check `donor_profiles` table: verify the row was created with org name, org type, location

**Step 4: Verify returning Google user flow**
1. Sign out
2. Click "Continue with Google" again with the same account
3. Should land on `/auth/callback` → redirect straight to `/donor/dashboard` (no setup screens)

**Step 5: Verify existing email/password login is unaffected**
1. Sign out
2. Use the email+password form to log in
3. Should work exactly as before

**Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete Google OAuth integration - remove GitHub, add full sign-in flow"
```

---

## Troubleshooting

**"Provider not configured" error when clicking Google button**
→ Check Pre-flight steps. Google provider must be enabled in Supabase Dashboard with valid Client ID + Secret.

**Redirect goes to wrong URL / "redirect_uri_mismatch" from Google**
→ The exact URL `https://vcvaeyzrnabkhbwhbxgr.supabase.co/auth/v1/callback` must be in Google Cloud Console's Authorized redirect URIs (not your app's URL — Supabase's URL).

**AuthCallback page redirects to login (timed out)**
→ `http://localhost:5173/auth/callback` is not in Supabase's allowed Redirect URLs. Add it in Supabase Dashboard → Auth → URL Configuration.

**user.role is still null after GoogleSetup**
→ The `profiles.update({ role })` call may have hit a RLS (Row Level Security) policy that prevents the update. Check Supabase Dashboard → Auth → Policies on the `profiles` table. The user should be able to UPDATE their own row: `auth.uid() = id`.

**GoogleSetup shows but pre-fills wrong role**
→ The `useEffect` guard that redirects when `user.role` is already set has a timing issue. Verify `refreshUser()` is being awaited before navigate.
