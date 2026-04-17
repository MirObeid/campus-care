import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import { Comment, UserProfile } from '../types';
import { Send, User as UserIcon, Clock, Reply, X } from 'lucide-react';
import { motion } from 'motion/react';

interface CommentSectionProps {
  complaintId: string;
  profile: UserProfile;
  isReadOnly?: boolean;
}

export default function CommentSection({ complaintId, profile, isReadOnly = false }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('complaintId', '==', complaintId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'comments');
    });

    return () => unsubscribe();
  }, [complaintId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting || isReadOnly) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'comments'), {
        complaintId,
        userId: profile.uid,
        userName: profile.displayName,
        userPhoto: profile.photoURL,
        text: newComment.trim(),
        parentId: replyTo?.id || null,
        createdAt: serverTimestamp(),
      });
      setNewComment("");
      setReplyTo(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'comments');
    } finally {
      setSubmitting(false);
    }
  };

  const mainComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
        {mainComments.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">
            No comments yet. Start the conversation.
          </div>
        ) : (
          mainComments.map((c) => (
            <div key={c.id} className="space-y-3">
              <div className={`flex gap-3 ${c.userId === profile.uid ? 'flex-row-reverse' : ''}`}>
                <img 
                  src={c.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`} 
                  alt={c.userName} 
                  className="w-8 h-8 rounded-full flex-shrink-0 border border-slate-100"
                  referrerPolicy="no-referrer"
                />
                <div className={`max-w-[80%] ${c.userId === profile.uid ? 'items-end' : 'items-start'} flex flex-col group`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{c.userName}</span>
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-2 h-2" />
                      {c.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl text-sm relative ${
                    c.userId === profile.uid 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-slate-100 text-slate-800 rounded-tl-none'
                  }`}>
                    {c.text}
                    {!isReadOnly && (
                      <button 
                        onClick={() => setReplyTo(c)} 
                        className={`absolute -bottom-5 text-[9px] font-bold uppercase transition-opacity flex items-center gap-1 opacity-0 group-hover:opacity-100 ${
                          c.userId === profile.uid ? 'right-0 text-indigo-400' : 'left-0 text-slate-400'
                        } hover:text-indigo-600`}
                      >
                        <Reply className="w-3 h-3" />
                        Reply
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Replies */}
              {getReplies(c.id).map(r => (
                <div key={r.id} className={`flex gap-2 ml-10 ${r.userId === profile.uid ? 'flex-row-reverse' : ''}`}>
                  <img 
                    src={r.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.userId}`} 
                    alt={r.userName} 
                    className="w-6 h-6 rounded-full flex-shrink-0 border border-slate-50"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`max-w-[80%] ${r.userId === profile.uid ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{r.userName}</span>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl text-[13px] ${
                      r.userId === profile.uid 
                        ? 'bg-indigo-500 text-white rounded-tr-none' 
                        : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none'
                    }`}>
                      {r.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      {!isReadOnly ? (
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 bg-slate-50/50">
          {replyTo && (
            <div className="mb-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
              <p className="text-[10px] text-indigo-700 font-medium">
                Replying to <span className="font-bold">{replyTo.userName}</span>
              </p>
              <button onClick={() => setReplyTo(null)} className="text-indigo-400 hover:text-indigo-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="relative">
            <input 
              type="text"
              placeholder={replyTo ? "Write a reply..." : "Write a message..."}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-full pl-4 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            <button 
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discussions Locked for Withdrawn Report</p>
        </div>
      )}
    </div>
  );
}
