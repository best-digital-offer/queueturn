import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as sharedSupabase } from './supabaseClient';

export type RealtimeEventType =
  | 'QUEUE_UPDATED' | 'CUSTOMER_JOINED' | 'NEXT_CUSTOMER_CALLED'
  | 'ENTRY_SKIPPED' | 'ENTRY_REMOVED' | 'ENTRY_COMPLETED'
  | 'QUEUE_PAUSED' | 'QUEUE_RESUMED' | 'QUEUE_RESET';

export interface RealtimeMessage {
  type: RealtimeEventType;
  queueId: string;
  businessId?: string;
  data?: unknown;
  timestamp: number;
}

type Subscriber = (msg: RealtimeMessage) => void;

class RealtimeService {
  private channel: BroadcastChannel | null = null;
  private subscribers = new Set<Subscriber>();
  private supabase: SupabaseClient | null = sharedSupabase;
  private cloudChannels = new Map<string, ReturnType<SupabaseClient['channel']>>();

  constructor() {
    this.initBroadcastChannel();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('queueturn_realtime_bus');
        this.channel.onmessage = (event) => {
          if (event.data?.type) this.notifySubscribers(event.data as RealtimeMessage);
        };
      } catch (err) {
        console.warn('[QueueTurn] BroadcastChannel error:', err);
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'queueturn_sync_pulse' && e.newValue) {
          try { this.notifySubscribers(JSON.parse(e.newValue)); } catch {}
        }
      });
    }
  }

  public subscribeToQueue(queueId: string, callback: Subscriber): () => void {
    const unsubscribeLocal = this.subscribe(callback);
    if (!this.supabase) return unsubscribeLocal;

    let channel = this.cloudChannels.get(queueId);
    if (!channel) {
      channel = this.supabase.channel(`queue-events:${queueId}`);
      channel.on('broadcast', { event: '*' }, ({ payload }) => {
        if (payload?.type) this.notifySubscribers(payload as RealtimeMessage);
      }).subscribe();
      this.cloudChannels.set(queueId, channel);
    }
    return unsubscribeLocal;
  }

  public subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  public broadcast(message: Omit<RealtimeMessage, 'timestamp'>) {
    const fullMessage = { ...message, timestamp: Date.now() };
    this.notifySubscribers(fullMessage);

    try { this.channel?.postMessage(fullMessage); } catch {}

    if (this.supabase && message.queueId) {
      let channel = this.cloudChannels.get(message.queueId);
      if (!channel) {
        channel = this.supabase.channel(`queue-events:${message.queueId}`);
        channel.subscribe();
        this.cloudChannels.set(message.queueId, channel);
      }
      channel.send({
        type: 'broadcast',
        event: message.type,
        payload: fullMessage,
      }).catch((e) => console.warn('[QueueTurn] Supabase broadcast error:', e));
    }

    if (typeof window !== 'undefined') {
      try { localStorage.setItem('queueturn_sync_pulse', JSON.stringify(fullMessage)); } catch {}
    }
  }

  public isUsingCloudSupabase() {
    return !!this.supabase;
  }

  private notifySubscribers(message: RealtimeMessage) {
    this.subscribers.forEach((sub) => {
      try { sub(message); } catch (err) { console.error('[QueueTurn] subscriber error:', err); }
    });
  }
}

export const realtimeService = new RealtimeService();
