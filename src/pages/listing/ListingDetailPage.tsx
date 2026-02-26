import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { listingService } from '@services/listingService';
import type { ListingDetail } from '@services/listingService';
import { importLibrary } from '@/lib/googleMaps';
import './ListingDetailPage.css';

// ─── Dark Map Styles ───────────────────────────────────────────────────────────

const DARK_STYLES: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#141414' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#141414' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#aaaaaa' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e1e1e' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#282828' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1f2e' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a3a4a' }] },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const calcTimeLeft = (iso: string): string => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const totalMins = Math.floor(diff / 60_000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs >= 24) {
        const days = Math.floor(hrs / 24);
        const remHrs = hrs % 24;
        return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
    }
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
};

const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

const formatDateShort = (iso: string): string => {
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
    });
};

const ORG_TYPE_LABELS: Record<string, string> = {
    restaurant: 'Restaurant',
    grocery: 'Grocery',
    bakery: 'Bakery',
    catering: 'Catering',
    hotel: 'Hotel',
    ngo: 'NGO',
    other: 'Donor',
};

// ─── Icons ─────────────────────────────────────────────────────────────────────

const BackIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="14" height="14" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

const ClockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" strokeLinecap="round" />
    </svg>
);

const PinIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
);

const PhoneIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.09h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.65a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 16a2 2 0 0 0 .5.92z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const UserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const SpinnerIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"
        style={{ animation: 'ldp-spin 0.75s linear infinite', flexShrink: 0 }}>
        <path d="M12 2a10 10 0 1 1-3 .5" strokeLinecap="round" />
    </svg>
);

// ─── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: 'available' | 'claimed' | 'expired' }> = ({ status }) => {
    const map = {
        available: { label: 'Available', cls: 'ldp-badge--available' },
        claimed:   { label: 'Claimed',   cls: 'ldp-badge--claimed'   },
        expired:   { label: 'Expired',   cls: 'ldp-badge--expired'   },
    };
    const { label, cls } = map[status];
    return <span className={`ldp-badge ${cls}`}>{label}</span>;
};

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

const LoadingSkeleton: React.FC = () => (
    <div className="ldp-skeleton-wrap">
        <div className="ldp-skel ldp-skel--title" />
        <div className="ldp-skel ldp-skel--meta" />
        <div className="ldp-skeleton-body">
            <div className="ldp-skeleton-left">
                <div className="ldp-skel ldp-skel--text" />
                <div className="ldp-skel ldp-skel--text ldp-skel--short" />
                <div className="ldp-skel ldp-skel--text" />
            </div>
            <div className="ldp-skeleton-right">
                <div className="ldp-skel ldp-skel--countdown" />
                <div className="ldp-skel ldp-skel--btn" />
                <div className="ldp-skel ldp-skel--map" />
            </div>
        </div>
    </div>
);

// ─── Mini Map ─────────────────────────────────────────────────────────────────

const MiniMap: React.FC<{ lat: number; lng: number; title: string }> = ({ lat, lng, title }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const [mapError, setMapError] = useState(false);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        let cancelled = false;

        importLibrary('maps').then(lib => {
            if (cancelled || !containerRef.current) return;
            const { Map } = lib as google.maps.MapsLibrary;

            mapRef.current = new Map(containerRef.current, {
                center: { lat, lng },
                zoom: 15,
                styles: DARK_STYLES,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                clickableIcons: false,
            });

            new google.maps.Marker({
                map: mapRef.current,
                position: { lat, lng },
                title,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#7DFF12',
                    fillOpacity: 1,
                    strokeColor: '#0b0b0b',
                    strokeWeight: 3,
                    scale: 10,
                },
            });
        }).catch(() => {
            if (!cancelled) setMapError(true);
        });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lat, lng]);

    if (mapError) {
        return (
            <div className="ldp-map-fallback">
                <PinIcon />
                <span>Map unavailable</span>
            </div>
        );
    }

    return <div ref={containerRef} className="ldp-mini-map" />;
};

// ─── Confirm Modal ─────────────────────────────────────────────────────────────

