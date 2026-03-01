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

const getExpiryUrgency = (iso: string): 'expired' | 'urgent' | 'normal' => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return 'expired';
    if (diff < 3600000) return 'urgent';
    return 'normal';
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const PlusIcon = ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={size} height={size}>
        <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
        <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
    </svg>
);

const ClockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" strokeLinecap="round" />
    </svg>
);

const ChevronRight = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
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

// ─── Skeleton Components ──────────────────────────────────────────────────────

const StatStripSkeleton = () => (
    <div className="dd__stat-strip dd__stat-strip--skeleton">
        {[...Array(4)].map((_, i) => (
            <div key={i} className="dd__stat-item">
                <div className="dd__skel-line dd__skel-line--xl" />
                <div className="dd__skel-line dd__skel-line--sm" style={{ marginTop: '0.5rem' }} />
            </div>
        ))}
    </div>
);

const ListingCardSkeleton = () => (
    <div className="dd__listing-card dd__listing-card--skeleton">
        <div className="dd__listing-card-top">
            <div className="dd__skel-line dd__skel-line--lg" />
            <div className="dd__skel-pill" />
        </div>
        <div className="dd__listing-card-details">
            <div className="dd__skel-line dd__skel-line--md" />
            <div className="dd__skel-line dd__skel-line--sm" />
        </div>
    </div>
);

const TableRowSkeleton = () => (
    <tr className="dd__table-row dd__table-row--skeleton">
        <td><div className="dd__skel-line dd__skel-line--lg" /></td>
        <td><div className="dd__skel-pill" /></td>
        <td><div className="dd__skel-line dd__skel-line--sm" /></td>
        <td><div className="dd__skel-line dd__skel-line--sm" /></td>
        <td><div className="dd__skel-line dd__skel-line--sm" /></td>
    </tr>
);

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
    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="dd">
            {/* ── Header ───────────────────────────────────────── */}
            <div className="dd__topbar">
                <div className="dd__topbar-left">
                    <p className="dd__greeting-pre">{greeting()}</p>
                    <h1 className="dd__greeting">{firstName}</h1>
                    {orgName && <p className="dd__org">{orgName}</p>}
                </div>
                <div className="dd__topbar-right">
                    <span className="dd__date">{todayLabel}</span>
                    <Link to={ROUTES.CREATE_LISTING} className="dd__post-btn" aria-label="Post food listing">
                        <PlusIcon size={14} /> <span>Post Listing</span>
                    </Link>
                </div>
            </div>

            {/* ── Stats Strip ──────────────────────────────────── */}
            <section className="dd__stats" aria-label="Key metrics">
                {isLoading ? <StatStripSkeleton /> : (
                    <div className="dd__stat-strip">
                        {[
                            { value: stats.mealsShared, label: 'Meals Shared', accent: false },
                            { value: stats.total, label: 'Total Listings', accent: false },
                            { value: stats.active, label: 'Active Now', accent: true },
                            { value: stats.claimed, label: 'Claimed', accent: false },
                        ].map(({ value, label, accent }, i) => (
                            <div key={label} className={`dd__stat-item${accent ? ' dd__stat-item--accent' : ''}`}
                                style={{ animationDelay: `${i * 60}ms` }}>
                                <span className="dd__stat-num">{value}</span>
                                <span className="dd__stat-lbl">{label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ── LAYER 2: Recent Listings ─────────────────────── */}
            <section className="dd__section" aria-label="Recent listings">
                <div className="dd__section-header">
                    <h2 className="dd__section-title">Recent Listings</h2>
                    <Link to="/donor/listings" className="dd__section-link">
                        View all <ChevronRight />
                    </Link>
                </div>

                {isLoading ? (
                    <>
                        {/* Mobile: Card skeletons */}
                        <div className="dd__listings-cards">
                            {[...Array(3)].map((_, i) => <ListingCardSkeleton key={i} />)}
                        </div>
                        {/* Desktop: Table skeletons */}
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
                                    {[...Array(4)].map((_, i) => <TableRowSkeleton key={i} />)}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : listings.length === 0 ? (
                    <div className="dd__empty">
                        <div className="dd__empty-icon" aria-hidden="true">
                            <svg viewBox="0 0 80 80" fill="none" width="80" height="80">
                                <rect x="8" y="20" width="64" height="44" rx="8" stroke="rgba(125,255,18,0.3)" strokeWidth="2" strokeDasharray="6 4" />
                                <circle cx="40" cy="42" r="12" stroke="rgba(125,255,18,0.2)" strokeWidth="2" />
                                <line x1="40" y1="36" x2="40" y2="48" stroke="rgba(125,255,18,0.4)" strokeWidth="2" strokeLinecap="round" />
                                <line x1="34" y1="42" x2="46" y2="42" stroke="rgba(125,255,18,0.4)" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <p className="dd__empty-title">No listings yet</p>
                        <p className="dd__empty-sub">Post your first surplus food and start making an impact</p>
                        <Link to={ROUTES.CREATE_LISTING} className="dd__empty-btn">
                            <PlusIcon size={16} /> Create Your First Listing
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Mobile: Card Stack */}
                        <div className="dd__listings-cards">
                            {listings.map((l, i) => {
                                const urgency = getExpiryUrgency(l.expiryTime);
                                return (
                                    <div key={l.id} className="dd__listing-card" style={{ animationDelay: `${i * 60}ms` }}>
                                        <div className="dd__listing-card-top">
                                            <span className="dd__listing-card-title">{l.title}</span>
                                            <StatusPill status={l.status} />
                                        </div>
                                        <div className="dd__listing-card-details">
                                            <span className="dd__listing-card-qty">
                                                {l.quantity} {l.quantityUnit}
                                            </span>
                                            <span className="dd__listing-card-divider" aria-hidden="true">·</span>
                                            <span className={`dd__listing-card-expiry dd__listing-card-expiry--${urgency}`}>
                                                <ClockIcon /> {formatExpiry(l.expiryTime)}
                                            </span>
                                        </div>
                                        <div className="dd__listing-card-footer">
                                            <span className="dd__listing-card-time">{formatTimeAgo(l.createdAt)}</span>
                                            <Link to={`/listing/${l.id}`} className="dd__listing-card-view-link">View</Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Tablet+: Table */}
                        <div className="dd__table-wrap">
                            <table className="dd__table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Status</th>
                                        <th>Quantity</th>
                                        <th>Expires</th>
                                        <th>Posted</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {listings.map((l, i) => (
                                        <tr key={l.id} style={{ animationDelay: `${i * 40}ms` }} className="dd__table-row">
                                            <td className="dd__table-title">{l.title}</td>
                                            <td><StatusPill status={l.status} /></td>
                                            <td className="dd__table-qty">{l.quantity} {l.quantityUnit}</td>
                                            <td className={`dd__table-expiry dd__table-expiry--${getExpiryUrgency(l.expiryTime)}`}>
                                                {formatExpiry(l.expiryTime)}
                                            </td>
                                            <td className="dd__table-time">{formatTimeAgo(l.createdAt)}</td>
                                            <td>
                                                <Link to={`/listing/${l.id}`} className="dd__table-view-link">View</Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>

            {/* ── FAB: Mobile-only floating action button ──────── */}
            <Link
                to={ROUTES.CREATE_LISTING}
                className="dd__fab"
                aria-label="Post new food listing"
            >
                <PlusIcon size={24} />
            </Link>
        </div>
    );
};

export default DonorDashboard;
