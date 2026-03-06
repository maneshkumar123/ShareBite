import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { profileService } from '@services/profileService';
import { listingService } from '@services/listingService';
import type { DonorProfileData } from '@services/profileService';
import type { DonorStats } from '@services/listingService';
import MapPicker from '@components/common/MapPicker';
import './DonorProfile.css';

// ─── Icons ────────────────────────────────────────────────────────────────────

const PencilIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const OrgIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" strokeLinecap="round" />
    </svg>
);

const TagIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
);

const PersonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const PhoneIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.72h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.32a16 16 0 0 0 6 6l1.27-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" />
    </svg>
);

const LocationIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const ShieldIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

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
        const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
        if (!key) return;
        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(editAddress)}&key=${key}`
            );
            const json = await res.json();
            if (json.status === 'OK' && json.results?.[0]) {
                const { lat, lng } = json.results[0].geometry.location;
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
                    <div className="dp-skeleton-card" style={{ padding: 0 }}>
                        <div className="dp-skeleton-banner" />
                        <div className="dp-skeleton-body">
                            <div className="dp-skeleton-circle" />
                            <div className="dp-skeleton-line" style={{ width: '55%', margin: '1rem auto 0.6rem' }} />
                            <div className="dp-skeleton-line" style={{ width: '72%', margin: '0 auto 1rem' }} />
                            <div className="dp-skeleton-line" style={{ width: '35%', margin: '0 auto' }} />
                        </div>
                    </div>
                    <div className="dp-skeleton-card" style={{ padding: 0 }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E4E1DC' }}>
                            <div className="dp-skeleton-line" style={{ width: '30%', height: '14px' }} />
                        </div>
                        <div>
                            {[...Array(6)].map((_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '1rem 1.5rem',
                                        borderBottom: i < 5 ? '1px solid #E4E1DC' : 'none',
                                        gap: '1rem',
                                    }}
                                >
                                    <div className="dp-skeleton-line" style={{ width: '22%', height: '10px' }} />
                                    <div className="dp-skeleton-line" style={{ width: '40%' }} />
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
                    <div className="dp-avatar-banner" />

                    <div className="dp-avatar-body">
                        <div className="dp-avatar">{getInitials(profile.fullName)}</div>
                        <h2 className="dp-avatar-name">{profile.fullName}</h2>
                        <p className="dp-avatar-email">{profile.email}</p>
                        <span className="dp-role-badge">Donor</span>
                        {user?.createdAt && (
                            <p className="dp-joined">Joined {formatDate(user.createdAt)}</p>
                        )}

                        <div className="dp-stats-row">
                            {[
                                { value: stats?.total ?? 0, label: 'Total' },
                                { value: stats?.active ?? 0, label: 'Active' },
                                { value: stats?.claimed ?? 0, label: 'Claimed' },
                                { value: stats?.mealsShared ?? 0, label: 'Meals' },
                            ].map(({ value, label }) => (
                                <div key={label} className="dp-stat-item">
                                    <span className="dp-stat-value">{value}</span>
                                    <span className="dp-stat-label">{label}</span>
                                </div>
                            ))}
                        </div>

                        <button className="dp-signout-btn" onClick={handleSignOut}>
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* ── Right: Details Card ───────────── */}
                <div className="dp-details-card">
                    <div className="dp-details-header">
                        <h2>{editing ? 'Edit Profile' : 'Profile Details'}</h2>
                        {!editing && (
                            <button className="dp-edit-btn" onClick={enterEditMode}>
                                <PencilIcon /> Edit Profile
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
                                <span className="dp-field-label"><OrgIcon /> Organization</span>
                                <span className="dp-field-value">
                                    {profile.organizationName || <span className="dp-muted">Not set</span>}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label"><TagIcon /> Type</span>
                                <span className={`dp-badge ${orgTypeBadgeClass(profile.organizationType)}`}>
                                    {profile.organizationType}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label"><PersonIcon /> Contact Person</span>
                                <span className={`dp-field-value ${!profile.contactPerson ? 'dp-muted' : ''}`}>
                                    {profile.contactPerson || 'Not set'}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label"><PhoneIcon /> Phone</span>
                                <span className={`dp-field-value ${!profile.phone ? 'dp-muted' : ''}`}>
                                    {profile.phone || 'Not set'}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label"><LocationIcon /> Address</span>
                                <span className={`dp-field-value ${!profile.address ? 'dp-muted' : ''}`}>
                                    {profile.address || 'Not set'}
                                </span>
                            </div>
                            <div className="dp-field">
                                <span className="dp-field-label"><ShieldIcon /> Verified</span>
                                {profile.isVerified ? (
                                    <span className="dp-verified-badge dp-verified-badge--yes">✓ Verified</span>
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
