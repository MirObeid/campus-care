import React, { useState, useRef } from 'react';
import { storage, ref, uploadBytes, getDownloadURL } from '../firebase';
import { ImageIcon, X, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onClear: () => void;
  folder?: string;
}

export default function ImageUpload({ onUploadComplete, onClear, folder = 'complaints' }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Firebase
    setUploading(true);
    setError(null);
    try {
      const storageRef = ref(storage, `${folder}/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      onUploadComplete(downloadURL);
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setError(null);
    onClear();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">Evidence Photo</label>
      
      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-600">Click to upload photo</p>
              <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG or GIF (max 5MB)</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-video shadow-sm group"
          >
            <img 
              src={preview} 
              alt="Preview" 
              className={`w-full h-full object-cover transition-opacity ${uploading ? 'opacity-40' : 'opacity-100'}`}
            />
            
            {uploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/10 backdrop-blur-[1px]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-slate-900">Uploading...</p>
              </div>
            )}

            {!uploading && (
              <>
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 bg-rose-500 text-white rounded-lg shadow-lg hover:bg-rose-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Upload Ready
                </div>
              </>
            )}

            {error && (
              <div className="absolute inset-0 bg-rose-50/90 flex flex-col items-center justify-center p-4 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                <p className="text-xs font-bold text-rose-900">{error}</p>
                <button 
                  onClick={handleClear}
                  className="mt-2 text-[10px] font-bold text-rose-600 underline"
                >
                  Try again
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
