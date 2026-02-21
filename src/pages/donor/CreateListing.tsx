import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { listingService } from '@services/listingService';
import { imageService } from '@services/imageService';
import { profileService } from '@services/profileService';
import MapPicker from '@components/common/MapPicker';
import './CreateListing.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const UNITS = ['servings', 'kg', 'portions', 'items', 'boxes', 'bags'] as const;
type Unit = (typeof UNITS)[number];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const DEFAULT_LAT = 31.5204;
const DEFAULT_LNG = 74.3587;

// ─── Icons ───────────────────────────────────────────────────────────────────

const UploadIcon = () => (
    <svg className="cl-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <path d="M13.5 4.5L6 12l-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ─── Component ───────────────────────────────────────────────────────────────

const CreateListing: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Wizard step
    const [step, setStep] = useState(1);

    // Step 1: Food Details
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState<Unit>('servings');

    // Step 2: Time & Location
    const [expiryTime, setExpiryTime] = useState('');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState(DEFAULT_LAT);
    const [lng, setLng] = useState(DEFAULT_LNG);

    // Step 3: Photo
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Submission
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Geocode debounce
    const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Pre-fill from donor profile ──────────────────────────────────────────

    useEffect(() => {
        if (!user?.id) return;
        profileService.getDonorProfile(user.id).then(r => {
            if (r.success && r.data) {
                if (r.data.address) setAddress(r.data.address);
                if (r.data.latitude) setLat(r.data.latitude);
                if (r.data.longitude) setLng(r.data.longitude);
            }
        });
    }, [user?.id]);

    // ── Geocode address ──────────────────────────────────────────────────────

    const geocodeAddress = useCallback((addr: string) => {
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
        if (!addr.trim() || !MAPBOX_TOKEN) return;

        geocodeTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addr)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
                );
                const json = await res.json();
                if (json.features?.[0]) {
                    const [newLng, newLat] = json.features[0].center as [number, number];
                    setLat(newLat);
                    setLng(newLng);
                }
            } catch {
                // Geocoding failure is non-critical
            }
        }, 600);
    }, []);

    const handleAddressChange = (value: string) => {
        setAddress(value);
        geocodeAddress(value);
    };

    // ── Image handling ───────────────────────────────────────────────────────

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
        const url = URL.createObjectURL(file);
        setImagePreview(url);
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

    // ── Validation ───────────────────────────────────────────────────────────

    const isStep1Valid = title.trim().length > 0 && Number(quantity) >= 1;
    const isStep2Valid = expiryTime !== '' && new Date(expiryTime) > new Date() && address.trim().length > 0;

    // ── Navigation ───────────────────────────────────────────────────────────

    const goNext = () => {
        setError('');
        setStep(s => Math.min(s + 1, 3));
    };

    const goBack = () => {
        setError('');
        setStep(s => Math.max(s - 1, 1));
    };

    // ── Submit ───────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!user?.id) return;
        setSubmitting(true);
        setError('');

        try {
            let imageUrl: string | undefined;

            if (imageFile) {
                const imgResult = await imageService.uploadListingImage(user.id, imageFile);
                if (imgResult.success) {
                    imageUrl = imgResult.data ?? undefined;
                }
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

    // ── Format helpers ───────────────────────────────────────────────────────

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatExpiryDisplay = (iso: string) => {
        if (!iso) return '---';
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    };

    // ── Step indicator ───────────────────────────────────────────────────────

    const steps = [
        { num: 1, label: 'Food Details' },
        { num: 2, label: 'Time & Location' },
        { num: 3, label: 'Photo & Review' },
    ];

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="cl-page">
            <div className="cl-header">
                <h1>Post Food</h1>
                <p>Share surplus food with your community</p>
            </div>

            {/* Step Indicator */}
            <div className="cl-steps">
                {steps.map((s, i) => (
                    <React.Fragment key={s.num}>
                        <div
                            className={`cl-step ${step === s.num ? 'cl-step--active' : ''} ${step > s.num ? 'cl-step--completed' : ''}`}
                        >
                            <div className="cl-step-circle">
                                {step > s.num ? <CheckIcon /> : s.num}
                            </div>
                            <span className="cl-step-label">{s.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`cl-step-line ${step > s.num ? 'cl-step-line--completed' : ''}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {error && <div className="cl-error">{error}</div>}

            {/* ── Step 1: Food Details ─────────────────────────── */}
            {step === 1 && (
                <div className="cl-card">
                    <div className="cl-form-group">
                        <label htmlFor="cl-title">Title *</label>
                        <input
                            id="cl-title"
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value.slice(0, 100))}
                            placeholder="e.g. Fresh sandwiches from today's event"
                        />
                        <div className="cl-char-count">{title.length}/100</div>
                    </div>

                    <div className="cl-form-group">
                        <label htmlFor="cl-desc">Description</label>
                        <textarea
                            id="cl-desc"
                            value={description}
                            onChange={e => setDescription(e.target.value.slice(0, 500))}
                            placeholder="Describe the food, dietary info, packaging..."
                            rows={3}
                        />
                        <div className="cl-char-count">{description.length}/500</div>
                    </div>

                    <div className="cl-form-row">
                        <div className="cl-form-group">
                            <label htmlFor="cl-qty">Quantity *</label>
                            <input
                                id="cl-qty"
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                placeholder="1"
                            />
                        </div>
                        <div className="cl-form-group">
                            <label htmlFor="cl-unit">Unit</label>
                            <select
                                id="cl-unit"
                                value={unit}
                                onChange={e => setUnit(e.target.value as Unit)}
                            >
                                {UNITS.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="cl-actions">
                        <button
                            className="cl-btn-next"
                            disabled={!isStep1Valid}
                            onClick={goNext}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Time & Location ─────────────────────── */}
            {step === 2 && (
                <div className="cl-card">
                    <div className="cl-form-group">
                        <label htmlFor="cl-expiry">Expiry Date & Time *</label>
                        <input
                            id="cl-expiry"
                            type="datetime-local"
                            value={expiryTime}
                            onChange={e => setExpiryTime(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                        />
                    </div>

                    <div className="cl-form-group">
                        <label htmlFor="cl-address">Pickup Address *</label>
                        <input
                            id="cl-address"
                            type="text"
                            value={address}
                            onChange={e => handleAddressChange(e.target.value)}
                            placeholder="Enter pickup address"
                        />
                    </div>

                    <div className="cl-map-wrap">
                        <MapPicker
                            latitude={lat}
                            longitude={lng}
                            onLocationChange={(newLat, newLng) => {
                                setLat(newLat);
                                setLng(newLng);
                            }}
                        />
                    </div>

                    <div className="cl-actions" style={{ marginTop: '1.25rem' }}>
                        <button className="cl-btn-back" onClick={goBack}>Back</button>
                        <button
                            className="cl-btn-next"
                            disabled={!isStep2Valid}
                            onClick={goNext}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 3: Photo & Review ──────────────────────── */}
            {step === 3 && (
                <div className="cl-card">
                    {/* Upload Zone */}
                    {!imageFile && (
                        <div
                            className={`cl-upload-zone ${isDragging ? 'cl-upload-zone--drag' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            <UploadIcon />
                            <p className="cl-upload-text">
                                Drag & drop or <span>browse</span>
                            </p>
                            <p className="cl-upload-hint">JPEG, PNG, or WebP up to 5 MB</p>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileSelect}
                        hidden
                    />

                    {/* Preview */}
                    {imageFile && imagePreview && (
                        <div className="cl-preview">
                            <img src={imagePreview} alt="Preview" className="cl-preview-img" />
                            <div className="cl-preview-info">
                                <p className="cl-preview-name">{imageFile.name}</p>
                                <p className="cl-preview-size">{formatFileSize(imageFile.size)}</p>
                            </div>
                            <button className="cl-preview-remove" onClick={removeImage}>Remove</button>
                        </div>
                    )}

                    {/* Review Summary */}
                    <h3 style={{ color: '#F7F7F7', fontSize: '0.95rem', margin: '1.5rem 0 1rem', fontWeight: 600 }}>
                        Review Your Listing
                    </h3>
                    <div className="cl-review-grid">
                        <div className="cl-review-item">
                            <p className="cl-review-item-label">Title</p>
                            <p className="cl-review-item-value">{title || '---'}</p>
                        </div>
                        <div className="cl-review-item">
                            <p className="cl-review-item-label">Quantity</p>
                            <p className="cl-review-item-value">{quantity ? `${quantity} ${unit}` : '---'}</p>
                        </div>
                        <div className="cl-review-item">
                            <p className="cl-review-item-label">Expires</p>
                            <p className="cl-review-item-value">{formatExpiryDisplay(expiryTime)}</p>
                        </div>
                        <div className="cl-review-item">
                            <p className="cl-review-item-label">Address</p>
                            <p className="cl-review-item-value">{address || '---'}</p>
                        </div>
                        {description && (
                            <div className="cl-review-item" style={{ gridColumn: '1 / -1' }}>
                                <p className="cl-review-item-label">Description</p>
                                <p className="cl-review-item-value">{description}</p>
                            </div>
                        )}
                    </div>

                    <div className="cl-actions" style={{ marginTop: '1.5rem' }}>
                        <button className="cl-btn-back" onClick={goBack}>Back</button>
                        <button
                            className="cl-btn-submit"
                            disabled={submitting}
                            onClick={handleSubmit}
                        >
                            {submitting ? 'Posting...' : 'Post Food Listing'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateListing;
