import { Timestamp } from 'firebase/firestore';

export type UserRole = 'student' | 'staff' | 'faculty' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  createdAt: Timestamp;
}

export type ComplaintStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Rejected' | 'Withdrawn';
export type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type ComplaintCategory = 'Maintenance' | 'Academic' | 'Security' | 'Administrative' | 'Other';

export interface Complaint {
  id: string;
  reporterUid: string;
  reporterName: string;
  category: ComplaintCategory;
  description: string;
  location: string;
  lat?: number;
  lng?: number;
  status: ComplaintStatus;
  priority?: ComplaintPriority;
  isEmergency?: boolean;
  assignedTo?: string;
  assignedToName?: string;
  adminNotes?: string;
  aiNote?: string;
  imageUrl?: string;
  rating?: number;
  withdrawalReason?: string;
  withdrawnAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Comment {
  id: string;
  complaintId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  parentId?: string; // For threaded replies
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  complaintId: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
}
