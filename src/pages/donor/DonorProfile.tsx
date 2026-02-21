import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { profileService } from '@services/profileService';
import { listingService } from '@services/listingService';
import type { DonorProfileData } from '@services/profileService';
import type { DonorStats } from '@services/listingService';
import MapPicker from '@components/common/MapPicker';
import './DonorProfile.css';

// ─── Org-type badge color map ────────────────────────────────────────────────

const orgTypeBadgeClass = (type: string): string => {
    const map: Record<string, string> = {
        restaurant: 'dp-badge--restaurant',
        cafe: 'dp-badge--cafe',
        'café': 'dp-badge--cafe',
        bakery: 'dp-badge--bakery',
        grocery: 'dp-badge--grocery',
        catering: 'dp-badge--catering',
    };
    return map[type.toLowerCase()] ?? 'dp-badge--other';
};

// ─── Main Component ──────────────────────────────────────────────────────────

const DonorProfile: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Data states
    const [profile, setProfile] = useState<DonorProfileData | null>(null);
    const [stats, setStats] = useState<DonorStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit mode
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Edit form fields
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editOrgName, setEditOrgName] = useState('');
    const [editOrgType, setEditOrgType] = useState('');
    const [editContact, setEditContact] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editLat, setEditLat] = useState<number>(31.5204);
    const [editLng, setEditLng] = useState<number>(74.3587);

    // ── Load profile ─────────────────────────────────────

    const loadProfile = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        setError(null);
        try {
            const [profileRes, statsRes] = await Promise.all([
                profileService.getDonorProfile(user.id),
                listingService.getDonorStats(user.id),
            ]);
            if (profileRes.success && profileRes.data) {
                setProfile(profileRes.data);
            } else {
                setError(profileRes.error ?? 'Failed to load profile');
            }
            if (statsRes.success && statsRes.data) {
                setStats(statsRes.data);
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // ── Populate edit fields when entering edit mode ──────

    const enterEditMode = () => {
        if (!profile) return;
        setEditName(profile.fullName);
        setEditPhone(profile.phone ?? '');
        setEditOrgName(profile.organizationName);
        setEditOrgType(profile.organizationType);
        setEditContact(profile.contactPerson ?? '');
        setEditAddress(profile.address);
        setEditLat(profile.latitude ?? 31.5204);
        setEditLng(profile.longitude ?? 74.3587);
        setSaveError(null);
        setEditing(true);
    };

    // ── Geocode address ──────────────────────────────────

    const handleGeocode = async () => {
        if (!editAddress.trim()) return;
        const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
        if (!MAPBOX_TOKEN) return;
        try {
            const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(editAddress)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
            );
            const json = await res.json();
            if (json.features?.[0]) {
                const [lng, lat] = json.features[0].center;
                setEditLat(lat);
                setEditLng(lng);
            }
        } catch {
            // silently fail geocode
        }
    };

    // ── Save ─────────────────────────────────────────────

    const handleSave = async () => {
        if (!user?.id) return;
        setSaving(true);
        setSaveError(null);
        const result = await profileService.updateDonorProfile(user.id, {
            fullName: editName,
            phone: editPhone,
            organizationName: editOrgName,
            organizationType: editOrgType,
            contactPerson: editContact,
            address: editAddress,
            latitude: editLat,
            longitude: editLng,
        });
        if (result.success) {
            setEditing(false);
            loadProfile();
        } else {
            setSaveError(result.error ?? 'Failed to save');
        }
        setSaving(false);
    };

    // ── Sign out ─────────────────────────────────────────

    const handleSignOut = async () => {
        await logout();
        navigate('/login');
    };

    // ── Helpers ──────────────────────────────────────────

    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    // ── Loading skeleton ─────────────────────────────────

    if (isLoading) {
        return (
            <div className="dp-page">
                <div className="dp-header">
                    <h1>My Profile</h1>
                    <p>Manage your account details</p>
                </div>
                <div className="dp-layout">
                    <div className="dp-skeleton-card">
                        <div className="dp-skeleton-circle" />
                        <div className="dp-skeleton-line" style={{ width: '60%', margin: '0 auto 0.75rem' }} />
                        <div className="dp-skeleton-line" style={{ width: '80%', margin: '0 auto 0.75rem' }} />
                        <div className="dp-skeleton-line" style={{ width: '40%', margin: '0 auto' }} />
                    </div>
                    <div className="dp-skeleton-card">
                        <div className="dp-skeleton-line" style={{ width: '30%', marginBottom: '1.5rem' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {[...Array(6)].map((_, i) => (
                                <div key={i}>
                                    <div className="dp-skeleton-line" style={{ width: '40%', marginBottom: '0.5rem', height: '10px' }} />
                                    <div className="dp-skeleton-line" style={{ width: '75%' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Error state ──────────────────────────────────────

    if (error || !profile) {
        return (
            <div className="dp-page">
                <div className="dp-header">
                    <h1>My Profile</h1>
                    <p>Manage your account details</p>
                </div>
                <div className="dp-error">
                    <p className="dp-error-msg">{error ?? 'Profile not found'}</p>
                    <button className="dp-retry-btn" onClick={loadProfile}>Retry</button>
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────

    return (
        <div className="dp-page">
            <div className="dp-header">
                <h1>My Profile</h1>
                <p>Manage your account details</p>
            </div>

            <div className="dp-layout">
                {/* ── Left: Avatar Card ─────────────── */}
                <div className="dp-avatar-card">
                    <div className="dp-avatar">{getInitials(profile.fullName)}</div>
                    <h2 className="dp-avatar-name">{profile.fullName}</h2>
                    <p className="dp-avatar-email">{profile.email}</p>
                    <span className="dp-role-badge">Donor</span>
                    {user?.createdAt && (
                        <p className="dp-joined">Joined {formatDate(user.createdAt)}</p>
                    )}

                    <div className="dp-stats-row">
                        <div className="dp-stat-item">
                            <span className="dp-stat-value">{stats?.total ?? 0}</span>
                            <span className="dp-stat-label">Total Listings</span>
                        </div>
                    </div>

                    <button className="dp-signout-btn" onClick={handleSignOut}>
                        Sign Out
                    </button>
                </div>

                {/* ── Right: Details Card ───────────── */}
                <div className="dp-details-card">
                    <div className="dp-details-header">
                        <h2>{editing ? 'Edit Profile' : 'Profile Details'}</h2>
                        {!editing && (
                            <button className="dp-edit-btn" onClick={enterEditMode}>
                                Edit Profile
                            </button>
                        )}
                    </div>

                    {editing ? (
                        /* ── Edit Mode ──────────────── */
                        <div className="dp-form-grid">
                            <div className="dp-form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                />
                            </div>
                            <div className="dp-form-group">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    value={editPhone}
                                    onChange={e => setEditPhone(e.target.value)}
                                    placeholder="+92 300 1234567"
                                />
                            </div>
                            <div className="dp-form-group">
                                <label>Organization Name</label>
                                <input
                                    type="text"
                                    value={editOrgName}
                                    onChange={e => setEditOrgName(e.target.value)}
                                />
                            </div>
                            <div className="dp-form-group">
                                <label>Organization Type</label>
                                <select
                                    value={editOrgType}
                                    onChange={e => setEditOrgType(e.target.value)}
                                >
                                    <option value="restaurant">Restaurant</option>
                                    <option value="cafe">Caf&eacute;</option>
                                    <option value="grocery">Grocery</option>
                                    <option value="bakery">Bakery</option>
                                    <option value="catering">Catering</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="dp-form-group">
                                <label>Contact Person</label>
                                <input
                                    type="text"
                                    value={editContact}
                                    onChange={e => setEditContact(e.target.value)}
                                />
                            </div>
                            <div className="dp-form-group dp-full-width">
                                <label>Address</label>
                                <div className="dp-address-row">
                                    <input
                                        type="text"
                                        value={editAddress}
                                        onChange={e => setEditAddress(e.target.value)}
                                        placeholder="Enter your address"
                                    />
                                    <button
                                        type="button"
                                        className="dp-geocode-btn"
                                        onClick={handleGeocode}
                                    >
                                        Find on map
                                    </button>
                                </div>
                                <div className="dp-map-container">
                                    <MapPicker
                                        latitude={editLat}
                                        longitude={editLng}
                                        onLocationChange={(lat, lng) => {
                                            setEditLat(lat);
                                            setEditLng(lng);
                                        }}
                                    />
                                </div>
                            </div>

                            {saveError && <p className="dp-inline-error">{saveError}</p>}

                            <div className="dp-form-actions">
                                <button
                                    className="dp-save-btn"
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    className="dp-cancel-btn"
                                    onClick={() => setEditing(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ── View Mode ──────────────── */
                        <div className="dp-view-grid">
                            <div className="dp-field">
                                <span className="dp-field-label">Organization</span>
                                <span className="dp-field-value">
                                    {profile.organizationName || <span className="dp-muted">Not set</span>}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label">Type</span>
                                <span className={`dp-badge ${orgTypeBadgeClass(profile.organizationType)}`}>
                                    {profile.organizationType}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label">Contact Person</span>
                                <span className={`dp-field-value ${!profile.contactPerson ? 'dp-muted' : ''}`}>
                                    {profile.contactPerson || 'Not set'}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label">Phone</span>
                                <span className={`dp-field-value ${!profile.phone ? 'dp-muted' : ''}`}>
                                    {profile.phone || 'Not set'}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label">Address</span>
                                <span className={`dp-field-value ${!profile.address ? 'dp-muted' : ''}`}>
                                    {profile.address || 'Not set'}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label">Verified</span>
                                {profile.isVerified ? (
                                    <span className="dp-verified-badge dp-verified-badge--yes">Verified</span>
                                ) : (
                                    <span className="dp-verified-badge dp-verified-badge--no">Pending</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DonorProfile;
