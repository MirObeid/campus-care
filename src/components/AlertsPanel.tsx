import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, MapPin, Zap, Info } from 'lucide-react';
import { Complaint } from '../types';

interface AlertsPanelProps {
  complaints: Complaint[];
}

export default function AlertsPanel({ complaints }: AlertsPanelProps) {
  // Logic to detect repeated issues
  // 1. Group by location
  // 2. Group by category
  // Only consider issues from current day or last 24h
  
  const now = new Date();
  const todayComplaints = complaints.filter(c => {
    if (!c.createdAt) return false;
    const date = c.createdAt.toDate();
    return (now.getTime() - date.getTime()) < 24 * 60 * 60 * 1000;
  });

  const locationStats: Record<string, number> = {};
  const categoryStats: Record<string, number> = {};

  todayComplaints.forEach(c => {
    locationStats[c.location] = (locationStats[c.location] || 0) + 1;
    categoryStats[c.category] = (categoryStats[c.category] || 0) + 1;
  });

  const alerts: string[] = [];
  
  Object.entries(locationStats).forEach(([loc, count]) => {
    if (count >= 3) {
      alerts.push(`⚠️ Cluster detected: ${count} complaints reported at ${loc} in the last 24h.`);
    }
  });

  Object.entries(categoryStats).forEach(([cat, count]) => {
    if (count >= 5) {
      alerts.push(`🚀 Sudden spike: ${count} ${cat} issues reported campus-wide today.`);
    }
  });

  // Emergency Alert
  const emergencies = todayComplaints.filter(c => c.isEmergency && c.status === 'Pending');
  if (emergencies.length > 0) {
    alerts.push(`🚨 CRITICAL: ${emergencies.length} unhandled emergency reports!`);
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {alerts.length > 0 ? (
          alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-4 rounded-2xl border flex items-center gap-4 shadow-lg ${
                alert.includes('🚨') || alert.includes('CRITICAL') 
                ? 'bg-rose-600 border-rose-500 text-white shadow-rose-100' 
                : 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-100'
              }`}
            >
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                {alert.includes('⚠️') ? <MapPin className="w-5 h-5" /> : 
                 alert.includes('🚨') ? <ShieldAlert className="w-5 h-5" /> :
                 <Zap className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-wider mb-0.5 opacity-80">System Intelligence Alert</p>
                <p className="text-sm font-bold leading-tight">{alert.replace(/^[🚨⚠️🚀]+ /, '')}</p>
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Info className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-emerald-800">Operational status stable. No significant clusters detected today.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
