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
 *   - role set, no profile → /profile-setup
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
