import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FormField } from '../../components/auth/FormField';
import { authService } from '@services/authService';
import { ROUTES } from '@utils/constants';
import './ForgotPassword.css';

/**
 * Forgot Password Page
 * 
 * Allows users to request a password reset email.
 * Uses Supabase's built-in password reset functionality.
 */
const ForgotPassword: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const validateEmail = (value: string): string => {
        if (!value?.trim()) {
            return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
        }
        return '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const emailError = validateEmail(email);
        if (emailError) {
            setError(emailError);
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const response = await authService.resetPassword(email);

            if (response.success) {
                setIsSuccess(true);
            } else {
                setError(response.error || 'Failed to send reset email. Please try again.');
            }
        } catch (err) {
            console.error('Reset password error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="forgot-password-page">
                <div className={`forgot-password-container ${isVisible ? 'visible' : ''}`}>
                    <div className="forgot-password-card">
                        <div className="success-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h2 className="forgot-password-title">Check Your Email</h2>
                        <p className="forgot-password-description">
                            We've sent a password reset link to <strong>{email}</strong>.
                            Please check your inbox and follow the instructions.
                        </p>
                        <p className="forgot-password-note">
                            Didn't receive the email? Check your spam folder or try again.
                        </p>
                        <div className="forgot-password-actions">
                            <Link to={ROUTES.LOGIN} className="forgot-password-btn-primary">
                                Back to Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="forgot-password-page">
            <div className={`forgot-password-container ${isVisible ? 'visible' : ''}`}>
                <div className="forgot-password-card">
                    <div className="forgot-password-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <h2 className="forgot-password-title">Forgot Password?</h2>
                    <p className="forgot-password-description">
                        No worries! Enter your email and we'll send you a link to reset your password.
                    </p>

                    <form onSubmit={handleSubmit} className="forgot-password-form">
                        <FormField
                            field={{
                                name: 'email',
                                type: 'email',
                                label: 'Email Address',
                                placeholder: 'you@example.com',
                                required: true,
                                autoComplete: 'email',
                            }}
                            value={email}
                            onChange={(_, value) => {
                                setEmail(value);
                                if (error) setError('');
                            }}
                            onBlur={() => { }}
                            error={error}
                            disabled={isSubmitting}
                        />

                        <button
                            type="submit"
                            className={`forgot-password-submit ${isSubmitting ? 'loading' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="spinner"></span>
                                    Sending...
                                </>
                            ) : (
                                'Send Reset Link'
                            )}
                        </button>
                    </form>

                    <Link to={ROUTES.LOGIN} className="forgot-password-back">
                        ← Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
