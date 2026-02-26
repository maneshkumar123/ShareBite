# Google OAuth Integration — Design Doc

**Date:** 2026-02-26
**Status:** Approved

---

## Problem

The Login form has non-functional Google and GitHub social buttons. The task is to:
1. Remove GitHub entirely
2. Wire up Google Sign-In using Supabase OAuth, end-to-end

New users signing in via Google have no `role` in `profiles` (the DB trigger runs but has no role metadata from Google). They need a role-selection step before the existing ProfileSetup can complete their account.

---

## Flow

```
Login page
  ↓ "Continue with Google" button click
authService.signInWithGoogle()
  ↓ redirects to Google via Supabase
  ↓ Google redirects to /auth/callback?code=xxx
  ↓ Supabase SDK auto-exchanges code (PKCE, detectSessionInUrl: true)
  ↓ onAuthStateChange fires SIGNED_IN → AuthContext sets user

/auth/callback (loading spinner page)
  ├─ user.role is null → /auth/google-setup
  ├─ user.role set, !hasCompletedProfile → /profile-setup (existing)
  └─ user.role set, hasCompletedProfile → /donor/dashboard or /recipient/dashboard

/auth/google-setup (new page)
  ↓ Role toggle (Donor / Recipient) — reuses existing RoleToggle component
  ↓ Role-specific fields:
      Donor: organizationName (required), organizationType (select)
      Recipient: organizationName (optional), isCharity (select)
  ↓ Submit → authService.setUserRole() → updates profiles.role + JWT metadata
  ↓ refreshUser() → /profile-setup (existing, handles address + map + creates role profile row)
```

---

## Architecture

### New files
| File | Purpose |
|------|---------|
| `src/pages/auth/AuthCallback.tsx` | Spinner page. Waits for user state, redirects based on profile completeness |
| `src/pages/auth/GoogleSetup.tsx` | Role picker + basic role-specific info for new Google users |
| `src/pages/auth/GoogleSetup.css` | Styles (matches existing auth page aesthetic) |

### Modified files
| File | Change |
|------|--------|
| `src/services/authService.ts` | Add `signInWithGoogle()` and `setUserRole()` |
| `src/contexts/AuthContext.tsx` | Expose `signInWithGoogle` in context type + handle null role in `buildUserFromSession` |
| `src/components/auth/Login.tsx` | Remove GitHub button, wire Google button with onClick + loading state |
| `src/router/AppRouter.tsx` | Add `/auth/callback` and `/auth/google-setup` routes (public, no layout wrapper) |
| `src/utils/constants.ts` | Add `AUTH_CALLBACK: '/auth/callback'` and `GOOGLE_SETUP: '/auth/google-setup'` |

---

## Key Implementation Details

### authService.signInWithGoogle()
```ts
signInWithGoogle: async (): Promise<ApiResponse<null>> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'email profile',
    },
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data: null }; // browser redirects, this may not resolve
};
```

### authService.setUserRole()
```ts
setUserRole: async (userId: string, role: 'donor' | 'recipient'): Promise<ApiResponse<null>> => {
  // 1. Update profiles table
  const { error: dbError } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (dbError) throw dbError;

  // 2. Persist role into JWT metadata so buildUserFromSession works on reload
  const { error: metaError } = await supabase.auth.updateUser({ data: { role } });
  if (metaError) throw metaError;

  return null;
};
```

### AuthCallback.tsx (redirect logic)
```tsx
useEffect(() => {
  if (!user) return; // keep waiting (SDK is exchanging the PKCE code)
  if (!user.role) {
    navigate(ROUTES.GOOGLE_SETUP, { replace: true });
  } else if (!user.hasCompletedProfile) {
    navigate(ROUTES.PROFILE_SETUP, { replace: true });
  } else {
    navigate(user.role === 'donor' ? ROUTES.DONOR_DASHBOARD : ROUTES.RECIPIENT_DASHBOARD, { replace: true });
  }
}, [user, navigate]);
// Timeout fallback: if user never arrives after 8s → redirect to login
```

### AuthContext changes
- Add `signInWithGoogle: () => Promise<ApiResponse<null>>` to context type
- In `buildUserFromSession`: change `|| 'donor'` fallback to `|| null` so null role is preserved for detection

### Login.tsx changes
- Remove the GitHub `<button>` entirely
- Add `onClick={handleGoogleSignIn}` to the Google button
- Add local `isGoogleLoading` state for button spinner
- Google button should be full-width (single button, no grid needed)

---

## Supabase Dashboard Steps (Manual)
1. **Enable Google provider**: Dashboard → Auth → Providers → Google → enable, paste Client ID + Secret
2. **Add redirect URL**: Dashboard → Auth → URL Configuration → Redirect URLs → add `http://localhost:5173/auth/callback` (and production URL when deploying)
3. **Google Cloud Console**: Create OAuth 2.0 credentials, add `https://<supabase-project>.supabase.co/auth/v1/callback` as authorized redirect URI

---

## What Does NOT Change
- `ProfileSetup.tsx` — unchanged, reused as-is
- `AuthSuccess.tsx` — unchanged, still used for email registration
- All existing email/password login and register flows — untouched
- `onAuthStateChange` in AuthContext — already handles SIGNED_IN, no changes needed to the listener logic itself
