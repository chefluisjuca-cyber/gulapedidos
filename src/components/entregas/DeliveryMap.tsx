import { useEffect, useRef } from 'react';
import { DeliveryMotoboy, DeliverySettings, IfoodOrderIntegration } from '../../types';

// Leaflet is loaded via CDN script tag in index.html
declare const L: any;

interface Props {
  dsettings: DeliverySettings | null;
  motoboys: DeliveryMotoboy[];
  ifoodOrders?: IfoodOrderIntegration[];
}

function restaurantIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#f59e0b;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

function motoboyIcon(name: string) {
  const initial = name.charAt(0).toUpperCase();
  return L.divIcon({
    className: '',
    html: `<div style="background:#10b981;width:30px;height:30px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;color:#fff;font-family:sans-serif;">${initial}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function ifoodOrderIcon(displayId: string | null) {
  const label = displayId ? `#${displayId}` : 'iF';
  return L.divIcon({
    className: '',
    html: `<div style="background:#ef4444;min-width:36px;height:24px;border-radius:6px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px;color:#fff;font-family:sans-serif;padding:0 5px;white-space:nowrap;">${label}</div>`,
    iconSize: [36, 24],
    iconAnchor: [18, 12],
    popupAnchor: [0, -16],
  });
}

const STATUS_LABELS: Record<string, string> = {
  PLACED: 'Recebido',
  CONFIRMED: 'Confirmado',
  DISPATCHED: 'Em Rota',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export default function DeliveryMap({ dsettings, motoboys, ifoodOrders = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const restaurantMarkerRef = useRef<any>(null);
  const motoboyMarkersRef = useRef<Map<string, any>>(new Map());
  const ifoodMarkersRef = useRef<Map<string, any>>(new Map());
  const initializedRef = useRef(false);

  const hasCoords = !!(dsettings?.latitude && dsettings?.longitude);
  const activeMotoboys = motoboys.filter(mb => mb.last_lat !== null && mb.last_lng !== null);
  const activeIfoodOrders = ifoodOrders.filter(
    o => o.latitude != null && o.longitude != null && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  );

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || initializedRef.current || typeof L === 'undefined') return;
    initializedRef.current = true;

    const centerLat = dsettings?.latitude ?? -14.235;
    const centerLng = dsettings?.longitude ?? -51.925;
    const zoom = hasCoords ? 14 : 4;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ prefix: '© <a href="https://osm.org/copyright">OpenStreetMap</a>' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
      motoboyMarkersRef.current.clear();
      ifoodMarkersRef.current.clear();
      restaurantMarkerRef.current = null;
    };
  }, []);

  // Restaurant (Ponto Zero) marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasCoords || typeof L === 'undefined') return;

    restaurantMarkerRef.current?.remove();

    const marker = L.marker([dsettings!.latitude!, dsettings!.longitude!], {
      icon: restaurantIcon(),
    }).addTo(map);
    marker.bindPopup(`<strong>🏠 Ponto Zero</strong><br/><small>${dsettings!.restaurant_address || 'Restaurante'}</small>`);
    restaurantMarkerRef.current = marker;
  }, [dsettings?.latitude, dsettings?.longitude]);

  // Motoboy markers — update on every motoboys change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof L === 'undefined') return;

    const currentIds = new Set(motoboys.map(mb => mb.id));

    // Remove stale markers
    motoboyMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        motoboyMarkersRef.current.delete(id);
      }
    });

    // Add or update
    motoboys.forEach(mb => {
      if (mb.last_lat == null || mb.last_lng == null) {
        motoboyMarkersRef.current.get(mb.id)?.remove();
        motoboyMarkersRef.current.delete(mb.id);
        return;
      }

      const latlng: [number, number] = [mb.last_lat, mb.last_lng];
      const icon = motoboyIcon(mb.name);

      const lastSeen = mb.last_seen_at
        ? `<small>Visto: ${new Date(mb.last_seen_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>`
        : '';

      if (motoboyMarkersRef.current.has(mb.id)) {
        const existing = motoboyMarkersRef.current.get(mb.id)!;
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.setPopupContent(`<strong>🛵 ${mb.name}</strong><br/>${lastSeen}`);
      } else {
        const marker = L.marker(latlng, { icon }).addTo(map);
        marker.bindPopup(`<strong>🛵 ${mb.name}</strong><br/>${lastSeen}`);
        motoboyMarkersRef.current.set(mb.id, marker);
      }
    });

    // Fit bounds
    const points: [number, number][] = [];
    if (dsettings?.latitude && dsettings?.longitude) {
      points.push([dsettings.latitude, dsettings.longitude]);
    }
    activeMotoboys.forEach(mb => {
      if (mb.last_lat != null && mb.last_lng != null) points.push([mb.last_lat, mb.last_lng]);
    });
    activeIfoodOrders.forEach(o => {
      if (o.latitude != null && o.longitude != null) points.push([o.latitude, o.longitude]);
    });

    if (points.length >= 2) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], map.getZoom());
    }

    setTimeout(() => map.invalidateSize(), 100);
  }, [motoboys]);

  // iFood order markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof L === 'undefined') return;

    const currentIds = new Set(activeIfoodOrders.map(o => o.id));

    ifoodMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        ifoodMarkersRef.current.delete(id);
      }
    });

    activeIfoodOrders.forEach(o => {
      if (o.latitude == null || o.longitude == null) return;
      const latlng: [number, number] = [o.latitude, o.longitude];
      const icon = ifoodOrderIcon(o.display_id);
      const address = [o.street, o.number, o.neighborhood].filter(Boolean).join(', ');
      const statusLabel = STATUS_LABELS[o.status] ?? o.status;
      const popupContent = `<strong>🍔 iFood ${o.display_id ? `#${o.display_id}` : ''}</strong><br/>${o.customer_name || ''}<br/><small>${address}</small><br/><span style="color:#ef4444;font-weight:bold;">${statusLabel}</span>`;

      if (ifoodMarkersRef.current.has(o.id)) {
        const existing = ifoodMarkersRef.current.get(o.id)!;
        existing.setLatLng(latlng);
        existing.setPopupContent(popupContent);
      } else {
        const marker = L.marker(latlng, { icon }).addTo(map);
        marker.bindPopup(popupContent);
        ifoodMarkersRef.current.set(o.id, marker);
      }
    });

    setTimeout(() => map.invalidateSize(), 100);
  }, [ifoodOrders]);

  if (!hasCoords && activeMotoboys.length === 0 && activeIfoodOrders.length === 0) {
    return (
      <div className="h-60 rounded-xl bg-slate-800/40 border border-slate-700 flex flex-col items-center justify-center gap-2 p-4">
        <p className="text-slate-400 text-sm font-semibold">Mapa indisponível</p>
        <p className="text-slate-500 text-xs text-center">
          Configure a Latitude e Longitude do Ponto Zero em Configurações → Canais e Tarifas para ativar o mapa ao vivo.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="h-72 w-full rounded-xl overflow-hidden border border-slate-700" />
      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1.5 items-end">
        {activeMotoboys.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-semibold">{activeMotoboys.length} em rota</span>
          </div>
        )}
        {activeIfoodOrders.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-red-400 font-semibold">{activeIfoodOrders.length} iFood</span>
          </div>
        )}
      </div>
    </div>
  );
}
