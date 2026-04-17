/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  FirebaseUser,
  handleFirestoreError,
  OperationType
} from './firebase';
import { UserProfile, UserRole } from './types';
import Navbar from './components/Navbar';
import StudentPortal from './components/StudentPortal';
import AdminDashboard from './components/AdminDashboard';
import Chatbot from './components/Chatbot';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ADMIN_EMAIL = "obeidfaheem@gmail.com";
  const [loginTab, setLoginTab] = useState<'student' | 'admin'>('student');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (profileDoc.exists()) {
            setProfile(profileDoc.data() as UserProfile);
          } else {
            // Create default profile for new users
            const newProfile: Partial<UserProfile> = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Anonymous',
              photoURL: firebaseUser.photoURL || '',
              role: firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'student',
              createdAt: serverTimestamp() as any,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile as UserProfile);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          setError('Failed to load user profile.');
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to sign in with Google.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar user={user} profile={profile} onLogin={handleLogin} onLogout={handleLogout} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-12 md:py-20 text-center"
            >
              <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-100 max-w-md w-full border border-slate-100 overflow-hidden">
                {/* Login Tabs */}
                <div className="flex border-b border-slate-100">
                  <button 
                    onClick={() => setLoginTab('student')}
                    className={`flex-1 py-4 text-sm font-bold transition-all ${loginTab === 'student' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Student Portal
                  </button>
                  <button 
                    onClick={() => setLoginTab('admin')}
                    className={`flex-1 py-4 text-sm font-bold transition-all ${loginTab === 'admin' ? 'text-rose-600 border-b-2 border-rose-600 bg-rose-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Staff & Admin
                  </button>
                </div>

                <div className="p-8">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-colors ${loginTab === 'admin' ? 'bg-rose-100' : 'bg-indigo-100'}`}>
                    <ShieldAlert className={`w-8 h-8 ${loginTab === 'admin' ? 'text-rose-600' : 'text-indigo-600'}`} />
                  </div>
                  
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Campus Care</h1>
                  <p className="text-slate-500 text-sm mb-8">
                    {loginTab === 'admin' 
                      ? 'Secure access for campus administrators and maintenance staff.' 
                      : 'The official platform for students to report campus issues.'}
                  </p>

                  <button
                    onClick={handleLogin}
                    className={`w-full text-white py-4 px-6 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3 ${
                      loginTab === 'admin' 
                        ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-200' 
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                    }`}
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5 bg-white rounded-full p-0.5" />
                    Sign in with Google
                  </button>

                  <div className="mt-8 pt-6 border-t border-slate-50">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                      {loginTab === 'admin' ? 'Authorized Personnel Only' : 'Student & Faculty Access'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div key={profile?.role}>
              {profile?.role === 'admin' || profile?.role === 'staff' ? (
                <AdminDashboard profile={profile} />
              ) : (
                <StudentPortal profile={profile!} />
              )}
              <Chatbot />
            </div>
          )}
        </AnimatePresence>
      </main>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <ShieldAlert className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 font-bold">&times;</button>
        </div>
      )}
    </div>
  );
}
