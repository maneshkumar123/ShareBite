import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapPicker.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;

interface MapPickerProps {
    latitude: number;
    longitude: number;
    onLocationChange: (lat: number, lng: number) => void;
}

const MapPicker: React.FC<MapPickerProps> = ({ latitude, longitude, onLocationChange }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const marker = useRef<mapboxgl.Marker | null>(null);

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [longitude, latitude],
            zoom: 14,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        marker.current = new mapboxgl.Marker({ color: '#7DFF12', draggable: true })
            .setLngLat([longitude, latitude])
            .addTo(map.current);

        marker.current.on('dragend', () => {
            const lngLat = marker.current!.getLngLat();
            onLocationChange(lngLat.lat, lngLat.lng);
        });

        return () => {
            map.current?.remove();
            map.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!map.current || !marker.current) return;
        marker.current.setLngLat([longitude, latitude]);
        map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
    }, [latitude, longitude]);

    return <div ref={mapContainer} className="map-picker" />;
};

export default MapPicker;
