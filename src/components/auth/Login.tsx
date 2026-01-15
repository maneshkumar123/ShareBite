import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from './FormField';
import type { FormFieldConfig } from './FormField';
import { useAuth } from '@contexts/AuthContext';
import { ROUTES } from '@utils/constants';
import './Login.css';

// ==============================================
// FORM FIELD CONFIGURATIONS
// ==============================================

const LOGIN_FIELDS: FormFieldConfig[] = [
    {
        name: 'email',
        type: 'email',
        label: 'Email',
        placeholder: 'you@example.com',
        required: true,
        autoComplete: 'email',
    },
    {
        name: 'password',
        type: 'password',
        label: 'Password',
        placeholder: '••••••••',
        required: true,
        autoComplete: 'current-password',
    },
];

// Rotating phrases for the animated headline
const ROTATING_PHRASES = ['AGAIN.', 'TODAY.', 'NOW.', 'HERE.'];

// ==============================================
// MAIN COMPONENT
// ==============================================

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated, user } = useAuth();

    const [isVisible, setIsVisible] = useState(false);
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && user) {
            // Redirect to role-based dashboard
            if (user.role === 'donor') {
                navigate(ROUTES.DONOR_DASHBOARD);
            } else {
                navigate(ROUTES.RECIPIENT_DASHBOARD);
            }
        }
    }, [isAuthenticated, user, navigate]);

    // Trigger entrance animations
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Rotate phrases
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Handle input change
    const handleInputChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    // Validation
    const validateField = (name: string, value: string): string => {
        if (!value?.trim()) {
            const field = LOGIN_FIELDS.find((f) => f.name === name);
            if (field?.required) {
                return `${field.label} is required`;
            }
        }

        if (name === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return 'Please enter a valid email address';
            }
        }

        return '';
    };

    // Handle blur validation
    const handleBlur = (name: string) => {
        const error = validateField(name, formData[name] || '');
        setErrors((prev) => ({ ...prev, [name]: error }));
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate all fields
        const newErrors: Record<string, string> = {};
        LOGIN_FIELDS.forEach((field) => {
            const error = validateField(field.name, formData[field.name] || '');
            if (error) {
                newErrors[field.name] = error;
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        setErrors({});

        try {
            // Call real auth service
            const response = await login(formData.email, formData.password);

            if (response.success && response.data) {
                // Navigate to role-based dashboard
                if (response.data.role === 'donor') {
                    navigate(ROUTES.DONOR_DASHBOARD);
                } else {
                    navigate(ROUTES.RECIPIENT_DASHBOARD);
                }
            } else {
                // Show error from server
                setErrors({
                    submit: response.error || 'Invalid email or password. Please try again.'
                });
            }
        } catch (error) {
            console.error('Login error:', error);
            setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                {/* LEFT SIDE - Animated Title */}
                <div className="login-left">
                    <div className={`login-text-wrapper ${isVisible ? 'visible' : ''}`}>
                        <div className="login-title-container">
                            <h1 className="login-title-line">WELCOME</h1>
                        </div>
                        <div className="login-title-container" style={{ animationDelay: '0.1s' }}>
                            <h1 className="login-title-line">BACK</h1>
                        </div>

                        {/* Rotating phrase */}
                        <div className="login-title-container rotating-container" style={{ animationDelay: '0.2s' }}>
                            <div className="rotating-text-wrapper">
                                {ROTATING_PHRASES.map((phrase, index) => (
                                    <h1
                                        key={phrase}
                                        className={`login-title-line rotating-phrase ${index === currentPhraseIndex ? 'active' : ''
                                            } ${index === (currentPhraseIndex - 1 + ROTATING_PHRASES.length) % ROTATING_PHRASES.length
                                                ? 'exiting'
                                                : ''
                                            }`}
                                    >
                                        {phrase}
                                    </h1>
                                ))}
                            </div>
                        </div>

                        <p className="login-subtitle" style={{ animationDelay: '0.5s' }}>
                            Continue your journey of making a difference. Sign in to access your
                            dashboard and manage your food sharing activities.
                        </p>
                    </div>
                </div>

                {/* RIGHT SIDE - Form Card */}
                <div className={`login-right ${isVisible ? 'visible' : ''}`}>
                    <div className="login-card">
                        <div className="login-card-header">
                            <h2 className="login-card-title">Sign In</h2>
                            <p className="login-card-subtitle">
                                Enter your credentials to continue
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="login-form-fields">
                                {LOGIN_FIELDS.map((field) => (
                                    <FormField
                                        key={field.name}
                                        field={field}
                                        value={formData[field.name] || ''}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        error={errors[field.name]}
                                        disabled={isSubmitting}
                                    />
                                ))}
                            </div>

                            {/* Remember Me & Forgot Password */}
                            <div className="login-options">
                                <label className="login-remember">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="login-remember-checkmark"></span>
                                    <span className="login-remember-text">Remember me</span>
                                </label>
                                <Link to={ROUTES.FORGOT_PASSWORD || '/forgot-password'} className="login-forgot">
                                    Forgot password?
                                </Link>
                            </div>

                            {/* Submit Error */}
                            {errors.submit && (
                                <div className="login-error">{errors.submit}</div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className={`login-submit-btn ${isSubmitting ? 'loading' : ''}`}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="spinner"></span>
                                        Signing In...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>

                            {/* Divider */}
                            <div className="login-divider">
                                <span>or continue with</span>
                            </div>

                            {/* Social Login Buttons */}
                            <div className="login-social">
                                <button type="button" className="login-social-btn" disabled={isSubmitting}>
                                    <svg viewBox="0 0 24 24" width="20" height="20">
                                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Google
                                </button>
                                <button type="button" className="login-social-btn" disabled={isSubmitting}>
                                    <svg viewBox="0 0 24 24" width="20" height="20">
                                        <path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.164 6.839 9.49.5.09.682-.218.682-.486 0-.24-.009-.875-.013-1.713-2.782.602-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.091-.647.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .27.18.58.688.482C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                    </svg>
                                    GitHub
                                </button>
                            </div>

                            {/* Register Link */}
                            <p className="login-register-link">
                                Don't have an account?{' '}
                                <Link to={ROUTES.REGISTER}>Create Account</Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
