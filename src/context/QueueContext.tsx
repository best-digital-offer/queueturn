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
import { supabase } from '../services/supabaseClient';

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

  const refreshCloudState = useCallback(async () => {
    if (!supabase) return false;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { data: businesses, error: businessError } = await supabase
      .from('businesses').select('*').eq('owner_id', session.user.id);
    if (businessError || !businesses?.length) return false;

    const businessIds = businesses.map((b:any) => b.id);
    const { data: cloudQueues } = await supabase.from('queues').select('*').in('business_id', businessIds);
    const queueIds = (cloudQueues || []).map((q:any) => q.id);
    const { data: visitors } = queueIds.length
      ? await supabase.from('queue_visitors').select('*').in('queue_id', queueIds)
      : { data: [] as any[] };

    const mappedBusinesses: Business[] = businesses.map((b:any) => ({
      id:b.id, name:b.name, slug:b.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
      ownerName:session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Owner',
      ownerEmail:session.user.email || '', businessType:'other', createdAt:b.created_at, brandColor:'#4f46e5'
    }));
    const mappedQueues: Queue[] = (cloudQueues || []).map((q:any) => {
      const serving=(visitors || []).find((v:any)=>v.queue_id===q.id && v.status==='called');
      return {
        id:q.id,businessId:q.business_id,name:q.name,slug:q.slug,prefix:q.prefix,startNumber:1,
        nextNumber:q.next_number,currentNumber:q.current_number || null,currentEntryId:serving?.id || null,
        status:q.is_paused?'paused':'active',averageServiceMinutes:q.estimated_minutes_per_person,
        allowEstimatedWait:true,maxQueueSize:100,allowCustomerCancel:true,enableSound:true,createdAt:q.created_at
      };
    });
    const mappedEntries: QueueEntry[] = (visitors || []).map((v:any) => ({
      id:v.id,queueId:v.queue_id,businessId:mappedQueues.find(q=>q.id===v.queue_id)?.businessId || '',
      displayNumber:(mappedQueues.find(q=>q.id===v.queue_id)?.prefix || '') + v.queue_number,
      sequenceNumber:v.queue_number,customerSessionId:v.customer_token,customerName:v.customer_name || undefined,
      customerPhone:v.customer_phone || undefined,status:v.status==='called'?'serving':v.status==='served'?'completed':v.status==='removed'?'cancelled':v.status,
      joinedAt:v.joined_at,calledAt:v.called_at,completedAt:v.completed_at
    }));
    const mappedCounters: Counter[] = mappedQueues.map(q => ({
      id:'cloud-counter-'+q.id,queueId:q.id,name:'Counter 1',
      status:q.currentEntryId?'busy':'available',currentEntryId:q.currentEntryId || undefined
    }));
    const next: AppState = {
      businesses:mappedBusinesses,currentBusinessId:mappedBusinesses[0].id,queues:mappedQueues,
      counters:mappedCounters,entries:mappedEntries,profiles:[],currentUser:{
        id:session.user.id,name:mappedBusinesses[0].ownerName,email:session.user.email || '',
        businessId:mappedBusinesses[0].id,role:'owner',createdAt:session.user.created_at
      }
    };
    setState(next);
    saveStoredState(next);
    if (mappedQueues[0]) setActiveQueueIdState(prev => mappedQueues.some(q=>q.id===prev) ? prev : mappedQueues[0].id);
    return true;
  }, []);

  // Set default active queue on mount or business switch
  useEffect(() => {
    const businessQueues = state.queues.filter((q) => q.businessId === state.currentBusinessId);
    if (businessQueues.length > 0 && (!activeQueueId || !businessQueues.some((q) => q.id === activeQueueId))) {
      setActiveQueueIdState(businessQueues[0].id);
    }
  }, [state.currentBusinessId, state.queues, activeQueueId]);

  useEffect(() => {
    if (!supabase) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const start = async () => {
      const loaded = await refreshCloudState();
      if (!loaded) return;
      channel = supabase.channel('queueturn-owner-sync')
        .on('postgres_changes',{event:'*',schema:'public',table:'queues'},() => { refreshCloudState(); })
        .on('postgres_changes',{event:'*',schema:'public',table:'queue_visitors'},() => { refreshCloudState(); })
        .subscribe();
    };
    start();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { refreshCloudState(); });
    return () => {
      listener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [refreshCloudState]);

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
    if (supabase && /^[0-9a-f-]{36}$/i.test(queueId)) {
      const { data, error } = await supabase.rpc('call_next_visitor', { p_queue_id: queueId });
      if (error) throw error;
      await refreshCloudState();
      const v:any = Array.isArray(data) ? data[0] : data;
      if (!v) return null;
      return {
        id:v.id,queueId:v.queue_id,businessId:state.queues.find(q=>q.id===queueId)?.businessId || '',
        displayNumber:(state.queues.find(q=>q.id===queueId)?.prefix || '')+v.queue_number,
        sequenceNumber:v.queue_number,customerSessionId:v.customer_token,status:'serving',
        joinedAt:v.joined_at,calledAt:v.called_at
      };
    }
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

  const skipEntry = useCallback(async (entryId: string) => {
    if (supabase && /^[0-9a-f-]{36}$/i.test(entryId)) {
      const { error } = await supabase.rpc('skip_visitor', { p_visitor_id: entryId });
      if (error) throw error;
      await refreshCloudState();
      return;
    }
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

  const removeEntry = useCallback(async (entryId: string) => {
    if (supabase && /^[0-9a-f-]{36}$/i.test(entryId)) {
      const { error } = await supabase.from('queue_visitors').update({ status:'removed', completed_at:new Date().toISOString() }).eq('id',entryId);
      if (error) throw error;
      await refreshCloudState();
      return;
    }
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

  const completeEntry = useCallback(async (entryId: string) => {
    if (supabase && /^[0-9a-f-]{36}$/i.test(entryId)) {
      const { error } = await supabase.rpc('complete_visitor', { p_visitor_id: entryId });
      if (error) throw error;
      await refreshCloudState();
      return;
    }
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

  const pauseQueue = useCallback(async (queueId: string) => {
    if (supabase && /^[0-9a-f-]{36}$/i.test(queueId)) {
      const { error } = await supabase.from('queues').update({ is_paused:true }).eq('id',queueId);
      if (error) throw error;
      await refreshCloudState();
      return;
    }
    updateStateAndPersist((prev) => ({
      ...prev,
      queues: prev.queues.map((q) => (q.id === queueId ? { ...q, status: 'paused' as const } : q)),
    }));
    realtimeService.broadcast({
      type: 'QUEUE_PAUSED',
      queueId,
    });
  }, [updateStateAndPersist]);

  const resumeQueue = useCallback(async (queueId: string) => {
    if (supabase && /^[0-9a-f-]{36}$/i.test(queueId)) {
      const { error } = await supabase.from('queues').update({ is_paused:false }).eq('id',queueId);
      if (error) throw error;
      await refreshCloudState();
      return;
    }
    updateStateAndPersist((prev) => ({
      ...prev,
      queues: prev.queues.map((q) => (q.id === queueId ? { ...q, status: 'active' as const } : q)),
    }));
    realtimeService.broadcast({
      type: 'QUEUE_RESUMED',
      queueId,
    });
  }, [updateStateAndPersist]);

  const resetQueue = useCallback(async (queueId: string) => {
    if (supabase && /^[0-9a-f-]{36}$/i.test(queueId)) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in to reset this queue.');
      const queue = state.queues.find((q) => q.id === queueId);
      if (!queue) throw new Error('Queue not found.');
      const now = new Date().toISOString();
      const { error: visitorError } = await supabase.from('queue_visitors').update({ status: 'served', completed_at: now }).eq('queue_id', queueId).in('status', ['waiting', 'called']);
      if (visitorError) throw visitorError;
      const { error: queueError } = await supabase.from('queues').update({ current_number: 0, next_number: queue.startNumber || 1 }).eq('id', queueId);
      if (queueError) throw queueError;
      await refreshCloudState();
      realtimeService.broadcast({ type: 'QUEUE_RESET', queueId });
      return;
    }
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
    if (supabase && /^[0-9a-f-]{36}$/i.test(queueId)) {
      const queue = state.queues.find((q) => q.id === queueId);
      if (!queue) throw new Error('Queue not found.');
      const optimistic: QueueEntry = {
        id: 'walkin-pending-' + Date.now(), queueId, businessId: queue.businessId,
        displayNumber: '…', sequenceNumber: 0, customerSessionId: 'walkin-pending-' + Date.now(),
        customerName: name?.trim() || 'Walk-in Guest', customerPhone: phone?.trim(), notes: notes?.trim(),
        status: 'waiting', joinedAt: new Date().toISOString(),
      };
      void (async () => {
        const { error } = await supabase.rpc('join_queue', { p_queue_id: queueId, p_customer_name: name?.trim() || 'Walk-in Guest', p_customer_phone: phone?.trim() || null });
        if (error) { console.error('Could not add walk-in to cloud queue:', error); return; }
        await refreshCloudState();
        realtimeService.broadcast({ type: 'CUSTOMER_JOINED', queueId });
      })();
      return optimistic;
    }
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
    const queueNameSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'general-service';
    const isCloudBusiness = Boolean(supabase && /^[0-9a-f-]{36}$/i.test(data.businessId));
    const businessSlug = state.businesses.find((business) => business.id === data.businessId)?.slug
      || state.businesses.find((business) => business.id === data.businessId)?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      || 'business';
    const baseSlug = isCloudBusiness ? `${businessSlug}-${queueNameSlug}` : queueNameSlug;
    const slug = state.queues.some((queue) => queue.slug === baseSlug && queue.businessId === data.businessId)
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;
    const newQueue: Queue = {
      id: supabase ? crypto.randomUUID() : 'queue_' + Date.now(),
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
    if (supabase && /^[0-9a-f-]{36}$/i.test(data.businessId)) {
      void (async () => {
        const { error } = await supabase.from('queues').insert({
          id: newQueue.id, business_id: data.businessId, name: newQueue.name, slug: newQueue.slug,
          prefix: newQueue.prefix, current_number: 0, next_number: newQueue.nextNumber,
          estimated_minutes_per_person: newQueue.averageServiceMinutes, is_active: true, is_paused: false,
        });
        if (error) { console.error('Could not save new queue to Supabase:', error); return; }
        await refreshCloudState();
      })();
    }
    return newQueue;
  }, [state, updateStateAndPersist, refreshCloudState]);

  const updateQueueSettings = useCallback((queueId: string, updates: Partial<Queue>) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      queues: prev.queues.map((q) => (q.id === queueId ? { ...q, ...updates } : q)),
    }));
    if (supabase && /^[0-9a-f-]{36}$/i.test(queueId)) {
      const cloudUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) cloudUpdates.name = updates.name;
      if (updates.slug !== undefined) cloudUpdates.slug = updates.slug;
      if (updates.prefix !== undefined) cloudUpdates.prefix = updates.prefix;
      if (updates.nextNumber !== undefined) cloudUpdates.next_number = updates.nextNumber;
      if (updates.currentNumber !== undefined) cloudUpdates.current_number = updates.currentNumber ?? 0;
      if (updates.averageServiceMinutes !== undefined) cloudUpdates.estimated_minutes_per_person = updates.averageServiceMinutes;
      if (updates.status !== undefined) {
        cloudUpdates.is_paused = updates.status === 'paused';
        cloudUpdates.is_active = updates.status !== 'closed';
      }
      if (Object.keys(cloudUpdates).length) {
        void (async () => {
          const { error } = await supabase.from('queues').update(cloudUpdates).eq('id', queueId);
          if (error) console.error('Could not save queue settings:', error);
          else await refreshCloudState();
        })();
      }
    }
    realtimeService.broadcast({ type: 'QUEUE_UPDATED', queueId });
  }, [updateStateAndPersist, refreshCloudState]);

  const updateBusinessSettings = useCallback((businessId: string, updates: Partial<Business>) => {
    updateStateAndPersist((prev) => ({
      ...prev,
      businesses: prev.businesses.map((b) => (b.id === businessId ? { ...b, ...updates } : b)),
    }));
    if (supabase && /^[0-9a-f-]{36}$/i.test(businessId) && updates.name !== undefined) {
      void (async () => {
        const { error } = await supabase.from('businesses').update({ name: updates.name }).eq('id', businessId);
        if (error) console.error('Could not save business settings:', error);
        else await refreshCloudState();
      })();
    }
  }, [updateStateAndPersist, refreshCloudState]);

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
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const queueEntries = state.entries.filter((entry) => entry.queueId === queueId);
    const todayEntries = queueEntries.filter((entry) => {
      const joinedAt = new Date(entry.joinedAt).getTime();
      return Number.isFinite(joinedAt) && joinedAt >= dayStart && joinedAt <= now.getTime();
    });
    const completedToday = todayEntries.filter((entry) => entry.status === 'completed');
    const skipped = todayEntries.filter((entry) => entry.status === 'skipped').length;
    const waiting = queueEntries.filter((entry) => entry.status === 'waiting').length;

    const waitDurations = completedToday
      .concat(todayEntries.filter((entry) => entry.status === 'serving'))
      .map((entry) => entry.calledAt ? (new Date(entry.calledAt).getTime() - new Date(entry.joinedAt).getTime()) / 60000 : null)
      .filter((minutes): minutes is number => minutes !== null && Number.isFinite(minutes) && minutes >= 0);
    const serviceDurations = completedToday
      .map((entry) => entry.calledAt && entry.completedAt
        ? (new Date(entry.completedAt).getTime() - new Date(entry.calledAt).getTime()) / 60000
        : null)
      .filter((minutes): minutes is number => minutes !== null && Number.isFinite(minutes) && minutes >= 0);

    const hourCounts = Array.from({ length: 24 }, () => 0);
    todayEntries.forEach((entry) => {
      const joinedAt = new Date(entry.joinedAt);
      if (Number.isFinite(joinedAt.getTime())) hourCounts[joinedAt.getHours()] += 1;
    });
    const hourlyVolume = hourCounts.map((count, hourIndex) => ({
      hour: new Date(2000, 0, 1, hourIndex).toLocaleTimeString([], { hour: 'numeric' }),
      count,
    }));
    const peakHourIndex = hourCounts.indexOf(Math.max(...hourCounts));
    const peakHour = hourCounts.some((count) => count > 0)
      ? `${new Date(2000, 0, 1, peakHourIndex).toLocaleTimeString([], { hour: 'numeric' })} - ${new Date(2000, 0, 1, peakHourIndex + 1).toLocaleTimeString([], { hour: 'numeric' })}`
      : 'No activity yet';

    const average = (values: number[]) => values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;

    return {
      totalToday: todayEntries.length,
      completed: completedToday.length,
      skipped,
      waiting,
      avgWaitMinutes: average(waitDurations),
      avgServiceMinutes: average(serviceDurations),
      peakHour,
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
