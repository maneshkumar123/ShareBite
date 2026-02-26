/**
 * Email Verification Page
 * 
 * Shown after user registers. Prompts them to check their email
 * for the verification link from Supabase.
 */

import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@utils/constants';
import './VerifyEmail.css';

const VerifyEmail: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Derive email from location state
    const email = useMemo(() => {
        const state = location.state as { email?: string };
        return state?.email || '';
    }, [location.state]);

    useEffect(() => {
        // If no email provided, redirect to register
        if (!email) {
            navigate(ROUTES.REGISTER);
        }
    }, [email, navigate]);

    return (
        <div className="verify-email">
            <div className="verify-email__container">
                {/* Email Icon */}
                <div className="verify-email__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                    </svg>
                </div>

                {/* Title */}
                <h1 className="verify-email__title">Check Your Email</h1>

                {/* Description */}
                <div className="verify-email__content">
                    <p className="verify-email__message">
                        We've sent a confirmation email to:
                    </p>
                    <p className="verify-email__email">{email}</p>
                    <p className="verify-email__instructions">
                        Please click the verification link in the email to activate your account.
                        The link will expire in 24 hours.
                    </p>
                </div>

                {/* Next Steps */}
                <div className="verify-email__steps">
                    <h3>Next Steps:</h3>
                    <ol>
                        <li>Check your inbox (and spam folder)</li>
                        <li>Click the verification link</li>
                        <li>Complete your profile setup</li>
                        <li>Start sharing or claiming food!</li>
                    </ol>
                </div>

                {/* Didn't receive email? */}
                <div className="verify-email__help">
                    <p>Didn't receive the email?</p>
                    <ul>
                        <li>Check your spam/junk folder</li>
                        <li>Make sure you entered the correct email</li>
                        <li>Wait a few minutes and refresh your inbox</li>
                    </ul>
                </div>

                {/* Actions */}
                <div className="verify-email__actions">
                    <button
                        className="verify-email__button verify-email__button--secondary"
                        onClick={() => navigate(ROUTES.LOGIN)}
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
