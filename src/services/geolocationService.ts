import type { Location, ApiResponse } from '../types';
import { apiRequest } from './api';

// Geolocation service
export const geolocationService = {
    // Get user's current location
    getCurrentLocation: (): Promise<ApiResponse<Location>> => {
        return apiRequest(
            () =>
                new Promise((resolve, reject) => {
                    if (!navigator.geolocation) {
                        reject(new Error('Geolocation is not supported by your browser'));
                        return;
                    }

                    navigator.geolocation.getCurrentPosition(
                        position => {
                            resolve({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                address: 'Current Location', // Will be geocoded later
                            });
                        },
                        error => {
                            reject(new Error(`Geolocation error: ${error.message}`));
                        }
                    );
                })
        );
    },

    // Calculate distance between two locations (Haversine formula)
    calculateDistance: (loc1: Location, loc2: Location): number => {
        const R = 6371; // Earth's radius in km
        const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
        const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((loc1.latitude * Math.PI) / 180) *
            Math.cos((loc2.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    // Geocode address to coordinates (placeholder)
    geocodeAddress: async (address: string): Promise<ApiResponse<Location>> => {
        return apiRequest(async () => {
            // TODO: Implement geocoding with Google Maps API or similar
            throw new Error('Geocoding not implemented yet');
        });
    },
};
