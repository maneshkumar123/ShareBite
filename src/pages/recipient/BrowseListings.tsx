import React, {
    useEffect, useState, useCallback, useMemo, useRef,
} from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { listingService } from '@services/listingService';
import { profileService } from '@services/profileService';
import { importLibrary } from '@/lib/googleMaps';
import type { EnhancedListing } from '@services/listingService';
import './BrowseListings.css';

// ─── Constants ─────────────────────────────────────────────────────────────────

const NEARBY_RADIUS_M = 10_000; // 10 km

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

const formatExpiry = (iso: string): { label: string; variant: 'green' | 'orange' | 'red' } => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return { label: 'Expired', variant: 'red' };
    const hrs = Math.floor(diff / 3_600_000);
    if (hrs < 3) return { label: 'Soon', variant: 'red' };
    if (hrs < 24) return { label: `${hrs}h left`, variant: 'orange' };
    return { label: `${Math.floor(hrs / 24)}d left`, variant: 'green' };
};

const formatDistance = (m: number | null): string => {
    if (m == null) return '';
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
};

// ─── Icons ─────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round"/>
    </svg>
);
const MapIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
);
const ListIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
        <line x1="8" y1="6" x2="21" y2="6" strokeLinecap="round"/>
        <line x1="8" y1="12" x2="21" y2="12" strokeLinecap="round"/>
        <line x1="8" y1="18" x2="21" y2="18" strokeLinecap="round"/>
        <circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/>
    </svg>
);
const PinIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
);
const DistIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <circle cx="12" cy="12" r="3"/>
        <line x1="12" y1="1" x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="1" y1="12" x2="5" y2="12"/>
        <line x1="19" y1="12" x2="23" y2="12"/>
    </svg>
);
const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
);
const ChevronRight = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
    </svg>
);
const SpinnerIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"
        style={{ animation: 'bl-spin 0.75s linear infinite', flexShrink: 0 }}>
        <path d="M12 2a10 10 0 1 1-3 .5" strokeLinecap="round"/>
    </svg>
);
const FoodIcon = () => (
    <svg viewBox="0 0 80 80" fill="none" width="64" height="64">
        <path d="M16 40h48M20 40c0 11 9 20 20 20s20-9 20-20" stroke="rgba(125,255,18,0.3)" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M32 28c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="rgba(125,255,18,0.2)" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
);

// ─── Confirm Modal ─────────────────────────────────────────────────────────────

const ConfirmModal: React.FC<{
    listing: EnhancedListing;
    isConfirming: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ listing, isConfirming, onConfirm, onCancel }) => (
    <div className="bl-modal-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
        <div className="bl-modal" onClick={e => e.stopPropagation()}>
            <p className="bl-modal-label">Confirm claim</p>
            <h3 className="bl-modal-title">{listing.title}</h3>
            <p className="bl-modal-donor">from {listing.donorName}</p>
            <p className="bl-modal-note">
                Once claimed the listing is removed from the pool.
                Please collect before it expires.
            </p>
            <div className="bl-modal-actions">
                <button className="bl-modal-cancel" onClick={onCancel} disabled={isConfirming}>Cancel</button>
                <button className="bl-modal-confirm" onClick={onConfirm} disabled={isConfirming}>
                    {isConfirming ? <><SpinnerIcon /> Claiming…</> : 'Confirm Claim'}
                </button>
            </div>
        </div>
    </div>
);

// ─── Listing Card (List View) ──────────────────────────────────────────────────

