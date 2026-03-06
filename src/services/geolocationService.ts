/**
 * Geolocation Service
 *
 * Handles all geolocation operations:
 * - Browser geolocation API
 * - Google Maps Geocoding (address → coordinates)
 * - Google Maps Reverse Geocoding (coordinates → address)
 * - PostGIS POINT format conversion
 */

import type { ApiResponse } from '../types';
import { apiRequest } from './api';

// ==============================================
// CONFIGURATION
// ==============================================

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
const GOOGLE_GEOCODING_API = 'https://maps.googleapis.com/maps/api/geocode/json';

// ==============================================
// TYPES
// ==============================================

export interface GeocodeResult {
    latitude: number;
    longitude: number;
    address: string;
    placeName: string;
    city?: string;
    region?: string;
    country?: string;
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Create PostGIS POINT format from coordinates
 * Format: POINT(longitude latitude) - Note: lng first!
 */
export const createPostGISPoint = (lng: number, lat: number): string => {
    return `POINT(${lng} ${lat})`;
};

/**
 * Validate Google Maps configuration
 */
const isGoogleMapsConfigured = (): boolean => {
    return Boolean(GOOGLE_MAPS_KEY);
};

// ==============================================
// GEOLOCATION SERVICE
// ==============================================

export const geolocationService = {
    /**
     * Check if Google Maps geocoding is configured
     */
    isConfigured: isGoogleMapsConfigured,

    /**
     * Get user's current position from browser
     */
    getCurrentPosition: (): Promise<ApiResponse<{ latitude: number; longitude: number }>> => {
        return apiRequest(
            () =>
                new Promise((resolve, reject) => {
                    if (!navigator.geolocation) {
                        reject(new Error('Geolocation is not supported by your browser'));
                        return;
                    }

                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            resolve({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                            });
                        },
                        (error) => {
                            let errorMessage = 'Failed to get location';
                            switch (error.code) {
                                case error.PERMISSION_DENIED:
                                    errorMessage = 'Location permission denied. Please enable location access.';
                                    break;
                                case error.POSITION_UNAVAILABLE:
                                    errorMessage = 'Location information unavailable.';
                                    break;
                                case error.TIMEOUT:
                                    errorMessage = 'Location request timed out.';
                                    break;
                            }
                            reject(new Error(errorMessage));
                        },
                        {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0,
                        }
                    );
                })
        );
    },

    /**
     * Geocode address to coordinates using Google Maps
     * Converts "123 Main St, City" → { lat, lng, formatted address }
     */
    geocodeAddress: async (address: string): Promise<ApiResponse<GeocodeResult>> => {
        if (!isGoogleMapsConfigured()) {
            return {
                success: false,
                error: 'Google Maps is not configured. Please add VITE_GOOGLE_MAPS_KEY to .env.local',
            };
        }

        return apiRequest(async () => {
            const url = `${GOOGLE_GEOCODING_API}?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Geocoding request failed');
            }

            const data = await response.json();

            if (data.status !== 'OK' || !data.results || data.results.length === 0) {
                throw new Error('No location found for the given address');
            }

            const result = data.results[0];
            const { lat: latitude, lng: longitude } = result.geometry.location;

            // Extract place details from address_components
            const getComponent = (type: string) => {
                const comp = result.address_components?.find(
                    (c: { types: string[] }) => c.types.includes(type)
                );
                return comp?.long_name;
            };

            return {
                latitude,
                longitude,
                address: address,
                placeName: result.formatted_address,
                city: getComponent('locality'),
                region: getComponent('administrative_area_level_1'),
                country: getComponent('country'),
            };
        });
    },

    /**
     * Reverse geocode coordinates to address using Google Maps
     * Converts { lat, lng } → formatted address string
     */
    reverseGeocode: async (
        latitude: number,
        longitude: number
    ): Promise<ApiResponse<{ address: string; placeName: string }>> => {
        if (!isGoogleMapsConfigured()) {
            return {
                success: false,
                error: 'Google Maps is not configured. Please add VITE_GOOGLE_MAPS_KEY to .env.local',
            };
        }

        return apiRequest(async () => {
            const url = `${GOOGLE_GEOCODING_API}?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_KEY}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Reverse geocoding request failed');
            }

            const data = await response.json();

            if (data.status !== 'OK' || !data.results || data.results.length === 0) {
                return {
                    address: `Location at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                    placeName: `Location at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                };
            }

            const result = data.results[0];

            return {
                address: result.formatted_address,
                placeName: result.formatted_address,
            };
        });
    },

    /**
     * Calculate distance between two locations (Haversine formula)
     * Returns distance in kilometers
     */
    calculateDistance: (
        lat1: number,
        lng1: number,
        lat2: number,
        lng2: number
    ): number => {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },
};
