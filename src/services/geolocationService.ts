/**
 * Geolocation Service
 * 
 * Handles all geolocation operations:
 * - Browser geolocation API
 * - Mapbox Geocoding (address → coordinates)
 * - Mapbox Reverse Geocoding (coordinates → address)
 * - PostGIS POINT format conversion
 */

import type { ApiResponse } from '../types';
import { apiRequest } from './api';

// ==============================================
// CONFIGURATION
// ==============================================

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const MAPBOX_GEOCODING_API = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

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
 * Validate Mapbox configuration
 */
const isMapboxConfigured = (): boolean => {
    return Boolean(MAPBOX_ACCESS_TOKEN);
};

// ==============================================
// GEOLOCATION SERVICE
// ==============================================

export const geolocationService = {
    /**
     * Check if Mapbox is configured
     */
    isConfigured: isMapboxConfigured,

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
     * Geocode address to coordinates using Mapbox
     * Converts "123 Main St, City" → { lat, lng, formatted address }
     */
    geocodeAddress: async (address: string): Promise<ApiResponse<GeocodeResult>> => {
        if (!isMapboxConfigured()) {
            return {
                success: false,
                error: 'Mapbox is not configured. Please add VITE_MAPBOX_ACCESS_TOKEN to .env.local',
            };
        }

        return apiRequest(async () => {
            const encodedAddress = encodeURIComponent(address);
            const url = `${MAPBOX_GEOCODING_API}/${encodedAddress}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Geocoding request failed');
            }

            const data = await response.json();
            
            if (!data.features || data.features.length === 0) {
                throw new Error('No location found for the given address');
            }

            const feature = data.features[0];
            const [longitude, latitude] = feature.center;

            // Extract place details from context
            const context = feature.context || [];
            const getContext = (type: string) => {
                const item = context.find((c: { id: string }) => c.id.startsWith(type));
                return item ? item.text : undefined;
            };

            return {
                latitude,
                longitude,
                address: address,
                placeName: feature.place_name,
                city: getContext('place'),
                region: getContext('region'),
                country: getContext('country'),
            };
        });
    },

    /**
     * Reverse geocode coordinates to address using Mapbox
     * Converts { lat, lng } → formatted address string
     */
    reverseGeocode: async (
        latitude: number,
        longitude: number
    ): Promise<ApiResponse<{ address: string; placeName: string }>> => {
        if (!isMapboxConfigured()) {
            return {
                success: false,
                error: 'Mapbox is not configured. Please add VITE_MAPBOX_ACCESS_TOKEN to .env.local',
            };
        }

        return apiRequest(async () => {
            // Remove types filter to allow any location data (address, place, region, etc.)
            // This makes reverse geocoding more forgiving for coordinates without exact addresses
            const url = `${MAPBOX_GEOCODING_API}/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Reverse geocoding request failed');
            }

            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                // Return a fallback location name with coordinates
                return {
                    address: `Location at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                    placeName: `Location at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                };
            }

            const feature = data.features[0];

            return {
                address: feature.place_name,
                placeName: feature.place_name,
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
