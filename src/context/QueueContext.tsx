import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, Business, Counter, Queue, QueueEntry, UserProfile, EntryStatus, BusinessType } from '../types/queue';
import { 
  loadStoredState, 
  saveStoredState, 
  resetToDemoState, 
  getSavedCustomerSession, 
  saveCustomerSession, 
  clearCustomerSession 
} from '../services/storage';
import { realtimeService, RealtimeMessage } from '../services/realtime';
import { soundService } from '../services/sound';
import { notificationService } from '../services/notifications';

interface QueueContextType {
  state: AppState;
  currentBusiness: Business | null;
  activeQueue: Queue | null;
  queues: Queue[];
  counters: Counter[];
  entries: QueueEntry[];
  waitingEntries: QueueEntry[];
  servingEntry: QueueEntry | null;
  completedEntries: QueueEntry[];
  skippedEntries: QueueEntry[];
  currentUser: UserProfile | null;
  
  // Navigation / Selection
  setCurrentBusinessId: (id: string) => void;
  setActiveQueueId: (id: string) => void;
  setCurrentUser: (user: UserProfile | null) => void;
  
  // Queue Control
  callNext: (queueId: string, counterId?: string) => Promise<QueueEntry | null>;
  callSpecific: (entryId: string, counterId?: string) => void;
  skipEntry: (entryId: string) => void;
  removeEntry: (entryId: string) => void;
  completeEntry: (entryId: string) => void;
  pauseQueue: (queueId: string) => void;
  resumeQueue: (queueId: string) => void;
  resetQueue: (queueId: string) => void;
  addWalkIn: (queueId: string, name?: string, phone?: string, notes?: string) => QueueEntry;
  
  // Customer Experience
  joinQueue: (queueId: string, customerName?: string, customerPhone?: string) => Promise<QueueEntry>;
  leaveQueue: (queueId: string, entryId: string) => void;
  getCustomerActiveEntry: (queueId: string) => QueueEntry | null;
  calculatePosition: (queueId: string, entryId: string) => { peopleAhead: number; estimatedWaitMinutes: number };

  // Business & Queue Management
  createBusiness: (data: { name: string; ownerName: string; email: string; businessType: BusinessType }) => Business;
  createQueue: (data: { businessId: string; name: string; prefix: string; startNumber: number; averageServiceMinutes: number; allowEstimatedWait: boolean }) => Queue;
  updateQueueSettings: (queueId: string, updates: Partial<Queue>) => void;
  updateBusinessSettings: (businessId: string, updates: Partial<Business>) => void;
  addCounter: (queueId: string, name: string) => void;
  removeCounter: (counterId: string) => void;

