import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, PlusCircle, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Complaint } from '../types';

interface ActivityItem {
  id: string;
  type: 'creation' | 'status_change' | 'priority_change';
  message: string;
  timestamp: Date;
  icon: React.ElementType;
  color: string;
}

interface ActivityFeedProps {
  complaints: Complaint[];
}

export default function ActivityFeed({ complaints }: ActivityFeedProps) {
  // Derive activity from complaints. 
  // In a real app, this would be a separate collection.
  // Here we derive "New Complaint" and "Status Updates" from createdAt and updatedAt.
  
  const activities: ActivityItem[] = complaints
    .flatMap(c => {
      const items: ActivityItem[] = [];
      
      // Creation activity
      if (c.createdAt) {
        items.push({
          id: `${c.id}-created`,
          type: 'creation',
          message: `New complaint from ${c.reporterName}`,
          timestamp: c.createdAt.toDate(),
          icon: PlusCircle,
          color: 'text-indigo-500 bg-indigo-50',
        });
      }

      // Status change (simulated if updatedAt > createdAt)
      if (c.updatedAt && c.createdAt && c.updatedAt.toMillis() > c.createdAt.toMillis() + 1000) {
        items.push({
          id: `${c.id}-updated`,
          type: 'status_change',
          message: `${c.reporterName}'s report moved to ${c.status}`,
          timestamp: c.updatedAt.toDate(),
          icon: RefreshCw,
          color: 'text-emerald-500 bg-emerald-50',
        });
      }

      // High priority alert
      if (['High', 'Critical'].includes(c.priority || '') && c.createdAt) {
         items.push({
           id: `${c.id}-priority`,
           type: 'priority_change',
           message: `CRITICAL: ${c.category} issue at ${c.location}`,
           timestamp: c.createdAt.toDate(),
           icon: AlertCircle,
           color: 'text-rose-500 bg-rose-50',
         });
      }

      return items;
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 15);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Activity</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-100/50 rounded-full">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tighter">Live</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        <AnimatePresence initial={false}>
          {activities.map((activity) => (
            <motion.div
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100"
            >
              <div className={`${activity.color} w-8 h-8 rounded-xl flex items-center justify-center shrink-0`}>
                <activity.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                  {activity.message}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {activities.length === 0 && (
          <div className="py-10 text-center text-slate-400 italic text-xs">
            Waiting for activity...
          </div>
        )}
      </div>
    </div>
  );
}
