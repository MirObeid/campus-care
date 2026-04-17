import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, LocateFixed } from 'lucide-react';

// Fix for default marker icons in Leaflet + React
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Fallback to Hyderabad, India
const FALLBACK_LOCATION: [number, number] = [17.3850, 78.4867];

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialPos?: [number, number];
}

/**
 * Component to handle map interactions like clicks
 */
function MapEvents({ setPosition, onLocationSelect }: { 
  setPosition: (pos: [number, number]) => void, 
  onLocationSelect: (lat: number, lng: number) => void 
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationSelect(lat, lng);
    },
  });
  return null;
}

/**
 * Component to handle map movement/centering
 */
function MapController({ targetPos }: { targetPos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetPos) {
      map.flyTo(targetPos, 15, { duration: 1.5 });
    }
  }, [targetPos, map]);
  return null;
}

export default function MapPicker({ onLocationSelect, initialPos }: MapPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialPos || FALLBACK_LOCATION);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Function to handle geolocation
  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newPos: [number, number] = [latitude, longitude];
        setPosition(newPos);
        setMapCenter(newPos);
        onLocationSelect(latitude, longitude);
        setIsLocating(false);
      },
      (err) => {
        console.warn(`Geolocation error (${err.code}): ${err.message}`);
        setGeoError("Location access denied. Defaulting to Hyderabad.");
        setIsLocating(false);
        // We stay at fallback or initialPos
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [onLocationSelect]);

  // Initial detection on mount
  useEffect(() => {
    handleLocateUser();
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative h-64 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md transition-all">
        <MapContainer 
          center={mapCenter} 
          zoom={13} 
          scrollWheelZoom={false} 
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents setPosition={setPosition} onLocationSelect={onLocationSelect} />
          <MapController targetPos={position} />
          {position && <Marker position={position} icon={DefaultIcon} />}
        </MapContainer>

        {/* Floating "Use My Location" Button */}
        <button
          type="button"
          onClick={handleLocateUser}
          disabled={isLocating}
          className="absolute top-4 right-4 z-[1000] bg-white hover:bg-slate-50 text-indigo-600 p-2.5 rounded-xl shadow-lg border border-slate-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
          title="Use My Location"
        >
          {isLocating ? (
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Navigation className="w-5 h-5" />
          )}
        </button>

        {/* Error Overlay */}
        {geoError && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg shadow-sm">
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">{geoError}</p>
          </div>
        ) }
      </div>

      <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 transition-opacity">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${position ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Selected Location</p>
            {position ? (
              <p className="text-xs font-mono font-medium text-slate-700">
                {position[0].toFixed(6)}, {position[1].toFixed(6)}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No location selected yet</p>
            )}
          </div>
        </div>
        
        <p className="text-[10px] text-slate-400 font-medium italic hidden sm:block">
          {position ? 'Location captured' : 'Tap on the map to mark the spot'}
        </p>
      </div>
    </div>
  );
}
