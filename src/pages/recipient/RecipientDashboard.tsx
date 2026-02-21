import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { supabase } from '@services/api';
import { ROUTES } from '@utils/constants';
import './RecipientDashboard.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipientStats {
    totalClaimed: number;
    mealsReceived: number;
    nearbyCount: number;
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

const MapPinIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
    </svg>
);

// ─── Listing Card ─────────────────────────────────────────────────────────────

const ListingCard: React.FC<{ listing: NearbyListing; index: number }> = ({ listing, index }) => {
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
                <Link to={`/listing/${listing.id}`} className="rd__claim-btn">
                    Claim Food
                </Link>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RecipientDashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<RecipientStats>({ totalClaimed: 0, mealsReceived: 0, nearbyCount: 0 });
    const [listings, setListings] = useState<NearbyListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            // Load claimed stats
            const { data: claimedData } = await supabase
                .from('food_listings')
                .select('quantity')
                .eq('claimed_by', user.id);

            const totalClaimed = claimedData?.length ?? 0;
            const mealsReceived = (claimedData ?? []).reduce((sum: number, r: { quantity: number | null }) => sum + (r.quantity ?? 0), 0);

            // Load nearby/available listings
            const { data: nearbyData } = await supabase
                .from('food_listings')
                .select('id, title, quantity, quantity_unit, expiry_time, address, donor_id')
                .eq('status', 'available')
                .gt('expiry_time', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(6);

            const nearby: NearbyListing[] = (nearbyData ?? []).map((row: { id: string; title: string; quantity: number; quantity_unit: string; expiry_time: string; address: string | null; donor_id: string }) => ({
                id: row.id,
                title: row.title,
                quantity: row.quantity,
                quantityUnit: row.quantity_unit,
                expiryTime: row.expiry_time,
                address: row.address ?? '',
                donorName: 'Donor',
            }));

            setStats({ totalClaimed, mealsReceived, nearbyCount: nearby.length });
            setListings(nearby);
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
                <Link to={ROUTES.BROWSE_LISTINGS} className="rd__browse-btn">
                    <SearchIcon /> Browse All
                </Link>
            </div>

            {/* ── Stats Grid ───────────────────────────────────── */}
            <div className="rd__stats">
                {[
                    { icon: <NearbyIcon />, value: isLoading ? '\u2014' : stats.nearbyCount, label: 'Available Nearby', color: 'green', delay: '0ms' },
                    { icon: <ClaimedIcon />, value: isLoading ? '\u2014' : stats.totalClaimed, label: 'Items Claimed', color: 'amber', delay: '60ms' },
                    { icon: <MealsIcon />, value: isLoading ? '\u2014' : stats.mealsReceived, label: 'Meals Received', color: 'blue', delay: '120ms' },
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
                    <Link to={ROUTES.BROWSE_LISTINGS} className="rd__section-link">Browse all &rarr;</Link>
                </div>

                {isLoading ? (
                    <div className="rd__grid">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="rd__skeleton" style={{ animationDelay: `${i * 80}ms` }} />
                        ))}
                    </div>
                ) : listings.length === 0 ? (
                    <div className="rd__empty">
                        <div className="rd__empty-icon">&#x1F4CD;</div>
                        <p className="rd__empty-title">No listings near you yet</p>
                        <p className="rd__empty-sub">When donors post food in your area, it will appear here</p>
                        <Link to={ROUTES.BROWSE_LISTINGS} className="rd__empty-btn">
                            <SearchIcon /> Browse All Listings
                        </Link>
                    </div>
                ) : (
                    <div className="rd__grid">
                        {listings.map((l, i) => (
                            <ListingCard key={l.id} listing={l} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecipientDashboard;
