import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { listingService } from '@services/listingService';
import type { DonorListing } from '@services/listingService';
import { ROUTES } from '@utils/constants';
import './MyListings.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'available' | 'claimed' | 'expired';

const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const getExpiryInfo = (iso: string): { text: string; cls: string } => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return { text: 'Expired', cls: 'ml-card-expiry--red' };
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 2) return { text: `${Math.max(0, Math.floor(diff / 60000))}m left`, cls: 'ml-card-expiry--red' };
    if (hrs < 24) return { text: `${hrs}h left`, cls: 'ml-card-expiry--orange' };
    return { text: `${Math.floor(hrs / 24)}d left`, cls: 'ml-card-expiry--green' };
};

const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
        <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
    </svg>
);

const EditIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
        <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const FoodPlaceholderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28" className="ml-card-thumb-placeholder">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" strokeLinecap="round" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" strokeLinecap="round" />
        <line x1="10" y1="1" x2="10" y2="4" strokeLinecap="round" />
        <line x1="14" y1="1" x2="14" y2="4" strokeLinecap="round" />
    </svg>
);

const EmptyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="64" height="64" className="ml-empty-icon">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);

// ─── Status Pill ──────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: 'available' | 'claimed' | 'expired' }> = ({ status }) => {
    const map = {
        available: { label: 'Active', cls: 'ml-pill--active' },
        claimed:   { label: 'Claimed', cls: 'ml-pill--claimed' },
        expired:   { label: 'Expired', cls: 'ml-pill--expired' },
    };
    const { label, cls } = map[status];
    return <span className={`ml-pill ${cls}`}><span className="ml-pill-dot" />{label}</span>;
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
    listing: DonorListing;
    onClose: () => void;
    onSaved: () => void;
}

const EditListingModal: React.FC<EditModalProps> = ({ listing, onClose, onSaved }) => {
    const { user } = useAuth();
    const [editTitle, setEditTitle] = useState(listing.title);
    const [editQty, setEditQty] = useState(String(listing.quantity));
    const [editUnit, setEditUnit] = useState(listing.quantityUnit);
    const [editExpiry, setEditExpiry] = useState(toLocalDatetime(listing.expiryTime));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setError('');
        const result = await listingService.updateListing(listing.id, user.id, {
            title: editTitle,
            quantity: Number(editQty),
            quantityUnit: editUnit,
            expiryTime: new Date(editExpiry).toISOString(),
        });
        setSaving(false);
        if (result.success) {
            onSaved();
            onClose();
        } else {
            setError(result.error ?? 'Failed to update listing');
        }
    };

    return (
        <div className="ml-modal-overlay" onClick={onClose}>
            <div className="ml-modal" onClick={e => e.stopPropagation()}>
                <div className="ml-modal-header">
                    <h2>Edit Listing</h2>
                    <button className="ml-modal-close" onClick={onClose} aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                            <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
                <div className="ml-modal-body">
                    <div className="ml-field">
                        <label>Title</label>
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                    </div>
                    <div className="ml-field-row">
                        <div className="ml-field">
                            <label>Quantity</label>
                            <input type="number" min="1" value={editQty} onChange={e => setEditQty(e.target.value)} />
                        </div>
                        <div className="ml-field">
                            <label>Unit</label>
                            <input value={editUnit} onChange={e => setEditUnit(e.target.value)} />
                        </div>
                    </div>
                    <div className="ml-field">
                        <label>Expiry</label>
                        <input type="datetime-local" value={editExpiry} onChange={e => setEditExpiry(e.target.value)} />
                    </div>
                    {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
                </div>
                <div className="ml-modal-footer">
                    <button className="ml-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="ml-btn-primary" onClick={handleSave} disabled={saving || !editTitle.trim()}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteModalProps {
    listingId: string;
    onClose: () => void;
    onDeleted: () => void;
}

const DeleteConfirmModal: React.FC<DeleteModalProps> = ({ listingId, onClose, onDeleted }) => {
    const { user } = useAuth();
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!user) return;
        setDeleting(true);
        const result = await listingService.deleteListing(listingId, user.id);
        setDeleting(false);
        if (result.success) {
            onDeleted();
            onClose();
        }
    };

    return (
        <div className="ml-modal-overlay" onClick={onClose}>
            <div className="ml-modal" onClick={e => e.stopPropagation()}>
                <div className="ml-modal-header">
                    <h2>Delete Listing</h2>
                    <button className="ml-modal-close" onClick={onClose} aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                            <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
                <div className="ml-modal-body">
                    <p className="ml-confirm-text">
                        Delete this listing? It will be marked as expired and removed from available food.
                    </p>
                </div>
                <div className="ml-modal-footer">
                    <button className="ml-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="ml-btn-danger" onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const FILTER_LABELS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'available', label: 'Active' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'expired', label: 'Expired' },
];

