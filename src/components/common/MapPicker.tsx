import React, { useEffect, useRef } from 'react';
import { importLibrary } from '@/lib/googleMaps';
import './MapPicker.css';

// ─── Light map style (warm, minimal) ──────────────────────────────────────────

const LIGHT_STYLES: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#f5f3ef' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6B6860' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1A1815' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E4E1DC' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9E9A94' }] },
    { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#f0ede7' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#D5D2CC' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4e4f1' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9bbad4' }] },
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MapPickerProps {
    latitude: number;
    longitude: number;
    onLocationChange: (lat: number, lng: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const MapPicker: React.FC<MapPickerProps> = ({ latitude, longitude, onLocationChange }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<google.maps.Map | null>(null);
    const marker = useRef<google.maps.Marker | null>(null);

    // Always-current callback ref — avoids stale closure on dragend
    const onLocationChangeRef = useRef(onLocationChange);
    useEffect(() => { onLocationChangeRef.current = onLocationChange; });

    // Guard: don't panTo while the user is dragging
    const isDragging = useRef(false);

    // Snapshot initial position for the async init closure
    const initPos = useRef({ lat: latitude, lng: longitude });

    // ── Initialize map once ──────────────────────────────────────────────────
    useEffect(() => {
        if (!mapContainer.current || map.current) return;
        let destroyed = false;

        const init = async () => {
            // importLibrary('maps') loads the core Maps JS API and populates google.maps
            const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
            if (destroyed || !mapContainer.current) return;

            map.current = new Map(mapContainer.current, {
                center: initPos.current,
                zoom: 14,
                styles: LIGHT_STYLES,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                clickableIcons: false,
            });

            // google.maps.Marker is available on the global after importLibrary('maps')
            marker.current = new google.maps.Marker({
                map: map.current,
                position: initPos.current,
                draggable: true,
                cursor: 'grab',
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#7DFF12',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2.5,
                    scale: 10,
                },
                title: 'Drag to set pickup location',
            });

            marker.current.addListener('dragstart', () => {
                isDragging.current = true;
            });

            marker.current.addListener('dragend', () => {
                const pos = marker.current!.getPosition();
                if (pos) {
                    onLocationChangeRef.current(pos.lat(), pos.lng());
                }
                setTimeout(() => { isDragging.current = false; }, 60);
            });
        };

        init().catch(console.error);

        return () => {
            destroyed = true;
            marker.current?.setMap(null);
            marker.current = null;
            map.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Pan to new coords when parent updates lat/lng ────────────────────────
    useEffect(() => {
        if (!map.current || !marker.current || isDragging.current) return;
        const pos = { lat: latitude, lng: longitude };
        marker.current.setPosition(pos);
        map.current.panTo(pos);
    }, [latitude, longitude]);

    return <div ref={mapContainer} className="map-picker" />;
};

export default MapPicker;
