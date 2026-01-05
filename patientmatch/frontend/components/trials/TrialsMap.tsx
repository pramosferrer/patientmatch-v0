'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import { TrialCardProps } from './TrialCard';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { ComponentType } from 'react';

// Fix for default marker icon
const defaultIcon = new Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
const MapContainerAny = MapContainer as unknown as ComponentType<any>;
const TileLayerAny = TileLayer as unknown as ComponentType<any>;
const MarkerAny = Marker as unknown as ComponentType<any>;
const PopupAny = Popup as unknown as ComponentType<any>;

interface TrialsMapProps {
    trials: TrialCardProps[];
    center?: [number, number];
    zoom?: number;
}

export default function TrialsMap({ trials, center = [39.8283, -98.5795], zoom = 4 }: TrialsMapProps) {
    // Filter trials with valid coordinates
    const trialsWithCoords = trials.filter(t => {
        const lat = t.nearest_site?.lat;
        const lon = t.nearest_site?.lon;
        return typeof lat === 'number' && typeof lon === 'number';
    });

    if (trialsWithCoords.length === 0) {
        return (
            <div className="flex h-[400px] items-center justify-center rounded-xl border border-pm-border bg-pm-bg/30 text-pm-muted">
                No trials with location data available to display on map.
            </div>
        );
    }

    return (
        <div className="h-[600px] w-full overflow-hidden rounded-xl border border-pm-border shadow-sm z-0 relative">
            <MapContainerAny center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
                <TileLayerAny
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {trialsWithCoords.map((trial) => (
                    <MarkerAny
                        key={trial.nct_id}
                        position={[trial.nearest_site!.lat!, trial.nearest_site!.lon!]}
                        icon={defaultIcon}
                    >
                        <PopupAny>
                            <div className="min-w-[200px]">
                                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{trial.title}</h3>
                                <p className="text-xs text-pm-muted mb-2">
                                    {trial.nearest_site?.city}, {trial.nearest_site?.state}
                                </p>
                                <Link href={`/trial/${trial.nct_id}`}>
                                    <Button size="sm" variant="outline" className="w-full h-7 text-xs">
                                        View Details
                                    </Button>
                                </Link>
                            </div>
                        </PopupAny>
                    </MarkerAny>
                ))}
            </MapContainerAny>
        </div>
    );
}
