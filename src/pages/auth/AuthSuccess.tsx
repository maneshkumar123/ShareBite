import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { ROUTES } from '@utils/constants';
import './AuthSuccess.css';

interface LocationState {
    role?: 'donor' | 'recipient';
    email?: string;
    name?: string;
    fromLogin?: boolean;
}

/**
 * Auth Success Page
 * 
 * Shown after successful registration or login.
 * Displays role-specific welcome message.
 */
const AuthSuccess: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const state = location.state as LocationState | null;

    // Redirect to profile setup if user is authenticated but hasn't completed profile
    useEffect(() => {
        if (user && !user.hasCompletedProfile) {
            // Give them 2 seconds to see the success message, then redirect
            const timer = setTimeout(() => {
                navigate(ROUTES.PROFILE_SETUP);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [user, navigate]);

    const isFromLogin = state?.fromLogin || false;
    const role = state?.role || user?.role || 'recipient';
    const name = state?.name?.split(' ')[0] || user?.fullName?.split(' ')[0] || 'there';
    const email = state?.email || user?.email;

    const isDonor = role === 'donor';

    const handleLogout = async () => {
        await logout();
        window.location.href = ROUTES.HOME;
    };

    return (
        <div className="auth-success-page">
            <div className="auth-success-container">
                {/* Success Icon */}
                <div className="success-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                {/* Welcome Message */}
                <h1 className="success-title">
                    {isFromLogin ? `Welcome back, ${name}!` : `Welcome, ${name}! 🎉`}
                </h1>

                <p className="success-subtitle">
                    {isFromLogin
                        ? <>You are signed in as a <strong>{isDonor ? 'Donor' : 'Recipient'}</strong>.</>
                        : <>Your account has been created successfully as a <strong>{isDonor ? 'Donor' : 'Recipient'}</strong>.</>
                    }
                </p>

                {user && !user.hasCompletedProfile && (
                    <p className="success-email-notice" style={{ color: '#00A86B', marginTop: '1rem' }}>
                        Redirecting to profile setup in a moment...
                    </p>
                )}

                {email && !isFromLogin && !user && (
                    <p className="success-email-notice">
                        Please check <strong>{email}</strong> to verify your email address.
                    </p>
                )}

                {/* Role-specific message */}
                <div className="success-role-info">
                    {isDonor ? (
                        <>
                            <h3>🍽️ As a Donor, you can:</h3>
                            <ul>
                                <li>Post surplus food from your restaurant or business</li>
                                <li>Connect with nearby recipients</li>
                                <li>Track your impact and contributions</li>
                            </ul>
                        </>
                    ) : (
                        <>
                            <h3>🤝 As a Recipient, you can:</h3>
                            <ul>
                                <li>Browse available food listings near you</li>
                                <li>Claim food before it expires</li>
                                <li>Get notified when new food is available</li>
                            </ul>
                        </>
                    )}
                </div>

                {/* Action Buttons */}
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
                    ) : user && !user.hasCompletedProfile ? (
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
            </div>
        </div>
    );
};

export default AuthSuccess;