const MyListings: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [listings, setListings] = useState<DonorListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [editListing, setEditListing] = useState<DonorListing | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const loadListings = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const result = await listingService.getMyListings(
            user.id,
            filter === 'all' ? undefined : filter as 'available' | 'claimed' | 'expired'
        );
        if (result.success && result.data) setListings(result.data);
        setLoading(false);
    }, [user, filter]);

    useEffect(() => { loadListings(); }, [loadListings]);

    return (
        <div className="ml-page">
            {/* Header */}
            <div className="ml-header">
                <div className="ml-header-left">
                    <h1>My Listings</h1>
                    <p>{loading ? '...' : `${listings.length} listing${listings.length !== 1 ? 's' : ''}`}</p>
                </div>
                <Link to={ROUTES.CREATE_LISTING} className="ml-post-btn">
                    <PlusIcon /> Post Food
                </Link>
            </div>

            {/* Filter Tabs */}
            <div className="ml-tabs">
                {FILTER_LABELS.map(({ key, label }) => (
                    <button
                        key={key}
                        className={`ml-tab ${filter === key ? 'ml-tab--active' : ''}`}
                        onClick={() => setFilter(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="ml-grid">
                {loading ? (
                    <>
                        {[0, 1, 2].map(i => (
                            <div key={i} className="ml-skeleton" style={{ animationDelay: `${i * 100}ms` }} />
                        ))}
                    </>
                ) : listings.length === 0 ? (
                    <div className="ml-empty">
                        <EmptyIcon />
                        <p className="ml-empty-title">No listings yet</p>
                        <p className="ml-empty-sub">Post your first food to share with the community</p>
                        <button className="ml-empty-btn" onClick={() => navigate(ROUTES.CREATE_LISTING)}>
                            <PlusIcon /> Post your first food
                        </button>
                    </div>
                ) : (
                    listings.map((listing, i) => {
                        const expiry = getExpiryInfo(listing.expiryTime);
                        const canEdit = listing.status === 'available';
                        return (
                            <div key={listing.id} className="ml-card" style={{ animationDelay: `${i * 50}ms` }}>
                                <div className="ml-card-thumb">
                                    {listing.imageUrl ? (
                                        <img src={listing.imageUrl} alt={listing.title} />
                                    ) : (
                                        <FoodPlaceholderIcon />
                                    )}
                                </div>
                                <div className="ml-card-body">
                                    <div className="ml-card-top">
                                        <h3 className="ml-card-title">{listing.title}</h3>
                                        <StatusPill status={listing.status} />
                                    </div>
                                    <span className="ml-card-qty">{listing.quantity} {listing.quantityUnit}</span>
                                    <div className="ml-card-meta">
                                        <span className={`ml-card-expiry ${expiry.cls}`}>{expiry.text}</span>
                                        <span className="ml-card-time">{formatTimeAgo(listing.createdAt)}</span>
                                    </div>
                                    {canEdit && (
                                        <div className="ml-actions">
                                            <button
                                                className="ml-action-btn"
                                                onClick={() => setEditListing(listing)}
                                                aria-label="Edit listing"
                                            >
                                                <EditIcon />
                                            </button>
                                            <button
                                                className="ml-action-btn ml-action-btn--delete"
                                                onClick={() => setDeleteId(listing.id)}
                                                aria-label="Delete listing"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modals */}
            {editListing && (
                <EditListingModal
                    listing={editListing}
                    onClose={() => setEditListing(null)}
                    onSaved={loadListings}
                />
            )}
            {deleteId && (
                <DeleteConfirmModal
                    listingId={deleteId}
                    onClose={() => setDeleteId(null)}
                    onDeleted={loadListings}
                />
            )}
        </div>
    );
};

export default MyListings;
