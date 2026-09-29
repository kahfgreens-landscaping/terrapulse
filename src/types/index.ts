// src/types/index.ts
// ─────────────────────────────────────────────────────────────
// Shared TypeScript interfaces for TerraPulse
// ─────────────────────────────────────────────────────────────

export type UserRole = 'client' | 'pm' | 'admin' | 'crew';

export interface User {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  propertyAddress?: string;
  propertyType?: 'residential' | 'commercial' | 'hoa';
  onboardingComplete: boolean;
  createdAt: string;
}

export type ProjectStatus =
  | 'inquiry'
  | 'design'
  | 'approval'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'on_hold';

export interface ProjectPhase {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  startDate?: string;
  endDate?: string;
  estimatedEndDate?: string;
  notes?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  pmId: string;
  pmName?: string;
  pmEmail?: string;
  pmPhone?: string;
  crewIds: string[];
  status: ProjectStatus;
  phases: ProjectPhase[];
  address: string;
  budget?: number;
  startDate?: string;
  estimatedEndDate?: string;
  actualEndDate?: string;
  tags: string[];
  coverPhoto?: string;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRequest {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  propertyAddress: string;
  propertyType: 'residential' | 'commercial' | 'hoa';
  projectTitle: string;
  serviceType: string;
  description: string;
  budgetRange: string;
  urgency: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export type DesignStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export interface DesignAnnotation {
  id: string;
  x: number; // percentage
  y: number; // percentage
  comment: string;
  author: string;
  createdAt: string;
}

export interface Design {
  id: string;
  projectId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  title: string;
  version: number;
  status: DesignStatus;
  annotations: DesignAnnotation[];
  uploadedBy: string;
  uploadedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  clientNote?: string;
  signatureDataUrl?: string;
}

export type PhotoType = 'before' | 'during' | 'after' | 'progress' | 'reference';

export interface ProjectPhoto {
  id: string;
  projectId: string;
  url: string;
  thumbnailUrl?: string;
  type: PhotoType;
  phase?: string;
  caption?: string;
  gps?: { lat: number; lng: number };
  takenBy: string;
  takenAt: string;
  approved: boolean;
  approvedBy?: string;
}

export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  attachments?: { name: string; url: string; type: string }[];
  category?: 'general' | 'idea' | 'modification' | 'update';
  readBy: string[];
  createdAt: string;
  isSystemMessage?: boolean;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  projectId: string;
  clientId: string;
  invoiceNumber: string;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
  amount: number;
  tax?: number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string;
  stripePaymentIntentId?: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  name: string;
  type: 'contract' | 'estimate' | 'permit' | 'invoice' | 'other';
  url: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export type MaintenanceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';

export interface MaintenanceSchedule {
  id: string;
  clientId: string;
  projectId?: string;
  type: string;
  description?: string;
  frequency: MaintenanceFrequency;
  nextDate: string;
  crewId?: string;
  crewName?: string;
  completedAt?: string;
  photoProof?: string;
  weatherCancelled?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'project_assigned' | 'message' | 'design' | 'invoice' | 'milestone' | 'crew' | 'system';
  projectId?: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface Review {
  id: string;
  projectId: string;
  clientId: string;
  npsScore: number; // 0-10
  starRating: number; // 1-5
  comment?: string;
  createdAt: string;
  publishedToSite: boolean;
}
