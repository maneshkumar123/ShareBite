import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { listingService } from '@services/listingService';
import { imageService } from '@services/imageService';
import { profileService } from '@services/profileService';
import MapPicker from '@components/common/MapPicker';
import { importLibrary } from '@/lib/googleMaps';
import './CreateListing.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

const UNITS = ['servings', 'kg', 'portions', 'items', 'boxes', 'bags'] as const;
type Unit = (typeof UNITS)[number];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const DEFAULT_LAT = 31.5204;
const DEFAULT_LNG = 74.3587;

// ─── Icons ────────────────────────────────────────────────────────────────────

const ArrowLeft = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 12L6 8l4-4" />
    </svg>
);

const ArrowRight = () => (
    <svg className="cl-btn-arrow" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4l4 4-4 4" />
    </svg>
);

const CheckMini = () => (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3L5 9l-3-3" />
    </svg>
);

const UploadIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const ImageIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
    </svg>
);

const ClockIcon = () => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5V8l2.5 1.5" />
    </svg>
);

const PinIcon = () => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 14s-5-4.686-5-8a5 5 0 0 1 10 0c0 3.314-5 8-5 8z" />
        <circle cx="8" cy="6" r="1.5" />
    </svg>
);

const AlertIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5v3.5" />
        <circle cx="8" cy="11" r="0.5" fill="currentColor" />
    </svg>
);

const LocateIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="1" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="1" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="23" y2="12" />
    </svg>
);

