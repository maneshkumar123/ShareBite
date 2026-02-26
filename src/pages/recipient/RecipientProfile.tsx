import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { supabase } from '@services/api';
import { profileService } from '@services/profileService';
import type { RecipientProfileData } from '@services/profileService';
import MapPicker from '@components/common/MapPicker';
import './RecipientProfile.css';

// ─── Icons ────────────────────────────────────────────────────────────────────

const PencilIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const PersonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round"/>
        <circle cx="12" cy="7" r="4"/>
    </svg>
);

const MailIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
    </svg>
);

const PhoneIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.72h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.32a16 16 0 0 0 6 6l1.27-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round"/>
    </svg>
);

const OrgIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" strokeLinecap="round"/>
    </svg>
);

const LocationIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
    </svg>
);

const StarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const ProfileSkeleton: React.FC = () => (
    <div className="rp-layout">
        <div className="rp-skeleton-card">
            <div className="rp-skeleton-circle" />
            {[80, 60, 40, 100, 90].map((w, i) => (
                <div key={i} className="rp-skeleton-line" style={{ width: `${w}%`, marginBottom: '0.6rem' }} />
            ))}
        </div>
        <div className="rp-skeleton-card">
            {[70, 50, 90, 60, 80, 45].map((w, i) => (
                <div key={i} className="rp-skeleton-line" style={{ width: `${w}%`, marginBottom: '0.8rem' }} />
            ))}
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface RecipientStats {
    totalClaimed: number;
    mealsReceived: number;
}

const RecipientProfile: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<RecipientProfileData | null>(null);
    const [stats, setStats] = useState<RecipientStats>({ totalClaimed: 0, mealsReceived: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editOrgName, setEditOrgName] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editLat, setEditLat] = useState<number>(31.5204);
    const [editLng, setEditLng] = useState<number>(74.3587);
    const [editIsCharity, setEditIsCharity] = useState(false);

    const loadProfile = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        setError(null);
        try {
            const [profileRes, claimedData] = await Promise.all([
                profileService.getRecipientProfile(user.id),
                supabase.from('food_listings').select('quantity').eq('claimed_by', user.id),
            ]);

            if (profileRes.success && profileRes.data) {
                setProfile(profileRes.data);
            } else {
                setError(profileRes.error ?? 'Failed to load profile');
            }

            const claimed = claimedData.data ?? [];
            setStats({
                totalClaimed: claimed.length,
                mealsReceived: claimed.reduce((sum: number, r: { quantity: number | null }) => sum + (r.quantity ?? 0), 0),
            });
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    const enterEditMode = () => {
        if (!profile) return;
        setEditName(profile.fullName);
        setEditPhone(profile.phone ?? '');
        setEditOrgName(profile.organizationName ?? '');
        setEditAddress(profile.address);
        setEditLat(profile.latitude ?? 31.5204);
        setEditLng(profile.longitude ?? 74.3587);
        setEditIsCharity(profile.isCharity);
        setSaveError(null);
        setEditing(true);
    };

    const handleGeocode = async () => {
        if (!editAddress.trim()) return;
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        if (!token) return;
        try {
            const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(editAddress)}.json?access_token=${token}&limit=1`
            );
            const json = await res.json();
            if (json.features?.[0]) {
                const [lng, lat] = json.features[0].center;
                setEditLat(lat);
                setEditLng(lng);
            }
        } catch { /* silently ignore geocode errors */ }
    };

    const handleSave = async () => {
        if (!user?.id) return;
        setSaving(true);
        setSaveError(null);
        const result = await profileService.updateRecipientProfile(user.id, {
            fullName: editName,
            phone: editPhone,
            organizationName: editOrgName,
            address: editAddress,
            latitude: editLat,
            longitude: editLng,
            isCharity: editIsCharity,
        });
        if (result.success) {
            setEditing(false);
            loadProfile();
        } else {
            setSaveError(result.error ?? 'Failed to save');
        }
        setSaving(false);
    };

    const handleSignOut = async () => {
        await logout();
        navigate('/login');
    };

    const getInitials = (name: string) =>
        name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

    const formatJoinDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // ── Loading ───────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="rp-page">
                <div className="rp-header">
                    <h1>My Profile</h1>
                    <p>Manage your account and preferences</p>
                </div>
                <ProfileSkeleton />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="rp-page">
                <div className="rp-error">
                    <p className="rp-error-msg">{error ?? 'Profile not found'}</p>
                    <button className="rp-retry-btn" onClick={loadProfile}>Try Again</button>
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────

    const joinDate = user?.createdAt ? formatJoinDate(user.createdAt) : null;

    return (
        <div className="rp-page">
            <div className="rp-header">
                <h1>My Profile</h1>
                <p>Manage your account and preferences</p>
            </div>

            <div className="rp-layout">
                {/* ── Avatar Card ───────────────────────────────── */}
                <div className="rp-avatar-card">
                    <div className="rp-avatar">{getInitials(profile.fullName)}</div>
                    <h2 className="rp-avatar-name">{profile.fullName}</h2>
                    <p className="rp-avatar-email">{profile.email}</p>
                    <span className="rp-role-badge">Recipient</span>
                    {profile.isCharity && <span className="rp-charity-badge">Charity</span>}
                    {joinDate && <p className="rp-joined">Joined {joinDate}</p>}

                    <div className="rp-stats-row">
                        <div className="rp-stat-item">
                            <span className="rp-stat-value">{stats.totalClaimed}</span>
                            <span className="rp-stat-label">Claimed</span>
                        </div>
                        <div className="rp-stat-item">
                            <span className="rp-stat-value">{stats.mealsReceived}</span>
                            <span className="rp-stat-label">Meals</span>
                        </div>
                    </div>

                    <button className="rp-signout-btn" onClick={handleSignOut}>
                        Sign Out
                    </button>
                </div>

                {/* ── Details Card ──────────────────────────────── */}
                <div className="rp-details-card">
                    <div className="rp-details-header">
                        <h2>Profile Details</h2>
                        {!editing && (
                            <button className="rp-edit-btn" onClick={enterEditMode}>
                                <PencilIcon /> Edit
                            </button>
                        )}
                    </div>

                    {editing ? (
                        /* ── Edit Form ─────────────────────────────── */
                        <div className="rp-form-grid">
                            <div className="rp-form-group">
                                <label htmlFor="rp-name">
                                    <PersonIcon /> Full Name
                                </label>
                                <input
                                    id="rp-name"
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder="Your full name"
                                />
                            </div>
                            <div className="rp-form-group">
                                <label htmlFor="rp-phone">
                                    <PhoneIcon /> Phone
                                </label>
                                <input
                                    id="rp-phone"
                                    type="tel"
                                    value={editPhone}
                                    onChange={e => setEditPhone(e.target.value)}
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                            <div className="rp-form-group">
                                <label htmlFor="rp-org">
                                    <OrgIcon /> Organization Name
                                </label>
                                <input
                                    id="rp-org"
                                    type="text"
                                    value={editOrgName}
                                    onChange={e => setEditOrgName(e.target.value)}
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="rp-form-group rp-full-width">
                                <label htmlFor="rp-address">
                                    <LocationIcon /> Address
                                </label>
                                <div className="rp-address-row">
                                    <input
                                        id="rp-address"
                                        type="text"
                                        value={editAddress}
                                        onChange={e => setEditAddress(e.target.value)}
                                        placeholder="Your address"
                                    />
                                    <button type="button" className="rp-geocode-btn" onClick={handleGeocode}>
                                        Find on Map
                                    </button>
                                </div>
                                {editLat !== 31.5204 && (
                                    <div className="rp-map-container">
                                        <MapPicker
                                            lat={editLat}
                                            lng={editLng}
                                            onLocationChange={(lat, lng) => { setEditLat(lat); setEditLng(lng); }}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="rp-form-group rp-full-width">
                                <label><StarIcon /> Charity Status</label>
                                <div className="rp-toggle-row">
                                    <label className="rp-toggle">
                                        <input
                                            type="checkbox"
                                            checked={editIsCharity}
                                            onChange={e => setEditIsCharity(e.target.checked)}
                                        />
                                        <span className="rp-toggle-slider" />
                                    </label>
                                    <span className="rp-toggle-label">
                                        {editIsCharity ? 'Registered charity' : 'Individual recipient'}
                                    </span>
                                </div>
                            </div>
                            {saveError && <p className="rp-inline-error">{saveError}</p>}
                            <div className="rp-form-actions">
                                <button className="rp-save-btn" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                                <button className="rp-cancel-btn" onClick={() => setEditing(false)} disabled={saving}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ── View Mode ─────────────────────────────── */
                        <div className="rp-view-grid">
                            <div className="rp-field">
                                <span className="rp-field-label">
                                    <PersonIcon /> Full Name
                                </span>
                                <span className="rp-field-value">{profile.fullName}</span>
                            </div>
                            <div className="rp-field">
                                <span className="rp-field-label">
                                    <MailIcon /> Email
                                </span>
                                <span className="rp-field-value">{profile.email}</span>
                            </div>
                            <div className="rp-field">
                                <span className="rp-field-label">
                                    <PhoneIcon /> Phone
                                </span>
                                <span className={`rp-field-value${!profile.phone ? ' rp-muted' : ''}`}>
                                    {profile.phone || 'Not set'}
                                </span>
                            </div>
                            <div className="rp-field">
                                <span className="rp-field-label">
                                    <OrgIcon /> Organization
                                </span>
                                <span className={`rp-field-value${!profile.organizationName ? ' rp-muted' : ''}`}>
                                    {profile.organizationName || 'Not set'}
                                </span>
                            </div>
                            <div className="rp-field">
                                <span className="rp-field-label">
                                    <LocationIcon /> Address
                                </span>
                                <span className={`rp-field-value${!profile.address ? ' rp-muted' : ''}`}>
                                    {profile.address || 'Not set'}
                                </span>
                            </div>
                            <div className="rp-field">
                                <span className="rp-field-label">
                                    <StarIcon /> Charity Status
                                </span>
                                <span className={`rp-field-value ${profile.isCharity ? 'rp-badge--charity' : 'rp-badge--individual'}`}>
                                    {profile.isCharity ? 'Charity' : 'Individual'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecipientProfile;