const ListingCard: React.FC<{
    listing: EnhancedListing;
    index: number;
    isClaiming: boolean;
    isClaimed: boolean;
    onRequestClaim: () => void;
}> = ({ listing, index, isClaiming, isClaimed, onRequestClaim }) => {
    const expiry = formatExpiry(listing.expiryTime);
    const dist = formatDistance(listing.distanceM);

    return (
        <div className="bl-card" style={{ animationDelay: `${index * 45}ms` }}>
            <div className="bl-card-img">
                {listing.imageUrl
                    ? <img src={listing.imageUrl} alt={listing.title} loading="lazy" />
                    : <div className="bl-card-img-empty"><span>🍱</span></div>
                }
                <span className={`bl-expiry-badge bl-expiry-badge--${expiry.variant}`}>{expiry.label}</span>
                {dist && (
                    <span className="bl-dist-badge">
                        <DistIcon /> {dist}
                    </span>
                )}
            </div>
            <div className="bl-card-body">
                <h3 className="bl-card-title">{listing.title}</h3>
                <p className="bl-card-donor">by {listing.donorName}</p>
                {listing.address && (
                    <div className="bl-card-address"><PinIcon /><span>{listing.address}</span></div>
                )}
                <div className="bl-card-foot">
                    <span className="bl-card-qty">{listing.quantity} {listing.quantityUnit}</span>
                    <div className="bl-card-actions">
                        <Link to={`/listing/${listing.id}`} className="bl-details-link">Details</Link>
                        {isClaimed
                            ? <span className="bl-claimed-tag">✓ Claimed</span>
                            : (
                                <button className="bl-claim-btn" onClick={onRequestClaim} disabled={isClaiming}>
                                    {isClaiming ? <SpinnerIcon /> : null}
                                    {isClaiming ? 'Claiming…' : 'Claim'}
                                </button>
                            )
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Map Info Panel ────────────────────────────────────────────────────────────

const MapInfoPanel: React.FC<{
    listing: EnhancedListing | null;
    isClaiming: boolean;
    isClaimed: boolean;
    onClaim: () => void;
    onClose: () => void;
}> = ({ listing, isClaiming, isClaimed, onClaim, onClose }) => {
    if (!listing) return null;
    const expiry = formatExpiry(listing.expiryTime);
    const dist = formatDistance(listing.distanceM);

    return (
        <div className="bl-info-panel" role="dialog" aria-label={listing.title}>
            <div className="bl-info-drag-handle" />

            <button className="bl-info-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>

            {/* Image */}
            <div className="bl-info-img">
                {listing.imageUrl
                    ? <img src={listing.imageUrl} alt={listing.title} />
                    : <div className="bl-info-img-empty"><span>🍱</span></div>
                }
            </div>

            {/* Badges */}
            <div className="bl-info-badges">
                <span className={`bl-expiry-badge bl-expiry-badge--${expiry.variant}`}>{expiry.label}</span>
                <span className="bl-info-qty-badge">{listing.quantity} {listing.quantityUnit}</span>
                {dist && <span className="bl-info-dist-badge"><DistIcon /> {dist}</span>}
            </div>

            {/* Title + donor */}
            <h3 className="bl-info-title">{listing.title}</h3>
            <p className="bl-info-donor">by {listing.donorName}</p>

            {/* Address */}
            {listing.address && (
                <div className="bl-info-address"><PinIcon /><span>{listing.address}</span></div>
            )}

            {/* Description */}
            {listing.description && (
                <p className="bl-info-desc">{listing.description}</p>
            )}

            {/* Action */}
            <Link to={`/listing/${listing.id}`} className="bl-info-details-link">View Details</Link>
            {isClaimed
                ? <div className="bl-info-claimed">✓ Already Claimed</div>
                : (
                    <button className="bl-info-claim-btn" onClick={onClaim} disabled={isClaiming}>
                        {isClaiming
                            ? <><SpinnerIcon /> Claiming…</>
                            : <><span>Claim Food</span><ChevronRight /></>
                        }
                    </button>
                )
            }
        </div>
    );
};

// ─── Map View ──────────────────────────────────────────────────────────────────

const MapView: React.FC<{
    listings: EnhancedListing[];
    userLat: number | null;
    userLng: number | null;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}> = ({ listings, userLat, userLng, selectedId, onSelect }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
    const userMarkerRef = useRef<google.maps.Marker | null>(null);
    const [mapReady, setMapReady] = useState(false);

    // Init map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        let cancelled = false;

        importLibrary('maps').then(lib => {
            if (cancelled || !containerRef.current) return;
            const { Map } = lib as google.maps.MapsLibrary;

            const center = userLat && userLng
                ? { lat: userLat, lng: userLng }
                : { lat: 31.5204, lng: 74.3587 };

            mapRef.current = new Map(containerRef.current, {
                center,
                zoom: 13,
                styles: DARK_STYLES,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                clickableIcons: false,
            });

            // Dim click closes panel
            mapRef.current.addListener('click', () => onSelect(null));

            // User location: blue pulse marker
            if (userLat && userLng) {
                userMarkerRef.current = new google.maps.Marker({
                    map: mapRef.current,
                    position: { lat: userLat, lng: userLng },
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#60a5fa',
                        fillOpacity: 1,
                        strokeColor: '#1d4ed8',
                        strokeWeight: 3,
                        scale: 9,
                    },
                    title: 'Your location',
                    zIndex: 100,
                });
            }

            setMapReady(true);
        }).catch(console.error);

        return () => {
            cancelled = true;
            markersRef.current.forEach(m => m.setMap(null));
            markersRef.current.clear();
            userMarkerRef.current?.setMap(null);
            userMarkerRef.current = null;
            mapRef.current = null;
            setMapReady(false);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync markers when listings change
    useEffect(() => {
        if (!mapReady || !mapRef.current) return;

        // Remove stale markers
        const currentIds = new Set(listings.map(l => l.id));
        markersRef.current.forEach((m, id) => {
            if (!currentIds.has(id)) { m.setMap(null); markersRef.current.delete(id); }
        });

        listings.forEach(listing => {
            if (listing.lat == null || listing.lng == null) return;
            if (markersRef.current.has(listing.id)) return; // already exists

            const marker = new google.maps.Marker({
                map: mapRef.current!,
                position: { lat: listing.lat, lng: listing.lng },
                title: listing.title,
                cursor: 'pointer',
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#7DFF12',
                    fillOpacity: 0.9,
                    strokeColor: '#0b0b0b',
                    strokeWeight: 2,
                    scale: 8,
                },
            });

            marker.addListener('click', () => {
                onSelect(listing.id);
                mapRef.current?.panTo({ lat: listing.lat!, lng: listing.lng! });
            });

            markersRef.current.set(listing.id, marker);
        });
    }, [mapReady, listings, onSelect]);

    // Highlight selected marker
    useEffect(() => {
        markersRef.current.forEach((marker, id) => {
            const sel = id === selectedId;
            marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: sel ? '#ffffff' : '#7DFF12',
                fillOpacity: 1,
                strokeColor: sel ? '#7DFF12' : '#0b0b0b',
                strokeWeight: sel ? 3.5 : 2,
                scale: sel ? 13 : 8,
            });
            marker.setZIndex(sel ? 200 : 1);
        });
    }, [selectedId]);

    return <div ref={containerRef} className="bl-map" />;
};