const SpinnerIcon = () => (
    <svg className="cl-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 2a10 10 0 1 1-7.07 2.93" />
    </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

const CreateListing: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);

    // Step 1
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState<Unit>('servings');

    // Step 2
    const [expiryTime, setExpiryTime] = useState('');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState(DEFAULT_LAT);
    const [lng, setLng] = useState(DEFAULT_LNG);
    const [locating, setLocating] = useState(false);

    // Step 3
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const reverseGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Autocomplete refs
    const addressInputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    // ── Sync value into the address input (reverse geocode + profile pre-fill) ──
    const setAddressInput = (addr: string) => {
        if (addressInputRef.current) addressInputRef.current.value = addr;
    };

    // ── Pre-fill from donor profile ───────────────────────────────────────────

    useEffect(() => {
        if (!user?.id) return;
        profileService.getDonorProfile(user.id).then(r => {
            if (r.success && r.data) {
                if (r.data.address) {
                    setAddress(r.data.address);
                    setAddressInput(r.data.address);
                }
                if (r.data.latitude) setLat(r.data.latitude);
                if (r.data.longitude) setLng(r.data.longitude);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // ── Autocomplete — init when step 2 input is mounted ─────────────────────

    useEffect(() => {
        if (step !== 2 || !addressInputRef.current || autocompleteRef.current) return;

        let destroyed = false;

        importLibrary('places').then((lib) => {
            if (destroyed || !addressInputRef.current) return;

            const { Autocomplete } = lib as google.maps.PlacesLibrary;

            const ac = new Autocomplete(addressInputRef.current, {
                // No types → returns everything: addresses, businesses,
                // universities, restaurants, landmarks, etc.
                fields: ['name', 'formatted_address', 'geometry'],
            });

            autocompleteRef.current = ac;

            ac.addListener('place_changed', () => {
                const place = ac.getPlace();
                if (!place.geometry?.location) return;

                const name = place.name ?? '';
                const fmtAddr = place.formatted_address ?? '';
                // For establishments: prepend the building name if it
                // isn't already the start of the formatted address.
                const addr = name && !fmtAddr.startsWith(name)
                    ? `${name}, ${fmtAddr}`
                    : fmtAddr;

                setLat(place.geometry.location.lat());
                setLng(place.geometry.location.lng());
                setAddress(addr);
                if (addressInputRef.current) addressInputRef.current.value = addr;
            });
        }).catch(console.error);

        return () => {
            destroyed = true;
            if (autocompleteRef.current) {
                google.maps.event.clearInstanceListeners(autocompleteRef.current);
                autocompleteRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    // ── Reverse geocode via Google Geocoding REST API (map drag → address) ────

    const reverseGeocode = useCallback((newLat: number, newLng: number) => {
        if (reverseGeocodeTimer.current) clearTimeout(reverseGeocodeTimer.current);

        reverseGeocodeTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${newLat},${newLng}&key=${GOOGLE_MAPS_KEY}`
                );
                const data = await res.json() as {
                    status: string;
                    results: Array<{ formatted_address: string }>;
                };
                if (data.status === 'OK' && data.results[0]) {
                    const addr = data.results[0].formatted_address;
                    setAddress(addr);
                    if (addressInputRef.current) addressInputRef.current.value = addr;
                }
            } catch {
                // non-critical — address field keeps its last value
            }
        }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMapLocationChange = (newLat: number, newLng: number) => {
        setLat(newLat);
        setLng(newLng);
        reverseGeocode(newLat, newLng);
    };

    // ── Use device GPS location ───────────────────────────────────────────────

    const handleCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by this browser.');
            return;
        }
        setLocating(true);
        setError('');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const newLat = pos.coords.latitude;
                const newLng = pos.coords.longitude;
                setLat(newLat);
                setLng(newLng);
                reverseGeocode(newLat, newLng);
                setLocating(false);
            },
            () => {
                setError('Location access denied. Allow location in your browser settings.');
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // ── Image ─────────────────────────────────────────────────────────────────

    const processFile = (file: File) => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError('Please select a JPEG, PNG, or WebP image.');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setError('Image must be under 5 MB.');
            return;
        }
        setError('');
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const removeImage = () => {
        setImageFile(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Validation ────────────────────────────────────────────────────────────

    const isStep1Valid = title.trim().length > 0 && Number(quantity) >= 1;
    const isStep2Valid = expiryTime !== '' && new Date(expiryTime) > new Date() && address.trim().length > 0;

    // ── Navigation ────────────────────────────────────────────────────────────

    const goNext = () => { setError(''); setStep(s => Math.min(s + 1, 3)); };
    const goBack = () => { setError(''); setStep(s => Math.max(s - 1, 1)); };

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!user?.id) return;
        setSubmitting(true);
        setError('');

        try {
            let imageUrl: string | undefined;
            if (imageFile) {
                const imgResult = await imageService.uploadListingImage(user.id, imageFile);
                if (imgResult.success) imageUrl = imgResult.data ?? undefined;
            }

            const result = await listingService.createListing(user.id, {
                title: title.trim(),
                description: description.trim(),
                quantity: Number(quantity),
                quantityUnit: unit,
                expiryTime: new Date(expiryTime).toISOString(),
                address: address.trim(),
                latitude: lat,
                longitude: lng,
                imageUrl,
            });

            if (result.success) {
                navigate('/donor/listings');
            } else {
                setError(result.error ?? 'Failed to create listing');
            }
        } catch {
            setError('An unexpected error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    const fmtSize = (b: number) =>
        b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

    const fmtExpiry = (iso: string) => {
        if (!iso) return null;
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    };

    // ── Step config ───────────────────────────────────────────────────────────

    const STEPS = [
        { num: 1, label: 'Food Details' },
        { num: 2, label: 'Time & Location' },
        { num: 3, label: 'Photo & Review' },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="cl-page">

            {/* Top Bar */}
            <div className="cl-topbar">
                <div className="cl-topbar-left">
                    <button className="cl-back-btn" onClick={() => navigate(-1)}>
                        <ArrowLeft /> Back
                    </button>
                    <span className="cl-topbar-title">New Food Listing</span>
                </div>
                <span className="cl-topbar-badge">Step {step} of 3</span>
            </div>

            {/* Progress Rail */}
            <div className="cl-rail">
                <div className="cl-rail-track">
                    {STEPS.map(s => (
                        <div
                            key={s.num}
                            className={`cl-rail-segment${step === s.num ? ' is-active' : ''}${step > s.num ? ' is-done' : ''}`}
                        >
                            <div className="cl-rail-node">
                                <div className="cl-rail-dot">
                                    <span className="cl-rail-dot-num">{s.num}</span>
                                    <span className="cl-rail-dot-check"><CheckMini /></span>
                                </div>
                                <span className="cl-rail-label">{s.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Body */}
            <div className="cl-body">

                {/* ── Form Panel ──────────────────────────────────────── */}
                <div className="cl-form-panel">

                    {error && (
                        <div className="cl-error-banner">
                            <AlertIcon />
                            {error}
                        </div>
                    )}

                    {/* ── Step 1: Food Details ─────────────────────────── */}
                    {step === 1 && (
                        <div key="step1" className="cl-step-panel">
                            <div className="cl-section-head">
                                <div className="cl-section-num">Step 01 / Food Details</div>
                                <h1 className="cl-section-title">What are you sharing?</h1>
                                <p className="cl-section-sub">Describe the food so recipients know what to expect.</p>
                            </div>

                            <div className="cl-field">
                                <div className="cl-label">
                                    <span className="cl-label-text">Title <span className="cl-label-req">*</span></span>
                                    <span className="cl-label-hint">{title.length}/100</span>
                                </div>
                                <input
                                    className="cl-input"
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value.slice(0, 100))}
                                    placeholder="e.g. Fresh sandwiches from today's event"
                                    autoFocus
                                />
                            </div>

                            <div className="cl-field">
                                <div className="cl-label">
                                    <span className="cl-label-text">Description</span>
                                    <span className="cl-label-hint">{description.length}/500</span>
                                </div>
                                <textarea
                                    className="cl-textarea"
                                    value={description}
                                    onChange={e => setDescription(e.target.value.slice(0, 500))}
                                    placeholder="Dietary info, allergens, packaging details..."
                                    rows={3}
                                />
                            </div>

                            <div className="cl-row">
                                <div className="cl-field">
                                    <div className="cl-label">
                                        <span className="cl-label-text">Quantity <span className="cl-label-req">*</span></span>
                                    </div>
                                    <input
                                        className="cl-input"
                                        type="number"
                                        min={1}
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        placeholder="e.g. 12"
                                    />
                                </div>
                                <div className="cl-field">
                                    <div className="cl-label">
                                        <span className="cl-label-text">Unit</span>
                                    </div>
                                    <select
                                        className="cl-select"
                                        value={unit}
                                        onChange={e => setUnit(e.target.value as Unit)}
                                    >
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="cl-actions">
                                <button
                                    className="cl-btn-primary"
                                    disabled={!isStep1Valid}
                                    onClick={goNext}
                                >
                                    Continue <ArrowRight />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Time & Location ──────────────────────── */}
                    {step === 2 && (
                        <div key="step2" className="cl-step-panel">
                            <div className="cl-section-head">
                                <div className="cl-section-num">Step 02 / Time & Location</div>
                                <h1 className="cl-section-title">When and where?</h1>
                                <p className="cl-section-sub">Set the pickup window and pin the exact location.</p>
                            </div>

                            <div className="cl-field">
                                <div className="cl-label">
                                    <span className="cl-label-text">Expiry Date & Time <span className="cl-label-req">*</span></span>
                                </div>
                                <input
                                    className="cl-input"
                                    type="datetime-local"
                                    value={expiryTime}
                                    onChange={e => setExpiryTime(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>

                            <div className="cl-field">
                                <div className="cl-label">
                                    <span className="cl-label-text">Pickup Address <span className="cl-label-req">*</span></span>
                                </div>
                                {/* Address row: search input + GPS button */}
                                <div className="cl-address-row">
                                    <input
                                        ref={addressInputRef}
                                        type="text"
                                        className="cl-input cl-address-input"
                                        placeholder="Search for a place, building, or address…"
                                        defaultValue={address}
                                        onChange={e => setAddress(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className={`cl-locate-btn${locating ? ' is-locating' : ''}`}
                                        onClick={handleCurrentLocation}
                                        disabled={locating}
                                        title="Use current location"
                                    >
                                        {locating ? <SpinnerIcon /> : <LocateIcon />}
                                    </button>
                                </div>
                            </div>

                            <div className="cl-map-shell">
                                <MapPicker
                                    latitude={lat}
                                    longitude={lng}
                                    onLocationChange={handleMapLocationChange}
                                />
                            </div>

                            <div className="cl-actions">
                                <button className="cl-btn-ghost" onClick={goBack}>
                                    <ArrowLeft /> Back
                                </button>
                                <button
                                    className="cl-btn-primary"
                                    disabled={!isStep2Valid}
                                    onClick={goNext}
                                >
                                    Continue <ArrowRight />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Photo & Review ───────────────────────── */}
                    {step === 3 && (
                        <div key="step3" className="cl-step-panel">
                            <div className="cl-section-head">
                                <div className="cl-section-num">Step 03 / Photo & Review</div>
                                <h1 className="cl-section-title">Add a photo, then post.</h1>
                                <p className="cl-section-sub">A photo helps recipients identify the food — optional but recommended.</p>
                            </div>

                            {/* Upload */}
                            {!imageFile ? (
                                <div
                                    className={`cl-upload${isDragging ? ' is-dragging' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                >
                                    <div className="cl-upload-icon-wrap"><UploadIcon /></div>
                                    <p className="cl-upload-primary">Drop image or <em>browse files</em></p>
                                    <p className="cl-upload-sub">JPEG · PNG · WebP · max 5 MB</p>
                                </div>
                            ) : (
                                <div className="cl-img-preview">
                                    {imagePreview && <img src={imagePreview} alt="Preview" className="cl-img-thumb" />}
                                    <div className="cl-img-meta">
                                        <p className="cl-img-name">{imageFile.name}</p>
                                        <p className="cl-img-size">{fmtSize(imageFile.size)}</p>
                                    </div>
                                    <button className="cl-img-remove" onClick={removeImage}>Remove</button>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleFileSelect}
                                hidden
                            />

                            {/* Review Summary */}
                            <div className="cl-review">
                                <p className="cl-review-head">Review listing details</p>
                                <div className="cl-review-grid">
                                    <div className="cl-review-cell">
                                        <p className="cl-review-cell-key">Title</p>
                                        <p className="cl-review-cell-val">{title || '—'}</p>
                                    </div>
                                    <div className="cl-review-cell">
                                        <p className="cl-review-cell-key">Quantity</p>
                                        <p className="cl-review-cell-val">{quantity ? `${quantity} ${unit}` : '—'}</p>
                                    </div>
                                    <div className="cl-review-cell">
                                        <p className="cl-review-cell-key">Expires</p>
                                        <p className="cl-review-cell-val">{fmtExpiry(expiryTime) ?? '—'}</p>
                                    </div>
                                    <div className="cl-review-cell">
                                        <p className="cl-review-cell-key">Location</p>
                                        <p className="cl-review-cell-val">{address || '—'}</p>
                                    </div>
                                    {description && (
                                        <div className="cl-review-cell span-2">
                                            <p className="cl-review-cell-key">Description</p>
                                            <p className="cl-review-cell-val">{description}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="cl-actions">
                                <button className="cl-btn-ghost" onClick={goBack}>
                                    <ArrowLeft /> Back
                                </button>
                                <button
                                    className="cl-btn-primary"
                                    disabled={submitting}
                                    onClick={handleSubmit}
                                >
                                    {submitting ? 'Posting...' : 'Post Listing'}
                                    {!submitting && <ArrowRight />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Live Preview Sidebar (desktop only) ─────────────── */}
                <aside className="cl-preview-sidebar">
                    <p className="cl-preview-label">Live Preview</p>
                    <div className={`cl-preview-card${(title || imagePreview) ? ' has-data' : ''}`}>
                        <div className="cl-preview-img-zone">
                            {imagePreview
                                ? <img src={imagePreview} alt="Preview" />
                                : (
                                    <div className="cl-preview-img-empty">
                                        <ImageIcon />
                                        <span>No photo yet</span>
                                    </div>
                                )}
                        </div>
                        <div className="cl-preview-body">
                            <div className="cl-preview-tag-row">
                                <span className="cl-preview-tag">Available</span>
                                {quantity && (
                                    <span className="cl-preview-qty-tag">{quantity} {unit}</span>
                                )}
                            </div>
                            <p className={`cl-preview-title${!title ? ' is-empty' : ''}`}>
                                {title || 'Listing title appears here'}
                            </p>
                            <p className="cl-preview-desc">
                                {description || ''}
                            </p>
                            <div className="cl-preview-divider" />
                            <div className="cl-preview-meta">
                                <div className="cl-preview-meta-row">
                                    <ClockIcon />
                                    <span className={`cl-preview-meta-text${!expiryTime ? ' is-empty' : ''}`}>
                                        {expiryTime ? `Expires ${fmtExpiry(expiryTime)}` : 'Expiry time not set'}
                                    </span>
                                </div>
                                <div className="cl-preview-meta-row">
                                    <PinIcon />
                                    <span className={`cl-preview-meta-text${!address ? ' is-empty' : ''}`}>
                                        {address || 'No address yet'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

            </div>
        </div>
    );
};

export default CreateListing;
