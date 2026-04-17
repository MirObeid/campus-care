import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, where, onSnapshot, updateDoc, doc, addDoc, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Complaint, ComplaintStatus, ComplaintPriority } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { 
  CheckCircle2, Clock, AlertCircle, Users, ArrowUpRight, 
  Search, Filter, MoreVertical, ShieldCheck, XCircle, ChevronDown, Star,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import CommentSection from './CommentSection';
import ComplaintMap from './ComplaintMap';
import ActivityFeed from './ActivityFeed';
import AlertsPanel from './AlertsPanel';
import { ShieldAlert, Zap, LayoutDashboard, Map as MapIcon, Sparkles, TrendingUp, Filter as FilterIcon, SortAsc, Activity } from 'lucide-react';
import { getAdminComplaintSummary, AdminAISummary } from '../services/adminAI';

interface AdminDashboardProps {
  profile: UserProfile;
}

const STATUS_OPTIONS: ComplaintStatus[] = ["Pending", "Assigned", "In Progress", "Resolved", "Rejected", "Withdrawn"];
const PRIORITY_OPTIONS: ComplaintPriority[] = ["Low", "Medium", "High", "Critical"];
const CATEGORY_OPTIONS = ["Maintenance", "Academic", "Security", "Administrative", "Other"];

type AdminTab = 'Complaints' | 'Users' | 'Analytics' | 'Spatial View';
type SortOption = 'Latest' | 'Priority' | 'AI Severity';

export default function AdminDashboard({ profile }: AdminDashboardProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('Complaints');
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortOption>('Latest');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [aiSummary, setAiSummary] = useState<AdminAISummary | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(false);

  useEffect(() => {
    if (selectedComplaint) {
      const fetchAiSummary = async () => {
        setLoadingAi(true);
        setAiError(false);
        setAiSummary(null);
        try {
          const result = await getAdminComplaintSummary(selectedComplaint.description, selectedComplaint.category);
          setAiSummary(result);
        } catch (err) {
          console.error("Failed to load AI summary:", err);
          setAiError(true);
        } finally {
          setLoadingAi(false);
        }
      };
      fetchAiSummary();
    } else {
      setAiSummary(null);
    }
  }, [selectedComplaint?.id]); // Only re-run if the complaint ID changes

  const isStaff = profile.role === 'staff';

  useEffect(() => {
    let q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    
    // If staff, only show assigned tasks
    if (isStaff) {
      q = query(
        collection(db, 'complaints'), 
        where('assignedTo', '==', profile.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'complaints');
    });
    return () => unsubscribe();
  }, [isStaff, profile.uid]);

  useEffect(() => {
    if (activeTab === 'Users') {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'Pending').length,
    resolved: complaints.filter(c => c.status === 'Resolved').length,
    highPriority: complaints.filter(c => ['High', 'Critical'].includes(c.priority || '') && c.status !== 'Withdrawn').length,
    avgRating: complaints.filter(c => c.rating).length > 0 
      ? (complaints.filter(c => c.rating).reduce((acc, c) => acc + (c.rating || 0), 0) / complaints.filter(c => c.rating).length).toFixed(1)
      : 'N/A',
  };

  const categoryData = [
    { name: 'Maintenance', value: complaints.filter(c => c.category === 'Maintenance').length },
    { name: 'Academic', value: complaints.filter(c => c.category === 'Academic').length },
    { name: 'Security', value: complaints.filter(c => c.category === 'Security').length },
    { name: 'Admin', value: complaints.filter(c => c.category === 'Administrative').length },
    { name: 'Other', value: complaints.filter(c => c.category === 'Other').length },
  ];

  // Recurring Problems / Hotspots
  const locationCounts: Record<string, number> = {};
  complaints.forEach(c => {
    locationCounts[c.location] = (locationCounts[c.location] || 0) + 1;
  });
  const hotspotData = Object.entries(locationCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'];

  const filteredComplaints = complaints.filter(c => {
    const matchesSearch = c.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.reporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === 'Latest') {
      return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
    }
    if (sortBy === 'Priority') {
      const weights = { Critical: 4, High: 3, Medium: 2, Low: 1, '': 0 };
      const weightA = weights[a.priority as keyof typeof weights] || 0;
      const weightB = weights[b.priority as keyof typeof weights] || 0;
      return weightB - weightA;
    }
    if (sortBy === 'AI Severity') {
      // Logic: Use priority as primary severity indicator
      const weights = { Critical: 4, High: 3, Medium: 2, Low: 1, '': 0 };
      const weightA = weights[a.priority as keyof typeof weights] || 0;
      const weightB = weights[b.priority as keyof typeof weights] || 0;
      return weightB - weightA;
    }
    return 0;
  });

  const updateComplaint = async (id: string, updates: Partial<Complaint>) => {
    try {
      const complaint = complaints.find(c => c.id === id);
      await updateDoc(doc(db, 'complaints', id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      // Create notification for user
      if (updates.status || updates.adminNotes || updates.assignedTo) {
        let message = `Your complaint status has been updated to ${updates.status || complaint?.status}.`;
        if (updates.adminNotes) message = `Admin added a note: "${updates.adminNotes}"`;
        if (updates.assignedTo) message = `Your complaint has been assigned to ${updates.assignedToName}.`;
        
        await addDoc(collection(db, 'notifications'), {
          userId: complaint?.reporterUid,
          complaintId: id,
          message,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      
      if (selectedComplaint?.id === id) {
        setSelectedComplaint(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `complaints/${id}`);
    }
  };

  const updateUserRole = async (uid: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'Critical': return 'text-rose-600 bg-rose-50';
      case 'High': return 'text-orange-600 bg-orange-50';
      case 'Medium': return 'text-amber-600 bg-amber-50';
      case 'Low': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-slate-400 bg-slate-50';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
             <LayoutDashboard className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Command Center</h1>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 ring-4 ring-emerald-50/20">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">Live Updates Enabled</span>
              </div>
            </div>
            <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Intelligent Admin Panel • v2.0</p>
          </div>
        </div>
        <div className="flex items-center bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
          {(['Complaints', profile.role === 'admin' ? 'Users' : null, 'Analytics', 'Spatial View'].filter(Boolean) as AdminTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                {tab === 'Complaints' && <LayoutDashboard className="w-4 h-4" />}
                {tab === 'Spatial View' && <MapIcon className="w-4 h-4" />}
                {tab}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Complaints' && (
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Reports', value: stats.total, icon: AlertCircle, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
              { label: 'Pending Action', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
              { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
              { label: 'High Priority', value: stats.highPriority, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
            ].map((s, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={s.label} 
                className={`bg-white p-6 rounded-[2rem] shadow-sm border ${s.bg} flex items-center gap-5`}
              >
                <div className={`${s.bg.replace('border-', ' ')} w-12 h-12 rounded-2xl flex items-center justify-center`}>
                  <s.icon className={`w-6 h-6 ${s.color}`} />
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{s.label}</p>
                  <p className="text-2xl font-black text-slate-900">{s.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Quick Insights Section */}
            <div className="lg:col-span-1 space-y-6">
               <AlertsPanel complaints={complaints} />

               <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Hotspots
                  </h3>
                  <div className="space-y-4">
                    {hotspotData.slice(0, 3).map((d, i) => (
                      <div key={d.name} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-600 truncate max-w-[120px]">{d.name}</span>
                          <span className="font-bold text-indigo-600">{d.value}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(d.value / Math.max(...hotspotData.map(x => x.value))) * 100}%` }}
                            className="h-full bg-indigo-500 rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                    {hotspotData.length === 0 && <p className="text-xs text-slate-400 italic">No data yet</p>}
                  </div>
               </div>

               <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                  <Zap className="absolute top-2 right-2 w-20 h-20 text-white/10 -rotate-12" />
                  <h3 className="font-bold text-lg mb-1">AI Insight</h3>
                  <p className="text-white/80 text-xs leading-relaxed mb-4">
                    {hotspotData[0] ? `Most reports are coming from ${hotspotData[0].name}. Consider increasing staff presence there.` : "Analyze data to see patterns."}
                  </p>
                  <div className="text-[10px] font-bold uppercase tracking-widest bg-white/20 inline-block px-2 py-1 rounded-lg">Operational Efficiency</div>
               </div>

               <div className="h-[400px]">
                 <ActivityFeed complaints={complaints} />
               </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Search issues, students, or locations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 shadow-sm text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <SortAsc className="w-4 h-4" /> Sort
                    </div>
                    {(['Latest', 'Priority', 'AI Severity'] as SortOption[]).map(option => (
                      <button
                        key={option}
                        onClick={() => setSortBy(option)}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
                          sortBy === option ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                   <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-slate-100 shrink-0">
                      <div className="px-3 py-1 flex items-center gap-2">
                        <FilterIcon className="w-3 h-3 text-slate-400" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                      </div>
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border-none rounded-xl px-3 py-1.5 text-[10px] font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer pr-8"
                      >
                        <option value="All">All</option>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>

                   <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-slate-100 shrink-0">
                      <div className="px-3 py-1 flex items-center gap-2">
                        <Activity className="w-3 h-3 text-slate-400" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</span>
                      </div>
                      <select 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-white border-none rounded-xl px-3 py-1.5 text-[10px] font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer pr-8"
                      >
                        <option value="All">All</option>
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                </div>
              </div>

              {/* Enhanced Complaint Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredComplaints.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-medium">No results found for your search criteria.</p>
                  </div>
                ) : (
                  filteredComplaints.map((c, i) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      key={c.id}
                      onClick={() => setSelectedComplaint(c)}
                      className={`group p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden ${
                        selectedComplaint?.id === c.id ? 'ring-2 ring-indigo-500' : ''
                      } ${c.priority === 'Critical' && c.status !== 'Withdrawn' ? 'ring-2 ring-rose-500/50 animate-shadow-pulse' : ''} ${
                        c.status === 'Withdrawn' ? 'opacity-60 grayscale-[0.8]' : ''
                      }`}
                    >
                      {c.isEmergency && (
                        <div className="absolute top-0 right-0 py-1 px-4 bg-rose-500 text-white text-[9px] font-black uppercase tracking-tighter rounded-bl-xl shadow-lg animate-pulse">
                          Emergency
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                            c.isEmergency ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {c.reporterName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{c.reporterName}</p>
                            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {c.location}
                            </p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getPriorityColor(c.priority)}`}>
                          {c.priority}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 mb-2 truncate">{c.category}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                        {c.description}
                      </p>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                             c.status === 'Resolved' ? 'bg-emerald-500' : 
                             c.status === 'Pending' ? 'bg-amber-500' : 
                             c.status === 'Withdrawn' ? 'bg-slate-400' : 'bg-indigo-500'
                          }`} />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{c.status}</span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 tracking-tight">
                          {c.createdAt?.toDate().toLocaleDateString()}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Users' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">User Management</h2>
            <div className="text-xs text-slate-500">{users.length} total users</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-100" referrerPolicy="no-referrer" />
                        <span className="text-sm font-semibold text-slate-900">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600">{u.email}</td>
                    <td className="py-4 px-6">
                      <select 
                        value={u.role}
                        onChange={(e) => updateUserRole(u.uid, e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="faculty">Faculty</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {u.createdAt?.toDate().toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Star className="w-5 h-5 text-rose-600" />
              Student Satisfaction
            </h3>
            <div className="flex flex-col items-center justify-center h-64 border border-slate-50 rounded-2xl bg-slate-50/30">
              <div className="text-6xl font-black text-slate-900 mb-2">{stats.avgRating}</div>
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star 
                    key={s} 
                    className={`w-6 h-6 ${Number(stats.avgRating) >= s ? 'fill-rose-500 text-rose-500' : 'text-slate-200'}`} 
                  />
                ))}
              </div>
              <p className="text-sm text-slate-500 font-medium">Average across {complaints.filter(c => c.rating).length} ratings</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <BarChart className="w-5 h-5 text-indigo-600" />
              Issue Categories
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-600" />
              Hotspot Locations (Recurring Problems)
            </h3>
            <div className="space-y-4">
              {hotspotData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(d.value / Math.max(...hotspotData.map(x => x.value))) * 100}%` }}
                        className="h-full bg-rose-500"
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-900">{d.value}</span>
                  </div>
                </div>
              ))}
              {hotspotData.length === 0 && (
                <p className="text-center py-10 text-slate-400 text-sm italic">No hotspot data available yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'Spatial View' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Campus Incident Map</h2>
            <p className="text-sm text-slate-500 mb-6">Visual cluster of reported issues across the campus</p>
            <ComplaintMap complaints={complaints} />
          </div>
        </div>
      )}

      {/* Modern Detail Drawer overlay */}
      <AnimatePresence>
        {selectedComplaint && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedComplaint(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-[500px] bg-slate-50 shadow-2xl z-[120] overflow-y-auto custom-scrollbar flex flex-col"
            >
              {/* Header */}
              <div className="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold ${
                    selectedComplaint.isEmergency ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {selectedComplaint.category.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedComplaint.category}</h2>
                    <p className="text-xs text-slate-400 font-medium">Report #{selectedComplaint.id.slice(-6)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedComplaint(null)}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all active:scale-90"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-8 flex-1">
                {/* Status Pipeline Visual */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">Resolution Pipeline</p>
                  <div className="flex items-center justify-between relative px-2">
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-100 -z-0" />
                    {STATUS_OPTIONS.slice(0, 4).map((status, idx) => {
                      const isActive = selectedComplaint.status === status;
                      const isCompleted = STATUS_OPTIONS.indexOf(selectedComplaint.status) > idx;
                      return (
                        <div key={status} className="relative z-10 flex flex-col items-center gap-2 group">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isActive ? 'bg-indigo-600 shadow-lg shadow-indigo-200 scale-110' : 
                            isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}>
                            {isCompleted ? <CheckCircle2 className="w-4 h-4 text-white" /> : (
                              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-white'}`} />
                            )}
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-tighter ${
                            isActive ? 'text-indigo-600' : 'text-slate-400'
                          }`}>{status}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* AI Analysis Panel */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden ring-8 ring-indigo-50"
                >
                  <Sparkles className="absolute -top-4 -right-4 w-32 h-32 text-white/10" />
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">Intelligence Insight</span>
                  </div>

                  {loadingAi ? (
                    <div className="flex flex-col gap-3 py-4">
                      <div className="h-4 bg-white/20 rounded-full w-full animate-pulse" />
                      <div className="h-4 bg-white/20 rounded-full w-4/5 animate-pulse" />
                      <div className="h-4 bg-white/20 rounded-full w-3/4 animate-pulse" />
                    </div>
                  ) : aiError ? (
                    <div className="py-4 text-white/70 italic text-sm">AI analysis currently unavailable.</div>
                  ) : aiSummary ? (
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Issue Essence</p>
                        <p className="text-sm font-medium leading-relaxed">{aiSummary.summary}</p>
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                        <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Recommended Strategy</p>
                        <p className="text-xs italic text-indigo-100">{aiSummary.suggestedAction}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                         <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Tier Score</span>
                         <span className={`text-[10px] font-black px-4 py-1 rounded-full uppercase ${getPriorityColor(aiSummary.severity).replace('bg-', 'bg-')}`}>
                            {aiSummary.severity}
                         </span>
                      </div>
                    </div>
                  ) : null}
                </motion.div>

                {/* Details Section */}
                <div className="space-y-6">
                   <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Incident Context</p>
                      <p className="text-sm text-slate-700 leading-relaxed italic border-l-4 border-indigo-500 pl-4">{selectedComplaint.description}</p>
                   </div>

                   {selectedComplaint.imageUrl && (
                     <div className="group relative">
                        <img 
                          src={selectedComplaint.imageUrl} 
                          alt="Evidence" 
                          className="w-full h-56 object-cover rounded-[2rem] border border-slate-100 shadow-lg hover:brightness-110 transition-all"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm">Evidence Photo</div>
                     </div>
                   )}

                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reporter</p>
                        <p className="text-sm font-bold text-slate-900">{selectedComplaint.reporterName}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Timestamp</p>
                        <p className="text-sm font-bold text-slate-900">{selectedComplaint.createdAt?.toDate().toLocaleTimeString()}</p>
                      </div>
                   </div>

                   {/* Admin Management Tools */}
                   <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 ${
                     selectedComplaint.status === 'Withdrawn' ? 'opacity-50 pointer-events-none grayscale' : ''
                   }`}>
                      {selectedComplaint.status === 'Withdrawn' && (
                        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 text-center mb-4">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Complaint Withdrawn by Student</p>
                           {selectedComplaint.withdrawnAt && (
                             <p className="text-[8px] text-slate-400 mt-1">at {selectedComplaint.withdrawnAt.toDate().toLocaleString()}</p>
                           )}
                           {selectedComplaint.withdrawalReason && (
                             <p className="text-[10px] text-slate-500 mt-2 italic">"{selectedComplaint.withdrawalReason}"</p>
                           )}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                         <button 
                           onClick={() => updateComplaint(selectedComplaint.id, { status: 'Resolved' })}
                           className="flex flex-col items-center gap-2 p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-3xl transition-all group"
                         >
                           <CheckCircle2 className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                           <span className="text-[8px] font-black text-emerald-700 uppercase">Resolve</span>
                         </button>
                         <button 
                           onClick={() => updateComplaint(selectedComplaint.id, { priority: 'Critical', status: 'In Progress' })}
                           className="flex flex-col items-center gap-2 p-4 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-3xl transition-all group"
                         >
                           <ShieldAlert className="w-5 h-5 text-rose-600 group-hover:scale-110 transition-transform" />
                           <span className="text-[8px] font-black text-rose-700 uppercase">Escalate</span>
                         </button>
                         <button 
                           onClick={() => {
                             if (selectedComplaint.assignedTo) {
                               updateComplaint(selectedComplaint.id, { status: 'Assigned' });
                             } else {
                               alert("Please select a staff member first.");
                             }
                           }}
                           className="flex flex-col items-center gap-2 p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-3xl transition-all group"
                         >
                           <Users className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                           <span className="text-[8px] font-black text-indigo-700 uppercase">Dispatch</span>
                         </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Priority Tier</label>
                          <select 
                            value={selectedComplaint.priority || ""}
                            onChange={(e) => updateComplaint(selectedComplaint.id, { priority: e.target.value as ComplaintPriority })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Unset</option>
                            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Live Status</label>
                          <select 
                            value={selectedComplaint.status}
                            onChange={(e) => updateComplaint(selectedComplaint.id, { status: e.target.value as ComplaintStatus })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Dispatch Staff</label>
                        <select 
                          value={selectedComplaint.assignedTo || ""}
                          onChange={(e) => {
                            const user = users.find(u => u.uid === e.target.value);
                            updateComplaint(selectedComplaint.id, { 
                              assignedTo: e.target.value,
                              assignedToName: user?.displayName || 'Unknown'
                            });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Unassigned</option>
                          {users.filter(u => u.role !== 'student').map(u => (
                            <option key={u.uid} value={u.uid}>{u.displayName} ({u.role})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Resolution Log</label>
                        <textarea 
                          placeholder="Type internal notes or response to student..."
                          value={selectedComplaint.adminNotes || ""}
                          onChange={(e) => updateComplaint(selectedComplaint.id, { adminNotes: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium h-24"
                        />
                      </div>
                   </div>
                </div>

                {/* Discussion Section */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
                   <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Case Discussion</span>
                   </div>
                   <div className="flex-1">
                      <CommentSection 
                        complaintId={selectedComplaint.id} 
                        profile={profile} 
                        isReadOnly={selectedComplaint.status === 'Withdrawn'}
                      />
                   </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
