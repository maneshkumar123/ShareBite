/**
 * Profile Setup Page
 * 
 * Collects missing profile information after email verification:
 * - Organization details (for donors)
 * - Address and location
 * - Creates extended donor_profiles or recipient_profiles
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { authService } from '@services/authService';
import { geolocationService } from '@services/geolocationService';
import { Button } from '@components/common';
import { FormField } from '@components/auth/FormField';
import { ROUTES } from '@utils/constants';
import { supabase } from '@services/api';
import MapPicker from '@components/common/MapPicker';
import './ProfileSetup.css';

interface ProfileData {
    organizationName: string;
    organizationType: string;
    address: string;
    isCharity: string;
}

const ProfileSetup: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState<ProfileData>({
        organizationName: '',
        organizationType: 'restaurant',
        address: '',
        isCharity: 'false',
    });

    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationMethod, setLocationMethod] = useState<'browser' | 'geocode' | null>(null);

    useEffect(() => {
        // Guard: OAuth users without a role shouldn't be here
        if (user && !user.role) {
            navigate(ROUTES.GOOGLE_SETUP, { replace: true });
            return;
        }

        // Redirect if profile is already complete
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

    // Handle location capture from browser
    const handleGetCurrentLocation = async () => {
        setIsGettingLocation(true);
        setErrors((prev) => ({ ...prev, location: '' }));

        const response = await geolocationService.getCurrentPosition();

        if (response.success && response.data) {
            setLocation(response.data);
            setLocationMethod('browser');

            // Try to get address from coordinates (optional - location still captured if this fails)
            const reverseGeocode = await geolocationService.reverseGeocode(
                response.data.latitude,
                response.data.longitude
            );

            if (reverseGeocode.success && reverseGeocode.data) {
                setFormData((prev) => ({
                    ...prev,
                    address: reverseGeocode.data?.address || prev.address,
                }));
            }
            // Note: If reverse geocoding fails, we still have the coordinates
            // which is all we need for the database
        } else {
            setErrors((prev) => ({
                ...prev,
                location: response.error || 'Failed to get location',
            }));
        }

        setIsGettingLocation(false);
    };

    // Handle address geocoding
    const handleGeocodeAddress = async () => {
        if (!formData.address.trim()) {
            setErrors((prev) => ({ ...prev, address: 'Please enter an address first' }));
            return;
        }

        setIsGettingLocation(true);
        setErrors((prev) => ({ ...prev, location: '' }));

        const response = await geolocationService.geocodeAddress(formData.address);

        if (response.success && response.data) {
            setLocation({
                latitude: response.data.latitude,
                longitude: response.data.longitude,
            });
            setLocationMethod('geocode');
            // Update address with formatted version from Mapbox
            setFormData((prev) => ({
                ...prev,
                address: response.data?.placeName || prev.address,
            }));
        } else {
            setErrors((prev) => ({
                ...prev,
                location: response.error || 'Failed to find location for this address',
            }));
        }

        setIsGettingLocation(false);
    };

    // Handle form input changes
    const handleInputChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    // Validate form
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (user?.role === 'donor') {
            if (!formData.organizationName.trim()) {
                newErrors.organizationName = 'Organization name is required';
            }
            if (!formData.organizationType) {
                newErrors.organizationType = 'Please select organization type';
            }
        }

        if (!formData.address.trim()) {
            newErrors.address = 'Address is required';
        }

        if (!location) {
            newErrors.location = 'Please capture your location';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm() || !user || !user.role || !location) {
            return;
        }

        setIsSubmitting(true);

        try {
            const profileData = {
                organizationName: formData.organizationName,
                organizationType: formData.organizationType,
                address: formData.address,
                isCharity: formData.isCharity === 'true',
                latitude: location.latitude,
                longitude: location.longitude,
            };

            const response = await authService.createRoleProfile(
                user.id,
                user.role,
                profileData
            );

            if (response.success) {
                // Refresh user data to get the new profile
                await refreshUser();

                // Redirect to dashboard
                navigate(user.role === 'donor' ? ROUTES.DONOR_DASHBOARD : ROUTES.RECIPIENT_DASHBOARD);
            } else {
                setErrors({ submit: response.error || 'Failed to create profile' });
            }
        } catch {
            setErrors({ submit: 'An unexpected error occurred' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return null;
    }

    const isDonor = user.role === 'donor';

    return (
        <div className="profile-setup">
            <div className="profile-setup__container">
                <div className="profile-setup__header">
                    <div className="profile-setup__icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <h1>Complete Your Profile</h1>
                    <p>Tell us a bit more about yourself to get started</p>
                </div>

                <form onSubmit={handleSubmit} className="profile-setup__form">
                    {/* Donor-specific fields */}
                    {isDonor && (
                        <>
                            <FormField
                                field={{
                                    name: 'organizationName',
                                    type: 'text',
                                    label: 'Organization Name',
                                    placeholder: 'Your Organization',
                                    required: true
                                }}
                                value={formData.organizationName}
                                onChange={handleInputChange}
                                error={errors.organizationName}
                            />

                            <div className="form-field">
                                <label htmlFor="organizationType">
                                    Organization Type <span className="required">*</span>
                                </label>
                                <select
                                    id="organizationType"
                                    name="organizationType"
                                    value={formData.organizationType}
                                    onChange={(e) => handleInputChange('organizationType', e.target.value)}
                                    className="form-field__input"
                                >
                                    <option value="restaurant">Restaurant</option>
                                    <option value="cafe">Café</option>
                                    <option value="grocery">Grocery Store</option>
                                    <option value="bakery">Bakery</option>
                                    <option value="catering">Catering Service</option>
                                    <option value="other">Other</option>
                                </select>
                                {errors.organizationType && (
                                    <span className="form-field__error">{errors.organizationType}</span>
                                )}
                            </div>
                        </>
                    )}

                    {/* Recipient-specific fields */}
                    {!isDonor && (
                        <div className="form-field">
                            <label htmlFor="isCharity">Account Type <span className="required">*</span></label>
                            <select
                                id="isCharity"
                                name="isCharity"
                                value={formData.isCharity}
                                onChange={(e) => handleInputChange('isCharity', e.target.value)}
                                className="form-field__input"
                            >
                                <option value="false">Individual</option>
                                <option value="true">Charity / NGO</option>
                            </select>
                        </div>
                    )}

                    {!isDonor && formData.isCharity === 'true' && (
                        <FormField
                            field={{
                                name: 'organizationName',
                                type: 'text',
                                label: 'Organization Name',
                                placeholder: 'Your charity or NGO name'
                            }}
                            value={formData.organizationName}
                            onChange={handleInputChange}
                        />
                    )}

                    {/* Address field */}
                    <FormField
                        field={{
                            name: 'address',
                            type: 'text',
                            label: 'Address',
                            placeholder: 'Enter your full address',
                            required: true
                        }}
                        value={formData.address}
                        onChange={handleInputChange}
                        error={errors.address}
                    />

                    {/* Location capture section */}
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
                                    : '🗺️ Find Address'}
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

                    {/* Submit error */}
                    {errors.submit && <div className="profile-setup__error">{errors.submit}</div>}

                    {/* Submit button */}
                    <Button type="submit" variant="primary" fullWidth disabled={isSubmitting || !location}>
                        {isSubmitting ? 'Creating Profile...' : 'Complete Setup'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default ProfileSetup;
