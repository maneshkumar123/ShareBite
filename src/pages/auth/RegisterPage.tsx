import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RoleToggle } from '../../components/auth/RoleToggle';
import type { UserRole } from '../../components/auth/RoleToggle';
import { FormField } from '../../components/auth/FormField';
import type { FormFieldConfig } from '../../components/auth/FormField';
import { useAuth } from '@contexts/AuthContext';
import { ROUTES } from '@utils/constants';
import './RegisterPage.css';

// ==============================================
// FORM FIELD CONFIGURATIONS
// Matching database schema: profiles, donor_profiles, recipient_profiles
// ==============================================

interface FormFieldWithGrid extends FormFieldConfig {
    gridColumn?: 'half' | 'full';
}

// Common fields for both donor and recipient
const COMMON_FIELDS: FormFieldWithGrid[] = [
    {
        name: 'fullName',
        type: 'text',
        label: 'Full Name',
        placeholder: 'John Doe',
        required: true,
        autoComplete: 'name',
        gridColumn: 'half',
    },
    {
        name: 'email',
        type: 'email',
        label: 'Email',
        placeholder: 'you@example.com',
        required: true,
        autoComplete: 'email',
        gridColumn: 'half',
    },
    {
        name: 'phone',
        type: 'tel',
        label: 'Phone (Optional)',
        placeholder: '+92 300 1234567',
        required: false,
        autoComplete: 'tel',
        gridColumn: 'full',
    },
    {
        name: 'password',
        type: 'password',
        label: 'Password',
        placeholder: '••••••••',
        required: true,
        autoComplete: 'new-password',
        gridColumn: 'half',
    },
    {
        name: 'confirmPassword',
        type: 'password',
        label: 'Confirm Password',
        placeholder: '••••••••',
        required: true,
        autoComplete: 'new-password',
        gridColumn: 'half',
    },
];

// Donor-specific fields (matching donor_profiles table)
const DONOR_FIELDS: FormFieldWithGrid[] = [
    ...COMMON_FIELDS,
    {
        name: 'organizationName',
        type: 'text',
        label: 'Organization Name',
        placeholder: 'Your restaurant or business name',
        required: true,
        gridColumn: 'half',
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
        gridColumn: 'half',
    },
    {
        name: 'address',
        type: 'text',
        label: 'Business Address',
        placeholder: '123 Main Street, City',
        required: false,
        gridColumn: 'full',
    },
];

// Recipient-specific fields (matching recipient_profiles table)
const RECIPIENT_FIELDS: FormFieldWithGrid[] = [
    ...COMMON_FIELDS,
    {
        name: 'organizationName',
        type: 'text',
        label: 'Organization Name (Optional)',
        placeholder: 'If registering for an organization',
        required: false,
        gridColumn: 'half',
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
        gridColumn: 'half',
    },
    {
        name: 'address',
        type: 'text',
        label: 'Address (Optional)',
        placeholder: 'Your address for nearby matching',
        required: false,
        gridColumn: 'full',
    },
];

// Rotating phrases for the animated headline
const ROTATING_PHRASES = ['CHANGE.', 'IMPACT.', 'DIFFERENCE.', 'FUTURE.'];

