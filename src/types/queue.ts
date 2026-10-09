export type QueueStatus = 'active' | 'paused' | 'closed';

export type EntryStatus = 'waiting' | 'calling' | 'serving' | 'completed' | 'skipped' | 'cancelled';

export type BusinessType = 
  | 'clinic' 
  | 'dental' 
  | 'salon' 
  | 'barbershop' 
  | 'auto_repair' 
  | 'service_center' 
  | 'government' 
  | 'restaurant' 
  | 'retail' 
  | 'other';

export interface Business {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  businessType: BusinessType;
  logoUrl?: string;
  address?: string;
  phone?: string;
  createdAt: string;
  brandColor?: string;
}

export interface Counter {
  id: string;
  queueId: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  currentEntryId?: string;
}

export interface Queue {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  prefix: string; // e.g. "A", "B", or ""
  announcementTemplate?: string;
  scheduledFor?: string; // YYYY-MM-DD, optional future service date
  startNumber: number;
  nextNumber: number;
  currentNumber: number | null;
  currentEntryId: string | null;
  status: QueueStatus;
  averageServiceMinutes: number;
  allowEstimatedWait: boolean;
  maxQueueSize: number;
  allowCustomerCancel: boolean;
  enableSound: boolean;
  activeCounterId?: string;
  createdAt: string;
}

export interface QueueEntry {
  id: string;
  queueId: string;
  businessId: string;
  displayNumber: string; // e.g. "A23"
  sequenceNumber: number; // e.g. 23
  customerSessionId: string;
  customerName?: string;
  customerPhone?: string;
  status: EntryStatus;
  joinedAt: string;
  calledAt?: string;
  completedAt?: string;
  counterName?: string;
  counterId?: string;
  notes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  businessId: string;
  role: 'owner' | 'manager' | 'staff';
  createdAt: string;
}

export interface QueueAnalytics {
  queueId: string;
  date: string;
  totalVisitors: number;
  completedVisitors: number;
  skippedVisitors: number;
  cancelledVisitors: number;
  averageWaitMinutes: number;
  averageServiceMinutes: number;
  peakHour: string;
  hourlyVolume: { hour: string; count: number }[];
}

export interface AppState {
  businesses: Business[];
  currentBusinessId: string;
  queues: Queue[];
  counters: Counter[];
  entries: QueueEntry[];
  profiles: UserProfile[];
  currentUser: UserProfile | null;
}
