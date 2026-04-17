import React, { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Complaint, ComplaintCategory } from '../types';
import { 
  Plus, 
  MessageSquare, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  ChevronRight, 
  Search, 
  Image as ImageIcon,
  Star,
  ShieldAlert,
  Zap,
  User,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import CommentSection from './CommentSection';
import MapPicker from './MapPicker';
import ImageUpload from './ImageUpload';
import { ComplaintPriority } from '../types';
import { detectComplaintPriority } from '../services/priorityAI';
import { useDebounce } from '../hooks/useDebounce';

interface StudentPortalProps {
  profile: UserProfile;
}

const CATEGORIES: ComplaintCategory[] = ["Maintenance", "Academic", "Security", "Administrative", "Other"];

export default function StudentPortal({ profile }: StudentPortalProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  
  // Form state
  const [category, setCategory] = useState<ComplaintCategory>("Maintenance");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [imageUrl, setImageUrl] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [priority, setPriority] = useState<ComplaintPriority>("Low");
  const [submitting, setSubmitting] = useState(false);
  const [isDetectingPriority, setIsDetectingPriority] = useState(false);
  const [priorityDetected, setPriorityDetected] = useState(false);

  // Withdrawal state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [complaintToWithdraw, setComplaintToWithdraw] = useState<Complaint | null>(null);
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const debouncedDescription = useDebounce(description, 500);

  useEffect(() => {
    const detectPriority = async () => {
      if (debouncedDescription.trim().length < 10 || isEmergency) {
        setPriorityDetected(false);
        return;
      }

      setIsDetectingPriority(true);
      try {
        const result = await detectComplaintPriority(debouncedDescription);
        setPriority(result.priority);
        setPriorityDetected(true);
      } catch (err) {
        console.error("Auto-priority detection failed", err);
      } finally {
        setIsDetectingPriority(false);
      }
    };

    detectPriority();
  }, [debouncedDescription, isEmergency]);

  useEffect(() => {
    const q = query(
      collection(db, 'complaints'),
      where('reporterUid', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'complaints');
    });

    return () => unsubscribe();
  }, [profile.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || (!location && lat === undefined)) return;

    setSubmitting(true);
    try {
      const actualPriority = isEmergency ? 'Critical' : priority;
      
      await addDoc(collection(db, 'complaints'), {
        reporterUid: profile.uid,
        reporterName: profile.displayName,
        category,
        description,
        location,
        lat: lat || null,
        lng: lng || null,
        imageUrl: imageUrl || null,
        isEmergency,
        status: 'Pending',
        priority: actualPriority,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsFormOpen(false);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'complaints');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setDescription("");
    setLocation("");
    setImageUrl("");
    setCategory("Maintenance");
    setIsEmergency(false);
    setPriority("Low");
    setLat(undefined);
    setLng(undefined);
  };

  const handleRate = async (complaintId: string, rating: number) => {
    try {
      await updateDoc(doc(db, 'complaints', complaintId), { rating });
      if (selectedComplaint?.id === complaintId) {
        setSelectedComplaint(prev => prev ? { ...prev, rating } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `complaints/${complaintId}`);
    }
  };

  const handleWithdraw = async () => {
    if (!complaintToWithdraw) return;

    setIsWithdrawing(true);
    try {
      await updateDoc(doc(db, 'complaints', complaintToWithdraw.id), {
        status: 'Withdrawn',
        withdrawnAt: serverTimestamp(),
        withdrawalReason: withdrawalReason || null,
        updatedAt: serverTimestamp(),
      });
      
      setIsWithdrawModalOpen(false);
      setComplaintToWithdraw(null);
      setWithdrawalReason("");
      
      // If the withdrawn complaint was the selected one, update it in UI
      if (selectedComplaint?.id === complaintToWithdraw.id) {
        setSelectedComplaint(prev => prev ? { ...prev, status: 'Withdrawn' } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `complaints/${complaintToWithdraw.id}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const filteredComplaints = complaints.filter(c => {
    const matchesSearch = c.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'In Progress': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Withdrawn': return 'bg-slate-100 text-slate-500 border-slate-200 grayscale';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Portal</h1>
          <p className="text-slate-500 font-medium">Track and manage your campus reports</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Filter className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
            >
              <option value="All">All Status</option>
              {["Pending", "Assigned", "In Progress", "Resolved", "Rejected"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New Report
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Search your complaints by location, category or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-100 rounded-3xl pl-12 pr-4 py-4 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 font-medium"
        />
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-bold text-lg text-slate-900">New Complaint</h2>
                </div>
                <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                
                {/* Emergency Toggle */}
                <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  isEmergency ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isEmergency ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-white text-slate-400'
                    }`}>
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${isEmergency ? 'text-rose-700' : 'text-slate-700'}`}>Emergency Mode</p>
                      <p className="text-[10px] text-slate-500">Auto-sets priority to Critical</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsEmergency(!isEmergency)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      isEmergency ? 'bg-rose-500' : 'bg-slate-300'
                    }`}
                  >
                    <motion.div 
                      animate={{ x: isEmergency ? 24 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                  <div className="relative">
                    <textarea 
                      required
                      rows={4}
                      placeholder="Describe the issue in detail..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold text-slate-700">Priority</label>
                      {isDetectingPriority && (
                        <span className="text-[10px] font-bold text-indigo-500 animate-pulse uppercase tracking-wider">AI detecting priority...</span>
                      )}
                      {priorityDetected && !isDetectingPriority && !isEmergency && (
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">AI detected priority</span>
                      )}
                    </div>
                    <select 
                      disabled={isEmergency}
                      value={isEmergency ? 'Critical' : priority}
                      onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                      className={`w-full border rounded-2xl px-4 py-3 outline-none transition-all text-sm font-medium ${
                        isEmergency 
                          ? 'bg-rose-100 border-rose-200 text-rose-700 cursor-not-allowed font-bold' 
                          : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500'
                      }`}
                    >
                      {["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Location Information</label>
                  <div className="relative mb-3">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      required
                      placeholder="Building name, Floor, Room number..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                    />
                  </div>
                  
                  <MapPicker onLocationSelect={(lat, lng) => { setLat(lat); setLng(lng); }} />
                </div>

                <ImageUpload onUploadComplete={setImageUrl} onClear={() => setImageUrl("")} />
                
                <div className="flex gap-3 pt-6 sticky bottom-0 bg-white pb-2">
                  <button 
                    type="button"
                    onClick={() => { setIsFormOpen(false); resetForm(); }}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 flex items-center justify-center gap-2 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-xl disabled:opacity-50 ${
                      isEmergency ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Submit Report
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Withdrawal Confirmation Modal */}
        {isWithdrawModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden p-8 border border-slate-100"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <XCircle className="w-8 h-8 text-rose-500" />
              </div>
              
              <h2 className="text-xl font-black text-slate-900 text-center mb-2 uppercase tracking-tight">Withdraw Report?</h2>
              <p className="text-slate-500 text-center text-sm mb-8 font-medium">
                Are you sure you want to withdraw this complaint? This action cannot be undone and will stop the resolution process.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Reason for Withdrawal (Optional)</label>
                  <textarea 
                    placeholder="E.g., Problem solved by itself, wrong building..."
                    value={withdrawalReason}
                    onChange={(e) => setWithdrawalReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-rose-500 transition-all resize-none h-24 font-medium"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={handleWithdraw}
                    disabled={isWithdrawing}
                    className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isWithdrawing ? "Processing..." : "Confirm Withdrawal"}
                  </button>
                  <button 
                    onClick={() => {
                      setIsWithdrawModalOpen(false);
                      setComplaintToWithdraw(null);
                      setWithdrawalReason("");
                    }}
                    className="w-full py-4 text-slate-400 font-bold text-sm uppercase tracking-widest hover:text-slate-600 transition-all"
                  >
                    Keep Report Active
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {selectedComplaint && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[80vh]"
            >
              <div className="flex-1 p-8 overflow-y-auto border-r border-slate-100">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(selectedComplaint.status)}`}>
                      {selectedComplaint.status}
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 mt-3">{selectedComplaint.category}</h2>
                  </div>
                  <button onClick={() => setSelectedComplaint(null)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <MapPin className="w-4 h-4" />
                    {selectedComplaint.location}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Description</p>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl">{selectedComplaint.description}</p>
                  </div>
                  {selectedComplaint.imageUrl && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Evidence Photo</p>
                      <img 
                        src={selectedComplaint.imageUrl} 
                        alt="Evidence" 
                        className="w-full h-64 object-cover rounded-2xl border border-slate-100 shadow-sm"
                        referrerPolicy="no-referrer"
                        onError={(e) => (e.currentTarget.src = "https://picsum.photos/seed/broken/800/400")}
                      />
                    </div>
                  )}
                  {selectedComplaint.status === 'Resolved' && (
                    <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                      <p className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                        How satisfied are you with the resolution?
                      </p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRate(selectedComplaint.id, star)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                              (selectedComplaint.rating || 0) >= star 
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 scale-110' 
                                : 'bg-white text-slate-300 border border-slate-200 hover:border-amber-300'
                            }`}
                          >
                            <Star className={`w-5 h-5 ${ (selectedComplaint.rating || 0) >= star ? 'fill-current' : '' }`} />
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-amber-600 mt-3 font-semibold uppercase tracking-wider">
                        {selectedComplaint.rating ? `You rated this: ${selectedComplaint.rating}/5` : 'Please rate to help us improve'}
                      </p>
                    </div>
                  )}
                  {selectedComplaint.status === 'Withdrawn' && (
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Withdrawal Information</p>
                      <p className="text-slate-600 text-sm font-medium italic">
                        "This complaint was withdrawn on {selectedComplaint.withdrawnAt?.toDate().toLocaleString()}."
                      </p>
                      {selectedComplaint.withdrawalReason && (
                        <p className="text-slate-500 text-xs mt-3 bg-white p-3 rounded-xl border border-slate-100">
                          Reason: {selectedComplaint.withdrawalReason}
                        </p>
                      )}
                    </div>
                  )}
                  {selectedComplaint.adminNotes && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Admin Response</p>
                      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                        <p className="text-indigo-700 text-sm italic">"{selectedComplaint.adminNotes}"</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-400 pt-4 border-t border-slate-50">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Reported: {selectedComplaint.createdAt?.toDate().toLocaleString()}</span>
                    {selectedComplaint.assignedToName && <span className="flex items-center gap-1"><User className="w-3 h-3" /> Assigned to: {selectedComplaint.assignedToName}</span>}
                  </div>
                </div>
              </div>

                <div className="w-full md:w-80 bg-white flex flex-col border-t md:border-t-0">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    Discussion
                  </h3>
                </div>
                <CommentSection 
                  complaintId={selectedComplaint.id} 
                  profile={profile} 
                  isReadOnly={selectedComplaint.status === 'Withdrawn'} 
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white h-48 rounded-3xl animate-pulse border border-slate-100" />
          ))
        ) : filteredComplaints.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No complaints found matching your filters.</p>
          </div>
        ) : (
          filteredComplaints.map((c) => (
            <motion.div 
              layout
              key={c.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setSelectedComplaint(c)}
              className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group cursor-pointer ${
                c.status === 'Withdrawn' ? 'opacity-60 grayscale-[0.5]' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(c.status)}`}>
                    {c.status}
                  </span>
                  {c.isEmergency && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white flex items-center gap-1 shadow-sm">
                      <ShieldAlert className="w-3 h-3" />
                      Emergency
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {c.createdAt?.toDate().toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1 flex items-center justify-between">
                {c.category}
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </h3>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-3">
                <MapPin className="w-3 h-3" />
                {c.location}
              </div>
              <p className="text-slate-600 text-sm line-clamp-2 mb-4 leading-relaxed">
                {c.description}
              </p>
              
              {/* Withdrawal Button */}
              {['Pending', 'In Progress'].includes(c.status) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setComplaintToWithdraw(c);
                    setIsWithdrawModalOpen(true);
                  }}
                  className="mb-4 w-full py-2 border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-colors"
                >
                  Withdraw Report
                </button>
              )}

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase">
                  <MessageSquare className="w-3 h-3" />
                  View Discussion
                </div>
                {c.priority && (
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Priority: {c.priority}</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function UserIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