// ─── Main Component ────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'map';
type FilterMode = 'nearby' | 'all';
type SortOption = 'distance' | 'expiry' | 'newest';

const BrowseListings: React.FC = () => {
    const { user } = useAuth();

    const [view, setView] = useState<ViewMode>('list');
    const [filterMode, setFilterMode] = useState<FilterMode>('nearby');
    const [sort, setSort] = useState<SortOption>('distance');
    const [query, setQuery] = useState('');

    const [listings, setListings] = useState<EnhancedListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);
    const [locationLoaded, setLocationLoaded] = useState(false);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
    const [confirmListing, setConfirmListing] = useState<EnhancedListing | null>(null);

    // ── Load recipient location ──────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;
        profileService.getRecipientProfile(user.id).then(r => {
            if (r.success && r.data?.latitude && r.data?.longitude) {
                setUserLat(r.data.latitude);
                setUserLng(r.data.longitude);
            } else {
                // No saved location → default to "all" mode
                setFilterMode('all');
                setSort('newest');
            }
            setLocationLoaded(true);
        });
    }, [user?.id]);

    // ── Load listings ────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const radius = filterMode === 'nearby' ? NEARBY_RADIUS_M : null;
        const result = await listingService.getListingsWithDistance(userLat, userLng, radius, 60);
        if (result.success && result.data) {
            setListings(result.data);
            setClaimedIds(new Set());
        } else {
            setError('Failed to load listings. Please try again.');
        }
        setLoading(false);
    }, [filterMode, userLat, userLng]);

    useEffect(() => {
        if (!locationLoaded) return;
        load();
    }, [load, locationLoaded]);

    // ── Filter + sort ────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let result = listings.filter(l => !claimedIds.has(l.id));
        if (query.trim()) {
            const q = query.toLowerCase();
            result = result.filter(l =>
                l.title.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
            );
        }
        if (sort === 'distance') {
            result = [...result].sort((a, b) => (a.distanceM ?? 9e9) - (b.distanceM ?? 9e9));
        } else if (sort === 'expiry') {
            result = [...result].sort((a, b) => new Date(a.expiryTime).getTime() - new Date(b.expiryTime).getTime());
        } else {
            result = [...result].sort((a, b) => new Date(b.expiryTime).getTime() - new Date(a.expiryTime).getTime());
        }
        return result;
    }, [listings, claimedIds, query, sort]);

    const selectedListing = useMemo(
        () => filtered.find(l => l.id === selectedId) ?? null,
        [filtered, selectedId]
    );

    // ── Claim ────────────────────────────────────────────────────────────────
    const handleClaim = useCallback(async (listing: EnhancedListing) => {
        if (!user?.id || claimingId) return;
        setConfirmListing(null);
        setClaimingId(listing.id);
        try {
            const res = await listingService.claimListing(listing.id, user.id);
            if (res.success) {
                setClaimedIds(prev => new Set([...prev, listing.id]));
                setSelectedId(null);
            } else {
                setError(res.error ?? 'Failed to claim listing');
            }
        } catch {
            setError('An error occurred while claiming.');
        } finally {
            setClaimingId(null);
        }
    }, [user?.id, claimingId]);

    // ── Render ────────────────────────────────────────────────────────────────
    const hasLocation = userLat != null && userLng != null;

    return (
        <div className="bl-page">

            {/* ── Header ──────────────────────────────────────────── */}
            <div className="bl-header">
                <div className="bl-header-left">
                    <h1 className="bl-title">Browse Food</h1>
                    <span className="bl-count">
                        {loading ? '…' : `${filtered.length} available`}
                    </span>
                </div>

                {/* View toggle */}
                <div className="bl-view-toggle">
                    <button
                        className={`bl-view-btn${view === 'list' ? ' is-active' : ''}`}
                        onClick={() => setView('list')}
                        title="List view"
                    >
                        <ListIcon /> List
                    </button>
                    <button
                        className={`bl-view-btn${view === 'map' ? ' is-active' : ''}`}
                        onClick={() => setView('map')}
                        title="Map view"
                    >
                        <MapIcon /> Map
                    </button>
                </div>
            </div>

            {/* ── Controls ──────────────────────────────────────────── */}
            <div className="bl-controls">
                {/* Mode filter */}
                <div className="bl-filter-row">
                    <button
                        className={`bl-filter-btn${filterMode === 'nearby' ? ' is-active' : ''}`}
                        onClick={() => setFilterMode('nearby')}
                        disabled={!hasLocation}
                        title={hasLocation ? 'Within 10 km of you' : 'Set your location in Profile to enable nearby'}
                    >
                        Nearby (10 km)
                    </button>
                    <button
                        className={`bl-filter-btn${filterMode === 'all' ? ' is-active' : ''}`}
                        onClick={() => setFilterMode('all')}
                    >
                        All Available
                    </button>
                </div>

                {/* Search + sort row */}
                <div className="bl-search-sort">
                    <div className="bl-search">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="Search food or location…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            aria-label="Search listings"
                        />
                    </div>
                    <select
                        className="bl-sort-select"
                        value={sort}
                        onChange={e => setSort(e.target.value as SortOption)}
                        aria-label="Sort listings"
                    >
                        <option value="distance" disabled={!hasLocation}>Closest first</option>
                        <option value="expiry">Expiring soon</option>
                        <option value="newest">Newest first</option>
                    </select>
                </div>
            </div>

            {/* ── Error Banner ──────────────────────────────────────── */}
            {error && (
                <div className="bl-error">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss">✕</button>
                </div>
            )}

            {/* ── Content ───────────────────────────────────────────── */}
            {view === 'list' ? (
                /* List View */
                <div className="bl-list-content">
                    {loading ? (
                        <div className="bl-grid">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="bl-skeleton" style={{ animationDelay: `${i * 60}ms` }}>
                                    <div className="bl-skeleton-img" />
                                    <div className="bl-skeleton-body">
                                        <div className="bl-skeleton-line" />
                                        <div className="bl-skeleton-line bl-skeleton-line--short" />
                                        <div className="bl-skeleton-btn" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="bl-empty">
                            <div className="bl-empty-icon"><FoodIcon /></div>
                            {filterMode === 'nearby' && !hasLocation ? (
                                <>
                                    <p className="bl-empty-title">Location not set</p>
                                    <p className="bl-empty-sub">Go to your Profile and set your address to see nearby listings</p>
                                </>
                            ) : filterMode === 'nearby' ? (
                                <>
                                    <p className="bl-empty-title">Nothing nearby right now</p>
                                    <p className="bl-empty-sub">No food within 10 km — try All Available to see everything</p>
                                    <button className="bl-empty-btn" onClick={() => setFilterMode('all')}>
                                        Show All Available
                                    </button>
                                </>
                            ) : query.trim() ? (
                                <>
                                    <p className="bl-empty-title">No results for "{query}"</p>
                                    <button className="bl-empty-btn" onClick={() => setQuery('')}>Clear search</button>
                                </>
                            ) : (
                                <>
                                    <p className="bl-empty-title">No food available right now</p>
                                    <p className="bl-empty-sub">Check back soon — donors post new items regularly</p>
                                    <button className="bl-empty-btn" onClick={load}>Refresh</button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="bl-grid">
                            {filtered.map((l, i) => (
                                <ListingCard
                                    key={l.id}
                                    listing={l}
                                    index={i}
                                    isClaiming={claimingId === l.id}
                                    isClaimed={claimedIds.has(l.id)}
                                    onRequestClaim={() => setConfirmListing(l)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* Map View */
                <div className="bl-map-content">
                    {loading && (
                        <div className="bl-map-loading">
                            <SpinnerIcon /> Loading listings…
                        </div>
                    )}
                    <MapView
                        listings={filtered}
                        userLat={userLat}
                        userLng={userLng}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />

                    {/* Info panel — slides up when a marker is selected */}
                    <div className={`bl-info-overlay${selectedId ? ' is-open' : ''}`}>
                        <MapInfoPanel
                            listing={selectedListing}
                            isClaiming={claimingId === selectedId}
                            isClaimed={selectedId ? claimedIds.has(selectedId) : false}
                            onClaim={() => selectedListing && setConfirmListing(selectedListing)}
                            onClose={() => setSelectedId(null)}
                        />
                    </div>

                    {/* Empty overlay for map */}
                    {!loading && filtered.filter(l => l.lat != null).length === 0 && (
                        <div className="bl-map-empty">
                            <FoodIcon />
                            <p>No listings with location data</p>
                            {filterMode === 'nearby' && (
                                <button onClick={() => setFilterMode('all')}>Show All Available</button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Confirm Modal ──────────────────────────────────────── */}
            {confirmListing && (
                <ConfirmModal
                    listing={confirmListing}
                    isConfirming={claimingId === confirmListing.id}
                    onConfirm={() => handleClaim(confirmListing)}
                    onCancel={() => setConfirmListing(null)}
                />
            )}
        </div>
    );
};

export default BrowseListings;
