import { AppState, Business, Counter, Queue, QueueEntry, UserProfile, QueueAnalytics } from '../types/queue';

const STORAGE_KEY = 'queueturn_state_v1';
const SESSION_TICKET_KEY = 'queueturn_active_ticket_';

export const INITIAL_DEMO_BUSINESS: Business = {
  id: 'demo-biz-1',
  name: 'ABC Clinic',
  slug: 'abc-clinic',
  ownerName: 'Dr. Sarah Jenkins',
  ownerEmail: 'sarah@abcclinic.example',
  businessType: 'clinic',
  address: '742 Evergreen Terrace, Suite 101, Springfield',
  phone: '(555) 234-5678',
  createdAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
  brandColor: '#2563eb',
};

export const INITIAL_DEMO_QUEUE: Queue = {
  id: 'demo-queue-1',
  businessId: 'demo-biz-1',
  name: 'General Service',
  slug: 'general-service',
  prefix: 'A',
  startNumber: 21,
  nextNumber: 27,
  currentNumber: 23,
  currentEntryId: 'entry-a23',
  status: 'active',
  averageServiceMinutes: 8,
  allowEstimatedWait: true,
  maxQueueSize: 50,
  allowCustomerCancel: true,
  enableSound: true,
  activeCounterId: 'demo-counter-1',
  createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
};

export const INITIAL_DEMO_COUNTERS: Counter[] = [
  {
    id: 'demo-counter-1',
    queueId: 'demo-queue-1',
    name: 'Counter 1 (Dr. Jenkins)',
    status: 'busy',
    currentEntryId: 'entry-a23',
  },
  {
    id: 'demo-counter-2',
    queueId: 'demo-queue-1',
    name: 'Counter 2 (Check-in Desk)',
    status: 'available',
  },
];

const now = Date.now();

export const INITIAL_DEMO_ENTRIES: QueueEntry[] = [
  {
    id: 'entry-a21',
    queueId: 'demo-queue-1',
    businessId: 'demo-biz-1',
    displayNumber: 'A21',
    sequenceNumber: 21,
    customerSessionId: 'sess-a21',
    customerName: 'Marcus Vance',
    status: 'completed',
    joinedAt: new Date(now - 45 * 60000).toISOString(),
    calledAt: new Date(now - 35 * 60000).toISOString(),
    completedAt: new Date(now - 25 * 60000).toISOString(),
    counterName: 'Counter 1 (Dr. Jenkins)',
  },
  {
    id: 'entry-a22',
    queueId: 'demo-queue-1',
    businessId: 'demo-biz-1',
    displayNumber: 'A22',
    sequenceNumber: 22,
    customerSessionId: 'sess-a22',
    customerName: 'Elena Rostova',
    status: 'completed',
    joinedAt: new Date(now - 38 * 60000).toISOString(),
    calledAt: new Date(now - 24 * 60000).toISOString(),
    completedAt: new Date(now - 12 * 60000).toISOString(),
    counterName: 'Counter 1 (Dr. Jenkins)',
  },
  {
    id: 'entry-a23',
    queueId: 'demo-queue-1',
    businessId: 'demo-biz-1',
    displayNumber: 'A23',
    sequenceNumber: 23,
    customerSessionId: 'sess-a23',
    customerName: 'David Kim',
    status: 'serving',
    joinedAt: new Date(now - 30 * 60000).toISOString(),
    calledAt: new Date(now - 8 * 60000).toISOString(),
    counterName: 'Counter 1 (Dr. Jenkins)',
    counterId: 'demo-counter-1',
  },
  {
    id: 'entry-a24',
    queueId: 'demo-queue-1',
    businessId: 'demo-biz-1',
    displayNumber: 'A24',
    sequenceNumber: 24,
    customerSessionId: 'sess-a24',
    customerName: 'Sophia Martinez',
    status: 'waiting',
    joinedAt: new Date(now - 22 * 60000).toISOString(),
  },
  {
    id: 'entry-a25',
    queueId: 'demo-queue-1',
    businessId: 'demo-biz-1',
    displayNumber: 'A25',
    sequenceNumber: 25,
    customerSessionId: 'sess-a25',
    customerName: 'James Wilson',
    status: 'waiting',
    joinedAt: new Date(now - 15 * 60000).toISOString(),
  },
  {
    id: 'entry-a26',
    queueId: 'demo-queue-1',
    businessId: 'demo-biz-1',
    displayNumber: 'A26',
    sequenceNumber: 26,
    customerSessionId: 'sess-a26',
    customerName: 'Amara Chen',
    status: 'waiting',
    joinedAt: new Date(now - 7 * 60000).toISOString(),
  },
];

export const INITIAL_DEMO_USER: UserProfile = {
  id: 'usr-sarah-1',
  name: 'Dr. Sarah Jenkins',
  email: 'sarah@abcclinic.example',
  businessId: 'demo-biz-1',
  role: 'owner',
  createdAt: new Date().toISOString(),
};

export const INITIAL_STATE: AppState = {
  businesses: [INITIAL_DEMO_BUSINESS],
  currentBusinessId: 'demo-biz-1',
  queues: [INITIAL_DEMO_QUEUE],
  counters: INITIAL_DEMO_COUNTERS,
  entries: INITIAL_DEMO_ENTRIES,
  profiles: [
    INITIAL_DEMO_USER,
    {
      id: 'usr-alex-2',
      name: 'Alex Rivera',
      email: 'alex@abcclinic.example',
      businessId: 'demo-biz-1',
      role: 'staff',
      createdAt: new Date().toISOString(),
    },
  ],
  currentUser: INITIAL_DEMO_USER,
};

export function loadStoredState(): AppState {
  if (typeof window === 'undefined') return INITIAL_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveStoredState(INITIAL_STATE);
      return INITIAL_STATE;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.businesses || !parsed.queues || !parsed.entries) {
      return INITIAL_STATE;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load storage state:', err);
    return INITIAL_STATE;
  }
}

export function saveStoredState(state: AppState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save storage state:', err);
  }
}

export function resetToDemoState(): AppState {
  saveStoredState(INITIAL_STATE);
  return INITIAL_STATE;
}

// Active customer session preservation
export function getSavedCustomerSession(queueId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_TICKET_KEY + queueId);
}

export function saveCustomerSession(queueId: string, entryId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_TICKET_KEY + queueId, entryId);
}

export function clearCustomerSession(queueId: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_TICKET_KEY + queueId);
}