  // Utilities
  resetDemoData: () => void;
  getAnalytics: (queueId: string) => {
    totalToday: number;
    completed: number;
    skipped: number;
    waiting: number;
    avgWaitMinutes: number;
    avgServiceMinutes: number;
    peakHour: string;
    hourlyVolume: { hour: string; count: number }[];
  };
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => loadStoredState());
  const [activeQueueId, setActiveQueueIdState] = useState<string>('');

  // Sync state with storage changes
  const updateStateAndPersist = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveStoredState(next);
      return next;
    });
  }, []);

  // Set default active queue on mount or business switch
  useEffect(() => {
    const businessQueues = state.queues.filter((q) => q.businessId === state.currentBusinessId);
    if (businessQueues.length > 0 && (!activeQueueId || !businessQueues.some((q) => q.id === activeQueueId))) {
      setActiveQueueIdState(businessQueues[0].id);
    }
  }, [state.currentBusinessId, state.queues, activeQueueId]);

  // Subscribe to real-time events across tabs & windows
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((msg: RealtimeMessage) => {
      // Reload state from local storage or handle update
      const latest = loadStoredState();
      setState(latest);

      // Check if user has an active session ticket on this browser that was called
      const currentActiveTicketId = getSavedCustomerSession(msg.queueId);
      if (currentActiveTicketId && msg.type === 'NEXT_CUSTOMER_CALLED') {
        const entry = latest.entries.find((e) => e.id === currentActiveTicketId);
        if (entry) {
          if (entry.status === 'serving') {
            notificationService.notifyYourTurn(entry.displayNumber, entry.counterName);
          } else if (entry.status === 'waiting') {
            // Check people ahead
            const waitingInQueue = latest.entries.filter((e) => e.queueId === msg.queueId && e.status === 'waiting');
            const index = waitingInQueue.findIndex((e) => e.id === currentActiveTicketId);
            if (index === 0 || index === 1) {
              notificationService.notifyAlmostUp(entry.displayNumber, index);
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const currentBusiness = useMemo(() => {
    return state.businesses.find((b) => b.id === state.currentBusinessId) || state.businesses[0] || null;
  }, [state.businesses, state.currentBusinessId]);

  const queues = useMemo(() => {
    if (!currentBusiness) return [];
    return state.queues.filter((q) => q.businessId === currentBusiness.id);
  }, [state.queues, currentBusiness]);

  const activeQueue = useMemo(() => {
    return queues.find((q) => q.id === activeQueueId) || queues[0] || null;
  }, [queues, activeQueueId]);

  const counters = useMemo(() => {
    if (!activeQueue) return [];
    return state.counters.filter((c) => c.queueId === activeQueue.id);
  }, [state.counters, activeQueue]);

  const activeQueueEntries = useMemo(() => {
    if (!activeQueue) return [];
    return state.entries.filter((e) => e.queueId === activeQueue.id);
  }, [state.entries, activeQueue]);

  const waitingEntries = useMemo(() => {
    return activeQueueEntries.filter((e) => e.status === 'waiting');
  }, [activeQueueEntries]);

  const servingEntry = useMemo(() => {
    return activeQueueEntries.find((e) => e.status === 'serving') || null;
  }, [activeQueueEntries]);

  const completedEntries = useMemo(() => {
    return activeQueueEntries.filter((e) => e.status === 'completed');
  }, [activeQueueEntries]);

  const skippedEntries = useMemo(() => {
    return activeQueueEntries.filter((e) => e.status === 'skipped');
  }, [activeQueueEntries]);

  // Actions
  const setCurrentBusinessId = useCallback((id: string) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      currentBusinessId: id,
    }));
  }, [updateStateAndPersist]);

  const setActiveQueueId = useCallback((id: string) => {
    setActiveQueueIdState(id);
  }, []);

  const setCurrentUser = useCallback((user: UserProfile | null) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      currentUser: user,
    }));
  }, [updateStateAndPersist]);

  // ADVANCE QUEUE / NEXT CUSTOMER
  const callNext = useCallback(async (queueId: string, counterId?: string): Promise<QueueEntry | null> => {
    let nextCustomerEntry: QueueEntry | null = null;

    updateStateAndPersist((prev) => {
      const queue = prev.queues.find((q) => q.id === queueId);
      if (!queue) return prev;

      const targetCounter = counterId 
        ? prev.counters.find((c) => c.id === counterId)
        : prev.counters.find((c) => c.queueId === queueId && c.id === queue.activeCounterId) || prev.counters.find((c) => c.queueId === queueId);

      const counterName = targetCounter ? targetCounter.name : 'Counter 1';

      // 1. Current serving becomes completed
      const updatedEntries = prev.entries.map((entry) => {
        if (entry.queueId === queueId && entry.status === 'serving') {
          return {
            ...entry,
            status: 'completed' as EntryStatus,
            completedAt: new Date().toISOString(),
          };
        }
        return entry;
      });

      // 2. Find next waiting customer
      const waitingList = updatedEntries.filter((e) => e.queueId === queueId && e.status === 'waiting');
      
      let newCurrentNumber: number | null = null;
      let newCurrentEntryId: string | null = null;

      if (waitingList.length > 0) {
        const nextCustomer = waitingList[0];
        nextCustomerEntry = {
          ...nextCustomer,
          status: 'serving' as EntryStatus,
          calledAt: new Date().toISOString(),
          counterName: counterName,
          counterId: targetCounter?.id,
        };

        const finalEntries = updatedEntries.map((e) => e.id === nextCustomer.id ? nextCustomerEntry! : e);
        newCurrentNumber = nextCustomer.sequenceNumber;
        newCurrentEntryId = nextCustomer.id;

        const updatedQueues = prev.queues.map((q) => {
          if (q.id === queueId) {
            return {
              ...q,
              currentNumber: newCurrentNumber,
              currentEntryId: newCurrentEntryId,
            };
          }
          return q;
        });

        const updatedCounters = prev.counters.map((c) => {
          if (targetCounter && c.id === targetCounter.id) {
            return { ...c, status: 'busy' as const, currentEntryId: nextCustomer.id };
          }
          return c;
        });

        return {
          ...prev,
          queues: updatedQueues,
          entries: finalEntries,
          counters: updatedCounters,
        };
      } else {
        // No one waiting
        const updatedQueues = prev.queues.map((q) => {
          if (q.id === queueId) {
            return {
              ...q,
              currentEntryId: null,
            };
          }
          return q;
        });

        return {
          ...prev,
          queues: updatedQueues,
          entries: updatedEntries,
        };
      }
    });

    if (nextCustomerEntry) {
      const entry = nextCustomerEntry as QueueEntry;
      soundService.announceTurn(entry.displayNumber, entry.counterName);
      realtimeService.broadcast({
        type: 'NEXT_CUSTOMER_CALLED',
        queueId,
        data: { entryId: entry.id, displayNumber: entry.displayNumber, counterName: entry.counterName },
      });
    } else {
      realtimeService.broadcast({
        type: 'QUEUE_UPDATED',
        queueId,
      });
    }

    return nextCustomerEntry;
  }, [updateStateAndPersist]);

  const callSpecific = useCallback((entryId: string, counterId?: string) => {
    let calledEntry: QueueEntry | null = null;
    updateStateAndPersist((prev) => {
      const entry = prev.entries.find((e) => e.id === entryId);
      if (!entry) return prev;

      const targetCounter = counterId 
        ? prev.counters.find((c) => c.id === counterId)
        : prev.counters.find((c) => c.queueId === entry.queueId);

      const counterName = targetCounter ? targetCounter.name : 'Counter 1';

      // Mark any other serving in this queue as completed or keep
      const updatedEntries = prev.entries.map((e) => {
        if (e.id === entryId) {
          calledEntry = {
            ...e,
            status: 'serving' as EntryStatus,
            calledAt: new Date().toISOString(),
            counterName,
            counterId: targetCounter?.id,
          };
          return calledEntry;
        }
        if (e.queueId === entry.queueId && e.status === 'serving') {
          return { ...e, status: 'completed' as EntryStatus, completedAt: new Date().toISOString() };
        }
        return e;
      });

      const updatedQueues = prev.queues.map((q) => {
        if (q.id === entry.queueId) {
          return { ...q, currentNumber: entry.sequenceNumber, currentEntryId: entry.id };
        }
        return q;
      });

      return {
        ...prev,
        entries: updatedEntries,
        queues: updatedQueues,
      };
    });

    if (calledEntry) {
      const target = calledEntry as QueueEntry;
      soundService.announceTurn(target.displayNumber, target.counterName);
      realtimeService.broadcast({
        type: 'NEXT_CUSTOMER_CALLED',
        queueId: target.queueId,
        data: { entryId: target.id, displayNumber: target.displayNumber, counterName: target.counterName },
      });
    }
  }, [updateStateAndPersist]);

  const skipEntry = useCallback((entryId: string) => {
    let targetQueueId = '';
    updateStateAndPersist((prev) => {
      const entry = prev.entries.find((e) => e.id === entryId);
      if (!entry) return prev;
      targetQueueId = entry.queueId;

      const updatedEntries = prev.entries.map((e) => {
        if (e.id === entryId) {
          return { ...e, status: 'skipped' as EntryStatus };
        }
        return e;
      });

      // If the skipped customer was currently serving, clear currentEntryId
      const updatedQueues = prev.queues.map((q) => {
        if (q.id === targetQueueId && q.currentEntryId === entryId) {
          return { ...q, currentEntryId: null };
        }
        return q;
      });

      return {
        ...prev,
        entries: updatedEntries,
        queues: updatedQueues,
      };
    });

    if (targetQueueId) {
      realtimeService.broadcast({
        type: 'ENTRY_SKIPPED',
        queueId: targetQueueId,
        data: { entryId },
      });
    }
  }, [updateStateAndPersist]);

  const removeEntry = useCallback((entryId: string) => {
    let targetQueueId = '';
    updateStateAndPersist((prev) => {
      const entry = prev.entries.find((e) => e.id === entryId);
      if (!entry) return prev;
      targetQueueId = entry.queueId;

      const updatedEntries = prev.entries.map((e) => {
        if (e.id === entryId) {
          return { ...e, status: 'cancelled' as EntryStatus };
        }
        return e;
      });

      const updatedQueues = prev.queues.map((q) => {
        if (q.id === targetQueueId && q.currentEntryId === entryId) {
          return { ...q, currentEntryId: null };
        }
        return q;
      });

      return {
        ...prev,
        entries: updatedEntries,
        queues: updatedQueues,
      };
    });

    if (targetQueueId) {
      realtimeService.broadcast({
        type: 'ENTRY_REMOVED',
        queueId: targetQueueId,
        data: { entryId },
      });
    }
  }, [updateStateAndPersist]);

  const completeEntry = useCallback((entryId: string) => {
    let targetQueueId = '';
    updateStateAndPersist((prev) => {
      const entry = prev.entries.find((e) => e.id === entryId);
      if (!entry) return prev;
      targetQueueId = entry.queueId;

      const updatedEntries = prev.entries.map((e) => {
        if (e.id === entryId) {
          return { ...e, status: 'completed' as EntryStatus, completedAt: new Date().toISOString() };
        }
        return e;
      });

      const updatedQueues = prev.queues.map((q) => {
        if (q.id === targetQueueId && q.currentEntryId === entryId) {
          return { ...q, currentEntryId: null };
        }
        return q;
      });

      return {
        ...prev,
        entries: updatedEntries,
        queues: updatedQueues,
      };
    });

    if (targetQueueId) {
      realtimeService.broadcast({
        type: 'ENTRY_COMPLETED',
        queueId: targetQueueId,
        data: { entryId },
      });
    }
  }, [updateStateAndPersist]);

  const pauseQueue = useCallback((queueId: string) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      queues: prev.queues.map((q) => (q.id === queueId ? { ...q, status: 'paused' as const } : q)),
    }));
    realtimeService.broadcast({
      type: 'QUEUE_PAUSED',
      queueId,
    });
  }, [updateStateAndPersist]);

  const resumeQueue = useCallback((queueId: string) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      queues: prev.queues.map((q) => (q.id === queueId ? { ...q, status: 'active' as const } : q)),
    }));
    realtimeService.broadcast({
      type: 'QUEUE_RESUMED',
      queueId,
    });
  }, [updateStateAndPersist]);

  const resetQueue = useCallback((queueId: string) => {
    updateStateAndPersist((prev) => {
      const queue = prev.queues.find((q) => q.id === queueId);
      if (!queue) return prev;

      const updatedQueues = prev.queues.map((q) => {
        if (q.id === queueId) {
          return {
            ...q,
            nextNumber: q.startNumber,
            currentNumber: null,
            currentEntryId: null,
          };
        }
        return q;
      });

      // Mark all currently waiting or serving as completed/reset
      const updatedEntries = prev.entries.map((e) => {
        if (e.queueId === queueId && (e.status === 'waiting' || e.status === 'serving')) {
          return { ...e, status: 'completed' as EntryStatus, completedAt: new Date().toISOString() };
        }
        return e;
      });

      return {
        ...prev,
        queues: updatedQueues,
        entries: updatedEntries,
      };
    });

    realtimeService.broadcast({
      type: 'QUEUE_RESET',
      queueId,
    });
  }, [updateStateAndPersist]);

  // CUSTOMER JOIN QUEUE
  const joinQueue = useCallback(async (queueId: string, customerName?: string, customerPhone?: string): Promise<QueueEntry> => {
    let createdEntry: QueueEntry | null = null;

    updateStateAndPersist((prev) => {
      const queue = prev.queues.find((q) => q.id === queueId);
      if (!queue) throw new Error('Queue not found');

      const seq = queue.nextNumber;
      const displayNumber = queue.prefix ? `${queue.prefix}${seq}` : `${seq}`;
      const sessionId = 'sess_' + Math.random().toString(36).substring(2, 10);

      createdEntry = {
        id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        queueId: queue.id,
        businessId: queue.businessId,
        displayNumber,
        sequenceNumber: seq,
        customerSessionId: sessionId,
        customerName: customerName?.trim() || undefined,
        customerPhone: customerPhone?.trim() || undefined,
        status: 'waiting',
        joinedAt: new Date().toISOString(),
      };

      const updatedQueues = prev.queues.map((q) => {
        if (q.id === queueId) {
          return { ...q, nextNumber: q.nextNumber + 1 };
        }
        return q;
      });

      return {
        ...prev,
        queues: updatedQueues,
        entries: [...prev.entries, createdEntry],
      };
    });

    if (!createdEntry) throw new Error('Failed to create entry');
    const entry = createdEntry as QueueEntry;

    // Save session locally for customer retention
    saveCustomerSession(queueId, entry.id);

    realtimeService.broadcast({
      type: 'CUSTOMER_JOINED',
      queueId,
      data: entry,
    });

    return entry;
  }, [updateStateAndPersist]);

  const leaveQueue = useCallback((queueId: string, entryId: string) => {
    removeEntry(entryId);
    clearCustomerSession(queueId);
  }, [removeEntry]);

  const addWalkIn = useCallback((queueId: string, name?: string, phone?: string, notes?: string): QueueEntry => {
    let createdEntry: QueueEntry | null = null;
    updateStateAndPersist((prev) => {
      const queue = prev.queues.find((q) => q.id === queueId);
      if (!queue) return prev;

      const seq = queue.nextNumber;
      const displayNumber = queue.prefix ? `${queue.prefix}${seq}` : `${seq}`;

      createdEntry = {
        id: 'entry_walkin_' + Date.now(),
        queueId,
        businessId: queue.businessId,
        displayNumber,
        sequenceNumber: seq,
        customerSessionId: 'walkin_' + Date.now(),
        customerName: name?.trim() || 'Walk-in Guest',
        customerPhone: phone?.trim(),
        notes: notes?.trim(),
        status: 'waiting',
        joinedAt: new Date().toISOString(),
      };

      const updatedQueues = prev.queues.map((q) => {
        if (q.id === queueId) {
          return { ...q, nextNumber: q.nextNumber + 1 };
        }
        return q;
      });

      return {
        ...prev,
        queues: updatedQueues,
        entries: [...prev.entries, createdEntry!],
      };
    });

    const entry = createdEntry as unknown as QueueEntry;
    realtimeService.broadcast({
      type: 'CUSTOMER_JOINED',
      queueId,
      data: entry,
    });
    return entry;
  }, [updateStateAndPersist]);

  const getCustomerActiveEntry = useCallback((queueId: string): QueueEntry | null => {
    const entryId = getSavedCustomerSession(queueId);
    if (!entryId) return null;
    const found = state.entries.find((e) => e.id === entryId && (e.status === 'waiting' || e.status === 'serving'));
    return found || null;
  }, [state.entries]);

  const calculatePosition = useCallback((queueId: string, entryId: string) => {
    const queue = state.queues.find((q) => q.id === queueId);
    if (!queue) return { peopleAhead: 0, estimatedWaitMinutes: 0 };

    const waitingInQueue = state.entries.filter((e) => e.queueId === queueId && e.status === 'waiting');
    const index = waitingInQueue.findIndex((e) => e.id === entryId);

    if (index === -1) {
      // Check if it's currently serving
      const isServing = state.entries.some((e) => e.id === entryId && e.status === 'serving');
      if (isServing) {
        return { peopleAhead: 0, estimatedWaitMinutes: 0 };
      }
      return { peopleAhead: 0, estimatedWaitMinutes: 0 };
    }

    const peopleAhead = index;
    const estimatedWaitMinutes = peopleAhead * (queue.averageServiceMinutes || 8);
    return { peopleAhead, estimatedWaitMinutes };
  }, [state.queues, state.entries]);

  // BUSINESS & QUEUE CREATION
  const createBusiness = useCallback((data: { name: string; ownerName: string; email: string; businessType: BusinessType }): Business => {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'biz-' + Date.now();
    const newBiz: Business = {
      id: 'biz_' + Date.now(),
      name: data.name,
      slug,
      ownerName: data.ownerName,
      ownerEmail: data.email,
      businessType: data.businessType,
      createdAt: new Date().toISOString(),
      brandColor: '#2563eb',
    };

    const newProfile: UserProfile = {
      id: 'usr_' + Date.now(),
      name: data.ownerName,
      email: data.email,
      businessId: newBiz.id,
      role: 'owner',
      createdAt: new Date().toISOString(),
    };

    updateStateAndPersist((prev) => ({
      ...prev,
      businesses: [...prev.businesses, newBiz],
      currentBusinessId: newBiz.id,
      profiles: [...prev.profiles, newProfile],
      currentUser: newProfile,
    }));

    return newBiz;
  }, [updateStateAndPersist]);

  const createQueue = useCallback((data: { businessId: string; name: string; prefix: string; startNumber: number; averageServiceMinutes: number; allowEstimatedWait: boolean }): Queue => {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'queue-' + Date.now();
    const newQueue: Queue = {
      id: 'queue_' + Date.now(),
      businessId: data.businessId,
      name: data.name,
      slug,
      prefix: data.prefix || '',
      startNumber: data.startNumber || 1,
      nextNumber: data.startNumber || 1,
      currentNumber: null,
      currentEntryId: null,
      status: 'active',
      averageServiceMinutes: data.averageServiceMinutes || 10,
      allowEstimatedWait: data.allowEstimatedWait !== false,
      maxQueueSize: 100,
      allowCustomerCancel: true,
      enableSound: true,
      createdAt: new Date().toISOString(),
    };

    const defaultCounter: Counter = {
      id: 'cnt_' + Date.now(),
      queueId: newQueue.id,
      name: 'Counter 1',
      status: 'available',
    };
    newQueue.activeCounterId = defaultCounter.id;

    updateStateAndPersist((prev) => ({
      ...prev,
      queues: [...prev.queues, newQueue],
      counters: [...prev.counters, defaultCounter],
    }));

    setActiveQueueIdState(newQueue.id);
    return newQueue;
  }, [updateStateAndPersist]);

  const updateQueueSettings = useCallback((queueId: string, updates: Partial<Queue>) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      queues: prev.queues.map((q) => (q.id === queueId ? { ...q, ...updates } : q)),
    }));
    realtimeService.broadcast({
      type: 'QUEUE_UPDATED',
      queueId,
    });
  }, [updateStateAndPersist]);

  const updateBusinessSettings = useCallback((businessId: string, updates: Partial<Business>) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      businesses: prev.businesses.map((b) => (b.id === businessId ? { ...b, ...updates } : b)),
    }));
  }, [updateStateAndPersist]);

  const addCounter = useCallback((queueId: string, name: string) => {
    const newCounter: Counter = {
      id: 'cnt_' + Date.now(),
      queueId,
      name,
      status: 'available',
    };
    updateStateAndPersist((prev) => ({
      ...prev,
      counters: [...prev.counters, newCounter],
    }));
  }, [updateStateAndPersist]);

  const removeCounter = useCallback((counterId: string) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      counters: prev.counters.filter((c) => c.id !== counterId),
    }));
  }, [updateStateAndPersist]);

  const resetDemoData = useCallback(() => {
    const fresh = resetToDemoState();
    setState(fresh);
    setActiveQueueIdState(fresh.queues[0].id);
    realtimeService.broadcast({
      type: 'QUEUE_RESET',
      queueId: fresh.queues[0].id,
    });
  }, []);

  const getAnalytics = useCallback((queueId: string) => {
    const queueEntries = state.entries.filter((e) => e.queueId === queueId);
    const completed = queueEntries.filter((e) => e.status === 'completed').length;
    const skipped = queueEntries.filter((e) => e.status === 'skipped').length;
    const waiting = queueEntries.filter((e) => e.status === 'waiting').length;
    const totalToday = queueEntries.length;

    // Hourly distribution
    const hoursMap: { [hour: string]: number } = {
      '9 AM': 4,
      '10 AM': 8,
      '11 AM': 11,
      '12 PM': 7,
      '1 PM': 5,
      '2 PM': 9,
      '3 PM': 6,
      '4 PM': 3,
    };

    const hourlyVolume = Object.entries(hoursMap).map(([hour, count]) => ({
      hour,
      count,
    }));

    return {
      totalToday,
      completed,
      skipped,
      waiting,
      avgWaitMinutes: 14,
      avgServiceMinutes: 8,
      peakHour: '11:00 AM - 12:00 PM',
      hourlyVolume,
    };
  }, [state.entries]);

  const value = {
    state,
    currentBusiness,
    activeQueue,
    queues,
    counters,
    entries: state.entries,
    waitingEntries,
    servingEntry,
    completedEntries,
    skippedEntries,
    currentUser: state.currentUser,
    setCurrentBusinessId,
    setActiveQueueId,
    setCurrentUser,
    callNext,
    callSpecific,
    skipEntry,
    removeEntry,
    completeEntry,
    pauseQueue,
    resumeQueue,
    resetQueue,
    addWalkIn,
    joinQueue,
    leaveQueue,
    getCustomerActiveEntry,
    calculatePosition,
    createBusiness,
    createQueue,
    updateQueueSettings,
    updateBusinessSettings,
    addCounter,
    removeCounter,
    resetDemoData,
    getAnalytics,
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};
