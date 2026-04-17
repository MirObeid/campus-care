import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { Complaint } from '../types';
import L from 'leaflet';

interface ComplaintMapProps {
  complaints: Complaint[];
  center?: [number, number];
}

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'Critical': return '#ef4444';
    case 'High': return '#f97316';
    case 'Medium': return '#eab308';
    case 'Low': return '#22c55e';
    default: return '#64748b';
  }
};

export default function ComplaintMap({ complaints, center = [17.3850, 78.4867] }: ComplaintMapProps) {
  const complaintsWithLocation = complaints.filter(c => c.lat && c.lng);

  return (
    <div className="h-96 w-full rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        className="h-full w-full grayscale-[0.2] contrast-[1.1]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {complaintsWithLocation.map((complaint) => (
          <CircleMarker
            key={complaint.id}
            center={[complaint.lat!, complaint.lng!]}
            radius={complaint.isEmergency ? 12 : 8}
            pathOptions={{ 
              fillColor: getPriorityColor(complaint.priority), 
              fillOpacity: 0.6, 
              color: complaint.isEmergency ? '#ef4444' : 'white',
              weight: complaint.isEmergency ? 3 : 1
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    complaint.isEmergency ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {complaint.isEmergency ? 'Emergency' : complaint.category}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900 line-clamp-1">{complaint.description}</p>
                <p className="text-[10px] text-slate-500 mt-1">{complaint.location}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
