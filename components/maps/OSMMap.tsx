"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
// @ts-ignore
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
// @ts-ignore
import iconUrl from "leaflet/dist/images/marker-icon.png";
// @ts-ignore
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

type Props = {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  zoom?: number;
  className?: string;
};

export default function OSMMap({ lat, lng, label, height = 200, zoom = 12, className }: Props) {
  return (
    <div className={className ?? ""} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <MapContainer
        {...({
          center: [lat, lng],
          zoom,
          style: { height, width: "100%" },
          scrollWheelZoom: false,
        } as any)}
      >
        {(
          <TileLayer
            {...({
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            } as any)}
          />
        )}
        <Marker position={[lat, lng]}>
          <Popup>{label ?? "Clinical site"}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

