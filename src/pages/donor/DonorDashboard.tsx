import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { listingService } from '@services/listingService';
import type { DonorStats, DonorListing } from '@services/listingService';
import { ROUTES } from '@utils/constants';
import './DonorDashboard.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return 'Expired';
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return 'Expires soon';
    if (hrs < 24) return `${hrs}h left`;
    return `${Math.floor(hrs / 24)}d left`;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const TotalIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);

const ActiveIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
);

const ClaimedIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const MealsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" strokeLinecap="round" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" strokeLinecap="round" />
        <line x1="10" y1="1" x2="10" y2="4" strokeLinecap="round" />
        <line x1="14" y1="1" x2="14" y2="4" strokeLinecap="round" />
    </svg>
);

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
        <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
    </svg>
);

// ─── Status Pill ──────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: 'available' | 'claimed' | 'expired' }> = ({ status }) => {
    const map = {
        available: { label: 'Active', cls: 'pill--active' },
        claimed: { label: 'Claimed', cls: 'pill--claimed' },
        expired: { label: 'Expired', cls: 'pill--expired' },
    };
    const { label, cls } = map[status];
    return <span className={`status-pill ${cls}`}><span className="pill-dot" />{label}</span>;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DonorDashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<DonorStats>({ total: 0, active: 0, claimed: 0, mealsShared: 0 });
    const [listings, setListings] = useState<DonorListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const [statsRes, listingsRes] = await Promise.all([
                listingService.getDonorStats(user.id),
                listingService.getDonorListings(user.id, 8),
            ]);
            if (statsRes.success && statsRes.data) setStats(statsRes.data);
            if (listingsRes.success && listingsRes.data) setListings(listingsRes.data);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { load(); }, [load]);

    const firstName = user?.fullName?.split(' ')[0] || 'there';
    const orgName = user?.donorProfile?.organizationName;

    return (
        <div className="dd">
            {/* ── Header Bar ───────────────────────────────────── */}
            <div className="dd__topbar">
                <div className="dd__topbar-left">
                    <h1 className="dd__greeting">{greeting()}, {firstName}</h1>
                    {orgName && <p className="dd__org">{orgName}</p>}
                </div>
                <Link to={ROUTES.CREATE_LISTING} className="dd__post-btn">
                    <PlusIcon /> Post Food
                </Link>
            </div>

            {/* ── Stats Grid ───────────────────────────────────── */}
            <div className="dd__stats">
                {[
                    { icon: <TotalIcon />, value: isLoading ? '\u2014' : stats.total, label: 'Total Listings', color: 'default', delay: '0ms' },
                    { icon: <ActiveIcon />, value: isLoading ? '\u2014' : stats.active, label: 'Active Now', color: 'green', delay: '60ms' },
                    { icon: <ClaimedIcon />, value: isLoading ? '\u2014' : stats.claimed, label: 'Claimed', color: 'amber', delay: '120ms' },
                    { icon: <MealsIcon />, value: isLoading ? '\u2014' : stats.mealsShared, label: 'Meals Shared', color: 'blue', delay: '180ms' },
                ].map(({ icon, value, label, color, delay }) => (
                    <div key={label} className={`dd__stat-card dd__stat-card--${color}`} style={{ animationDelay: delay }}>
                        <div className="dd__stat-icon">{icon}</div>
                        <div className="dd__stat-value">{value}</div>
                        <div className="dd__stat-label">{label}</div>
                    </div>
                ))}
            </div>

            {/* ── Listings Table ───────────────────────────────── */}
            <div className="dd__section">
                <div className="dd__section-header">
                    <h2 className="dd__section-title">Recent Listings</h2>
                    <Link to="/donor/listings" className="dd__section-link">View all &rarr;</Link>
                </div>

                {isLoading ? (
                    <div className="dd__loading">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="dd__skeleton" style={{ animationDelay: `${i * 100}ms` }} />
                        ))}
                    </div>
                ) : listings.length === 0 ? (
                    <div className="dd__empty">
                        <div className="dd__empty-icon">&#127869;</div>
                        <p className="dd__empty-title">No listings yet</p>
                        <p className="dd__empty-sub">Post your first surplus food to get started</p>
                        <Link to={ROUTES.CREATE_LISTING} className="dd__empty-btn">
                            <PlusIcon /> Create Listing
                        </Link>
                    </div>
                ) : (
                    <div className="dd__table-wrap">
                        <table className="dd__table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Status</th>
                                    <th>Quantity</th>
                                    <th>Expires</th>
                                    <th>Posted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listings.map((l, i) => (
                                    <tr key={l.id} style={{ animationDelay: `${i * 40}ms` }} className="dd__table-row">
                                        <td className="dd__table-title">{l.title}</td>
                                        <td><StatusPill status={l.status} /></td>
                                        <td className="dd__table-qty">{l.quantity} {l.quantityUnit}</td>
                                        <td className={`dd__table-expiry ${l.status === 'expired' ? 'dd__table-expiry--expired' : ''}`}>
                                            {formatExpiry(l.expiryTime)}
                                        </td>
                                        <td className="dd__table-time">{formatTimeAgo(l.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DonorDashboard;
