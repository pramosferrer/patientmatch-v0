'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import type { PublicTrial } from '@/components/trials/PublicTrialCard';
import type { ComponentType } from 'react';

// react-leaflet types require casting when strict JSX checking is aggressive
const MapContainerAny = MapContainer as unknown as ComponentType<any>;
const TileLayerAny = TileLayer as unknown as ComponentType<any>;
const MarkerAny = Marker as unknown as ComponentType<any>;
const PopupAny = Popup as unknown as ComponentType<any>;
const CircleAny = Circle as unknown as ComponentType<any>;

// ─── Types ────────────────────────────────────────────────────────────────────

type TrialPin = {
  nct_id: string;
  displayTitle: string;
  lat: number;
  lon: number;
  distanceMiles: number | null;
  city: string | null;
  state: string | null;
  facilityName: string | null;
  statusBucket: string | null;
};

type TrialsMapProps = {
  trials: PublicTrial[];
  centerLat?: number | null;
  centerLon?: number | null;
  radiusMiles?: number;
  zip?: string;
  condition?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPins(trials: PublicTrial[]): TrialPin[] {
  const pins: TrialPin[] = [];
  for (const t of trials) {
    const lat = t.nearest_site?.lat;
    const lon = t.nearest_site?.lon;
    if (lat == null || lon == null) continue;
    pins.push({
      nct_id: t.nct_id,
      displayTitle: t.display_title || t.title,
      lat,
      lon,
      distanceMiles: t.distance_miles ?? t.nearest_site?.distance_miles ?? null,
      city: t.nearest_site?.city ?? null,
      state: t.nearest_site?.state ?? null,
      facilityName: t.nearest_site?.facility_name ?? null,
      statusBucket: t.status_bucket ?? null,
    });
  }
  return pins;
}

function statusLabel(bucket: string | null): string {
  const b = bucket?.toLowerCase() ?? '';
  if (b === 'recruiting' || b === 'active') return 'Enrolling now';
  if (b === 'not_yet_recruiting') return 'Opening soon';
  if (b === 'enrolling_by_invitation') return 'By invitation';
  return 'View study';
}

function statusAccent(bucket: string | null): string {
  const b = bucket?.toLowerCase() ?? '';
  if (b === 'recruiting' || b === 'active') return '#D97706';
  if (b === 'not_yet_recruiting') return '#0E7490';
  return '#6B7280';
}

function directionsUrl(lat: number, lon: number, facility: string | null): string {
  const dest = facility
    ? `${encodeURIComponent(facility)}+@${lat},${lon}`
    : `${lat},${lon}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

// Custom SVG drop-pin icon
function makeIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"
      style="width:26px;height:34px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.30))">
      <path d="M12 0C7.032 0 3 4.032 3 9c0 7 9 23 9 23s9-16 9-23C21 4.032 16.968 0 12 0z"
        fill="${color}"/>
      <circle cx="12" cy="9" r="3.5" fill="white" opacity="0.9"/>
    </svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -36],
  });
}

const ICON_RECRUITING = makeIcon('#D97706');
const ICON_BRAND      = makeIcon('#2D9B70');
const ICON_MUTED      = makeIcon('#9CA3AF');

function getIcon(bucket: string | null) {
  const b = bucket?.toLowerCase() ?? '';
  if (b === 'recruiting' || b === 'active') return ICON_RECRUITING;
  if (!b) return ICON_MUTED;
  return ICON_BRAND;
}

// ─── AutoBounds: fits map to all pins after render ────────────────────────────

function AutoBounds({ pins, centerLat, centerLon }: {
  pins: TrialPin[];
  centerLat?: number | null;
  centerLon?: number | null;
}) {
  const map = useMap();
  const didFit = useRef(false);

  useEffect(() => {
    if (didFit.current) return;
    if (pins.length > 0) {
      const bounds = L.latLngBounds(pins.map(p => [p.lat, p.lon] as [number, number]));
      map.fitBounds(bounds, { padding: [52, 52], maxZoom: 12 });
      didFit.current = true;
    } else if (centerLat != null && centerLon != null) {
      map.setView([centerLat, centerLon], 8);
      didFit.current = true;
    }
  }, [pins, centerLat, centerLon, map]);

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrialsMap({
  trials,
  centerLat,
  centerLon,
  radiusMiles = 50,
  zip,
  condition,
}: TrialsMapProps) {
  const pins = buildPins(trials);
  const hasCenter = centerLat != null && centerLon != null;
  const hasPins = pins.length > 0;

  const defaultCenter: [number, number] = hasCenter
    ? [centerLat!, centerLon!]
    : [39.5, -98.35]; // geographic center of US

  return (
    <div
      className="relative w-full"
      style={{ height: 'calc(100vh - 128px)', minHeight: 480 }}
    >
      <MapContainerAny
        center={defaultCenter}
        zoom={hasCenter ? 9 : 4}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        scrollWheelZoom
      >
        {/* CartoDB Voyager — polished, free, no API key required */}
        <TileLayerAny
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Search radius circle */}
        {hasCenter && (
          <CircleAny
            center={[centerLat!, centerLon!]}
            radius={radiusMiles * 1609.34}
            pathOptions={{
              color: '#2D9B70',
              fillColor: '#2D9B70',
              fillOpacity: 0.06,
              weight: 1.5,
              dashArray: '6 5',
            }}
          />
        )}

        {/* Trial site pins */}
        {pins.map((pin) => (
          <MarkerAny
            key={pin.nct_id}
            position={[pin.lat, pin.lon] as [number, number]}
            icon={getIcon(pin.statusBucket)}
          >
            <PopupAny maxWidth={300} minWidth={240}>
              <div style={{ fontFamily: 'Inter,system-ui,sans-serif', padding: '2px 0' }}>
                {/* Status label */}
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                  color: statusAccent(pin.statusBucket),
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}>
                  <span style={{
                    display: 'inline-block', width: 7, height: 7,
                    borderRadius: '50%', background: statusAccent(pin.statusBucket),
                  }} />
                  {statusLabel(pin.statusBucket)}
                </div>

                {/* Trial title */}
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', lineHeight: 1.35, marginBottom: 6 }}>
                  {pin.displayTitle.length > 90
                    ? pin.displayTitle.slice(0, 90) + '…'
                    : pin.displayTitle}
                </div>

                {/* Facility + Location */}
                {pin.facilityName && (
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
                    {pin.facilityName}
                  </div>
                )}
                {(pin.city || pin.state) && (
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: pin.distanceMiles != null ? 2 : 10 }}>
                    {[pin.city, pin.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {pin.distanceMiles != null && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2D9B70', marginBottom: 10 }}>
                    {pin.distanceMiles >= 10
                      ? Math.round(pin.distanceMiles)
                      : pin.distanceMiles.toFixed(1)} mi away
                  </div>
                )}

                {/* CTA buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`/trial/${pin.nct_id}`}
                    style={{
                      flex: 1, textAlign: 'center', padding: '6px 0',
                      borderRadius: 6, border: '1px solid #D1FAE5',
                      background: '#F0FDF4', color: '#2D9B70',
                      fontSize: 12, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    View study
                  </a>
                  <a
                    href={directionsUrl(pin.lat, pin.lon, pin.facilityName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1, textAlign: 'center', padding: '6px 0',
                      borderRadius: 6, background: '#2D9B70',
                      color: '#fff', fontSize: 12, fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Get directions →
                  </a>
                </div>
              </div>
            </PopupAny>
          </MarkerAny>
        ))}

        <AutoBounds pins={pins} centerLat={centerLat} centerLon={centerLon} />
      </MapContainerAny>

      {/* Empty state: ZIP provided but no site data */}
      {!hasPins && hasCenter && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="pointer-events-auto rounded-2xl border border-border/50 bg-white/95 px-8 py-6 text-center shadow-card">
            <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-[14px] font-medium text-foreground">No site coordinates available</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {zip ? `Could not map trial sites near ${zip}.` : 'Try entering a ZIP code.'}
            </p>
          </div>
        </div>
      )}

      {/* No ZIP prompt */}
      {!hasPins && !hasCenter && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="pointer-events-auto rounded-2xl border border-border/50 bg-white/95 px-10 py-8 text-center shadow-card max-w-sm">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-primary/50" />
            <p className="text-[15px] font-semibold text-foreground">Enter a ZIP to see trial sites</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Use the Location filter above to find{condition ? ` ${condition} trials` : ' trials'} near you and see them on the map.
            </p>
          </div>
        </div>
      )}

      {/* Pin count badge */}
      {hasPins && (
        <div className="absolute bottom-8 left-4 z-[400] rounded-full border border-border/50 bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-sm backdrop-blur-sm">
          {pins.length} site{pins.length !== 1 ? 's' : ''} plotted
        </div>
      )}
    </div>
  );
}
