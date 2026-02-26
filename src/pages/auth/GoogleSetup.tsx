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

    // Guard: if user already has a role, redirect them away from this page
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