const ConfirmModal: React.FC<{
    title: string;
    donorName: string;
    isConfirming: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ title, donorName, isConfirming, onConfirm, onCancel }) => (
    <div className="ldp-modal-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
        <div className="ldp-modal" onClick={e => e.stopPropagation()}>
            <p className="ldp-modal-label">Confirm claim</p>
            <h3 className="ldp-modal-title">{title}</h3>
            <p className="ldp-modal-donor">from {donorName}</p>
            <p className="ldp-modal-note">
                Once claimed the listing is removed from the pool.
                Please collect before it expires.
            </p>
            <div className="ldp-modal-actions">
                <button className="ldp-modal-cancel" onClick={onCancel} disabled={isConfirming}>Cancel</button>
                <button className="ldp-modal-confirm" onClick={onConfirm} disabled={isConfirming}>
                    {isConfirming ? <><SpinnerIcon /> Claiming…</> : 'Confirm Claim'}
                </button>
            </div>
        </div>
    </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const ListingDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [listing, setListing] = useState<ListingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [timeLeft, setTimeLeft] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [claimSuccess, setClaimSuccess] = useState(false);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        listingService.getListingById(id).then(res => {
            if (res.success && res.data) {
                setListing(res.data);
                setTimeLeft(calcTimeLeft(res.data.expiryTime));
            } else {
                setError(res.error ?? 'Listing not found');
            }
            setLoading(false);
        });
    }, [id]);

    useEffect(() => {
        if (!listing) return;
        const timer = setInterval(() => setTimeLeft(calcTimeLeft(listing.expiryTime)), 60_000);
        return () => clearInterval(timer);
    }, [listing?.expiryTime]);

    const handleClaim = useCallback(async () => {
        if (!user?.id || !listing || claiming) return;
        setClaiming(true);
        try {
            const res = await listingService.claimListing(listing.id, user.id);
            if (res.success) {
                setListing(prev => prev ? { ...prev, status: 'claimed' } : prev);
                setClaimSuccess(true);
                setShowModal(false);
            } else {
                setError(res.error ?? 'Failed to claim listing');
                setShowModal(false);
            }
        } catch {
            setError('An error occurred while claiming.');
            setShowModal(false);
        } finally {
            setClaiming(false);
        }
    }, [user?.id, listing, claiming]);

    const isExpired  = listing ? new Date(listing.expiryTime).getTime() <= Date.now() : false;
    const isDonor    = user?.id === listing?.donorId;
    const isRecipient = !isDonor;
    const canClaim   = isRecipient && listing?.status === 'available' && !isExpired && !claimSuccess;

    if (loading) {
        return (
            <div className="ldp-page">
                <div className="ldp-nav">
                    <button className="ldp-back-btn" onClick={() => navigate(-1)}><BackIcon /> Back</button>
                </div>
                <LoadingSkeleton />
            </div>
        );
    }

    if (error || !listing) {
        return (
            <div className="ldp-page">
                <div className="ldp-nav">
                    <button className="ldp-back-btn" onClick={() => navigate(-1)}><BackIcon /> Back</button>
                </div>
                <div className="ldp-error">
                    <p>{error ?? 'Listing not found'}</p>
                    <button onClick={() => navigate(-1)}>Go back</button>
                </div>
            </div>
        );
    }

    const orgTypeLabel = ORG_TYPE_LABELS[listing.donorOrgType] ?? 'Donor';
    const hasMap = listing.lat != null && listing.lng != null;
    const currentStatus = claimSuccess ? 'claimed' : listing.status;

    return (
        <div className="ldp-page">

            {/* ── Nav ──────────────────────────────────────────── */}
            <div className="ldp-nav">
                <button className="ldp-back-btn" onClick={() => navigate(-1)}>
                    <BackIcon /> Back
                </button>
                <StatusBadge status={currentStatus} />
            </div>

            {/* ── Editorial Header ─────────────────────────────── */}
            <header className="ldp-header">
                <h1 className="ldp-title">{listing.title}</h1>
                <div className="ldp-meta">
                    <span>{listing.quantity} {listing.quantityUnit}</span>
                    <span className="ldp-meta-dot" aria-hidden="true">·</span>
                    <span>{orgTypeLabel}</span>
                    <span className="ldp-meta-dot" aria-hidden="true">·</span>
                    <span>Posted {formatDateShort(listing.createdAt)}</span>
                </div>
            </header>

            {/* ── Body Layout ──────────────────────────────────── */}
            <div className="ldp-layout">

                {/* ── LEFT ──────────────────────────────────────── */}
                <div className="ldp-left">

                    {/* Image (only if real URL) */}
                    {listing.imageUrl && (
                        <div className="ldp-image-wrap">
                            <img src={listing.imageUrl} alt={listing.title} className="ldp-image" />
                        </div>
                    )}

                    {/* Description */}
                    {listing.description && (
                        <div className="ldp-section">
                            <p className="ldp-description">{listing.description}</p>
                        </div>
                    )}

                    {/* Location */}
                    {listing.address && (
                        <div className="ldp-section">
                            <p className="ldp-section-label">Location</p>
                            <p className="ldp-address">
                                <PinIcon />
                                <span>{listing.address}</span>
                            </p>
                        </div>
                    )}

                    {/* Donor */}
                    <div className="ldp-section">
                        <p className="ldp-section-label">Donor</p>
                        <div className="ldp-donor">
                            <div className="ldp-donor-primary">
                                <span className="ldp-donor-name">{listing.donorName}</span>
                                <span className="ldp-donor-type">{orgTypeLabel}</span>
                            </div>
                            {(listing.contactPerson || listing.donorPhone) && (
                                <div className="ldp-donor-contact">
                                    {listing.contactPerson && (
                                        <span className="ldp-contact-row">
                                            <UserIcon />{listing.contactPerson}
                                        </span>
                                    )}
                                    {listing.donorPhone && (
                                        <span className="ldp-contact-row">
                                            <PhoneIcon />
                                            <a href={`tel:${listing.donorPhone}`} className="ldp-phone-link">
                                                {listing.donorPhone}
                                            </a>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT ─────────────────────────────────────── */}
                <div className="ldp-right">

                    {/* Expiry Countdown */}
                    <div className="ldp-expiry">
                        <p className="ldp-section-label">
                            <ClockIcon /> Time Remaining
                        </p>
                        <p className={`ldp-countdown${timeLeft === 'Expired' ? ' ldp-countdown--expired' : ''}`}>
                            {timeLeft}
                        </p>
                        <p className="ldp-expiry-date">
                            {timeLeft === 'Expired' ? 'Expired' : 'Expires'} {formatDate(listing.expiryTime)}
                        </p>
                    </div>

                    {/* Action */}
                    <div className="ldp-action">
                        {isDonor ? (
                            <div className="ldp-your-listing">Your Listing</div>
                        ) : claimSuccess ? (
                            <div className="ldp-claim-success">
                                <span className="ldp-claim-success-check">✓</span>
                                <p>Successfully claimed. Please collect before expiry.</p>
                            </div>
                        ) : listing.status === 'available' && !isExpired ? (
                            <button
                                className="ldp-claim-btn"
                                onClick={() => setShowModal(true)}
                                disabled={claiming}
                            >
                                {claiming ? <><SpinnerIcon /> Claiming…</> : 'Claim This Food'}
                            </button>
                        ) : (
                            <div className="ldp-status-note">
                                {listing.status === 'claimed'
                                    ? 'This listing has already been claimed.'
                                    : 'This listing has expired.'}
                            </div>
                        )}
                    </div>

                    {/* Map */}
                    {hasMap && (
                        <div className="ldp-map-wrap">
                            <p className="ldp-section-label">Pickup Location</p>
                            <MiniMap lat={listing.lat!} lng={listing.lng!} title={listing.title} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Mobile Sticky Claim Bar ─────────────────────── */}
            {canClaim && (
                <div className="ldp-sticky-bar">
                    <div className="ldp-sticky-info">
                        <span className="ldp-sticky-title">{listing.title}</span>
                        <span className="ldp-sticky-expiry">{timeLeft}</span>
                    </div>
                    <button
                        className="ldp-sticky-claim-btn"
                        onClick={() => setShowModal(true)}
                        disabled={claiming}
                    >
                        {claiming ? <SpinnerIcon /> : null}
                        {claiming ? 'Claiming…' : 'Claim'}
                    </button>
                </div>
            )}

            {/* ── Confirm Modal ────────────────────────────────── */}
            {showModal && (
                <ConfirmModal
                    title={listing.title}
                    donorName={listing.donorName}
                    isConfirming={claiming}
                    onConfirm={handleClaim}
                    onCancel={() => setShowModal(false)}
                />
            )}
        </div>
    );
};

export default ListingDetailPage;