// ==============================================
// MAIN COMPONENT
// ==============================================

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const { register } = useAuth();

    const [isVisible, setIsVisible] = useState(false);
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const [selectedRole, setSelectedRole] = useState<UserRole>('donor');
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    // Get current fields based on role
    const currentFields = selectedRole === 'donor' ? DONOR_FIELDS : RECIPIENT_FIELDS;

    // Handle role change - reset form data but keep common fields
    const handleRoleChange = (role: UserRole) => {
        setSelectedRole(role);
        // Keep common field values when switching roles
        const commonFieldNames = COMMON_FIELDS.map(f => f.name);
        const preservedData: Record<string, string> = {};
        commonFieldNames.forEach(name => {
            if (formData[name]) {
                preservedData[name] = formData[name];
            }
        });
        setFormData(preservedData);
        setErrors({});
    };

    // Handle input change
    const handleInputChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    // Validation functions
    const validateField = (name: string, value: string): string => {
        if (!value?.trim()) {
            const field = currentFields.find((f) => f.name === name);
            if (field?.required) {
                return `${field.label.replace(' (Optional)', '')} is required`;
            }
        }

        // Email validation
        if (name === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return 'Please enter a valid email address';
            }
        }

        // Password validation
        if (name === 'password' && value) {
            if (value.length < 6) {
                return 'Password must be at least 6 characters';
            }
        }

        // Confirm password validation
        if (name === 'confirmPassword' && value) {
            if (value !== formData.password) {
                return 'Passwords do not match';
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
        currentFields.forEach((field) => {
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

        try {
            // Call auth service to register user
            const response = await register({
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
                phone: formData.phone || undefined,
                role: selectedRole,

                // Donor-specific fields
                organizationName: formData.organizationName || undefined,
                organizationType: formData.organizationType as 'restaurant' | 'cafe' | 'grocery' | 'bakery' | 'catering' | 'other' | undefined,

                // Recipient-specific fields
                isCharity: formData.isCharity === 'true',

                // Address (optional for both)
                address: formData.address || undefined,
            });

            if (response.success) {
                // Navigate to email verification page
                navigate(ROUTES.VERIFY_EMAIL, {
                    state: { email: formData.email },
                });
            } else {
                setErrors({ submit: response.error || 'Registration failed. Please try again.' });
            }
        } catch (error) {
            console.error('Registration error:', error);
            setErrors({ submit: 'Registration failed. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="register-page">
            <div className="register-container">
                {/* LEFT SIDE - Animated Title */}
                <div className="register-left">
                    <div className={`register-text-wrapper ${isVisible ? 'visible' : ''}`}>
                        <div className="register-title-container">
                            <h1 className="register-title-line">JOIN THE</h1>
                        </div>
                        <div className="register-title-container" style={{ animationDelay: '0.1s' }}>
                            <h1 className="register-title-line">MOVEMENT</h1>
                        </div>

                        {/* Rotating phrase */}
                        <div className="register-title-container rotating-container" style={{ animationDelay: '0.2s' }}>
                            <div className="rotating-text-wrapper">
                                {ROTATING_PHRASES.map((phrase, index) => (
                                    <h1
                                        key={phrase}
                                        className={`register-title-line rotating-phrase ${index === currentPhraseIndex ? 'active' : ''
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

                        <p className="register-subtitle" style={{ animationDelay: '0.5s' }}>
                            Whether you're a restaurant with surplus food or someone in need,
                            ShareBite connects you with your community.
                        </p>
                    </div>
                </div>

                {/* RIGHT SIDE - Form Card */}
                <div className={`register-right ${isVisible ? 'visible' : ''}`}>
                    <div className="register-card">
                        <div className="register-card-header">
                            <h2 className="register-card-title">Create Account</h2>
                            <p className="register-card-subtitle">
                                Choose your role to get started
                            </p>
                        </div>

                        {/* Role Toggle */}
                        <RoleToggle selectedRole={selectedRole} onRoleChange={handleRoleChange} />

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="register-form">
                            {/* Form Grid */}
                            <div className="register-form-grid">
                                {currentFields.map((field) => (
                                    <div
                                        key={field.name}
                                        className={`register-field-wrapper ${field.gridColumn === 'full' ? 'full-width' : 'half-width'
                                            }`}
                                    >
                                        <FormField
                                            field={field}
                                            value={formData[field.name] || ''}
                                            onChange={handleInputChange}
                                            onBlur={handleBlur}
                                            error={errors[field.name]}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Submit Error */}
                            {errors.submit && (
                                <div className="register-error">{errors.submit}</div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className={`register-submit-btn ${isSubmitting ? 'loading' : ''}`}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="spinner"></span>
                                        Creating Account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>

                            {/* Login Link */}
                            <p className="register-login-link">
                                Already have an account?{' '}
                                <Link to={ROUTES.LOGIN}>Sign In</Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
