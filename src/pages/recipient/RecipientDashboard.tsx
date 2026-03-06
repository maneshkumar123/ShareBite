import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { supabase } from '@services/api';
import { listingService } from '@services/listingService';
import { profileService } from '@services/profileService';
import { requestService } from '@services/requestService';
import { ROUTES } from '@utils/constants';
import './RecipientDashboard.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipientStats {
    totalClaimed: number;
    mealsReceived: number;
    availableCount: number;
}

interface NearbyListing {
    id: string;
    title: string;
    quantity: number;
    quantityUnit: string;
    expiryTime: string;
    address: string;
    donorName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const formatExpiry = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return 'Expired';
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return 'Expires soon';
    if (hrs < 24) return `${hrs}h left`;
    return `${Math.floor(hrs / 24)}d left`;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const ClaimedIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const MealsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" strokeLinecap="round"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4" strokeLinecap="round"/>
        <line x1="10" y1="1" x2="10" y2="4" strokeLinecap="round"/>
        <line x1="14" y1="1" x2="14" y2="4" strokeLinecap="round"/>
    </svg>
);

const NearbyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
    </svg>
);

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round"/>
    </svg>
);

const ChevronRight = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const MapPinIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
    </svg>
);

// ─── Listing Card ─────────────────────────────────────────────────────────────

const ListingCard: React.FC<{
    listing: NearbyListing;
    index: number;
    requested: boolean;
    onView: () => void;
}> = ({ listing, index, requested, onView }) => {
    const expiryText = formatExpiry(listing.expiryTime);
    const isUrgent = expiryText === 'Expires soon';

    return (
        <div className="rd__listing-card" style={{ animationDelay: `${index * 60}ms` }}>
            <div className="rd__listing-top">
                <h3 className="rd__listing-title">{listing.title}</h3>
                <span className={`rd__listing-expiry ${isUrgent ? 'rd__listing-expiry--urgent' : ''}`}>
                    {expiryText}
                </span>
            </div>
            <div className="rd__listing-meta">
                <span className="rd__listing-qty">{listing.quantity} {listing.quantityUnit}</span>
                <span className="rd__listing-dot">&middot;</span>
                <span className="rd__listing-donor">{listing.donorName}</span>
            </div>
            {listing.address && (
                <div className="rd__listing-address">
                    <MapPinIcon />
                    <span>{listing.address}</span>
                </div>
            )}
            <div className="rd__listing-footer">
                <Link to={`/listing/${listing.id}`} className="rd__details-link">Details</Link>
                {requested ? (
                    <span className="rd__requested-tag">Requested</span>
                ) : (
                    <button className="rd__claim-btn" onClick={onView}>
                        <span>Request Food</span><ChevronRight />
                    </button>
                )}
            </div>
        </div>
    );
};

const RecipientDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<RecipientStats>({ totalClaimed: 0, mealsReceived: 0, availableCount: 0 });
    const [listings, setListings] = useState<NearbyListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            // Claimed stats
            const { data: claimedData } = await supabase
                .from('food_listings')
                .select('quantity')
                .eq('claimed_by', user.id);

            const totalClaimed = claimedData?.length ?? 0;
            const mealsReceived = (claimedData ?? []).reduce((sum: number, r: { quantity: number | null }) => sum + (r.quantity ?? 0), 0);

            // Recipient location for nearby RPC
            let userLat: number | null = null;
            let userLng: number | null = null;
            const profileRes = await profileService.getRecipientProfile(user.id);
            if (profileRes.success && profileRes.data) {
                userLat = profileRes.data.latitude ?? null;
                userLng = profileRes.data.longitude ?? null;
            }

            // Use RPC for real nearby listings (10 km if location set, else all)
            const RADIUS = userLat && userLng ? 10_000 : null;
            const rpcRes = await listingService.getListingsWithDistance(userLat, userLng, RADIUS, 6);
            const nearby: NearbyListing[] = (rpcRes.data ?? []).map(row => ({
                id: row.id,
                title: row.title,
                quantity: row.quantity,
                quantityUnit: row.quantityUnit,
                expiryTime: row.expiryTime,
                address: row.address,
                donorName: row.donorName,
            }));

            // Available count: total rows returned by RPC without limit is expensive;
            // use a quick Supabase count query instead
            const { count: availableCount } = await supabase
                .from('food_listings')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'available')
                .gt('expiry_time', new Date().toISOString());

            setStats({ totalClaimed, mealsReceived, availableCount: availableCount ?? nearby.length });
            setListings(nearby);

            // Fetch which listings the user has already requested
            const reqRes = await requestService.getMyRequests(user.id);
            if (reqRes.success && reqRes.data) {
                setRequestedIds(new Set(reqRes.data.map(r => r.listingId)));
            }
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { load(); }, [load]);

    const firstName = user?.fullName?.split(' ')[0] || 'there';

    return (
        <div className="rd">
            {/* ── Header Bar ───────────────────────────────────── */}
            <div className="rd__topbar">
                <div className="rd__topbar-left">
                    <h1 className="rd__greeting">{greeting()}, {firstName}</h1>
                    <p className="rd__subtitle">Find surplus food near you</p>
                </div>
                <Link to={ROUTES.BROWSE_LISTINGS} className="rd__browse-btn" aria-label="Browse all available listings">
                    <SearchIcon /> Browse All
                </Link>
            </div>

            {/* ── Stats Grid ───────────────────────────────────── */}
            <div className="rd__stats">
                {[
                    { icon: <NearbyIcon />, value: isLoading ? '—' : stats.availableCount, label: 'Available Now', color: 'green', delay: '0ms' },
                    { icon: <ClaimedIcon />, value: isLoading ? '—' : stats.totalClaimed, label: 'Items Claimed', color: 'amber', delay: '60ms' },
                    { icon: <MealsIcon />, value: isLoading ? '—' : stats.mealsReceived, label: 'Meals Received', color: 'blue', delay: '120ms' },
                ].map(({ icon, value, label, color, delay }) => (
                    <div key={label} className={`rd__stat-card rd__stat-card--${color}`} style={{ animationDelay: delay }}>
                        <div className="rd__stat-icon">{icon}</div>
                        <div className="rd__stat-value">{value}</div>
                        <div className="rd__stat-label">{label}</div>
                    </div>
                ))}
            </div>

            {/* ── Available Listings ───────────────────────────── */}
            <div className="rd__section">
                <div className="rd__section-header">
                    <h2 className="rd__section-title">Available Near You</h2>
                    <Link to={ROUTES.BROWSE_LISTINGS} className="rd__section-link">
                        Browse all <ChevronRight />
                    </Link>
                </div>

                {isLoading ? (
                    <div className="rd__grid">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="rd__skeleton" style={{ animationDelay: `${i * 80}ms` }} />
                        ))}
                    </div>
                ) : listings.length === 0 ? (
                    <div className="rd__empty">
                        <div className="rd__empty-icon" aria-hidden="true">
                            <svg viewBox="0 0 80 80" fill="none" width="72" height="72">
                                <path d="M40 70s-18-12-18-29a18 18 0 0 1 36 0c0 17-18 29-18 29z" stroke="rgba(125,255,18,0.35)" strokeWidth="2.4" />
                                <circle cx="40" cy="41" r="7.5" stroke="rgba(125,255,18,0.45)" strokeWidth="2.4" />
                            </svg>
                        </div>
                        <p className="rd__empty-title">No listings near you yet</p>
                        <p className="rd__empty-sub">When donors post food in your area, it will appear here</p>
                        <Link to={ROUTES.BROWSE_LISTINGS} className="rd__empty-btn">
                            <SearchIcon /> Browse All Listings
                        </Link>
                    </div>
                ) : (
                    <div className="rd__grid">
                        {listings.map((l, i) => (
                            <ListingCard
                                key={l.id}
                                listing={l}
                                index={i}
                                requested={requestedIds.has(l.id)}
                                onView={() => navigate(`/listing/${l.id}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecipientDashboard;
