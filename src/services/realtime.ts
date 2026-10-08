import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as sharedSupabase } from './supabaseClient';

export type RealtimeEventType = 
  | 'QUEUE_UPDATED'
  | 'CUSTOMER_JOINED'
  | 'NEXT_CUSTOMER_CALLED'
  | 'ENTRY_SKIPPED'
  | 'ENTRY_REMOVED'
  | 'ENTRY_COMPLETED'
  | 'QUEUE_PAUSED'
  | 'QUEUE_RESUMED'
  | 'QUEUE_RESET';

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
  private subscribers: Set<Subscriber> = new Set();
  private supabase: SupabaseClient | null = null;
  private isSupabaseConnected: boolean = false;

  constructor() {
    this.initBroadcastChannel();
    this.initSupabaseIfConfigured();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('queueturn_realtime_bus');
        this.channel.onmessage = (event) => {
          if (event.data && event.data.type) {
            this.notifySubscribers(event.data as RealtimeMessage);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization error:', err);
      }
    }

    // Secondary sync fallback via storage event
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'queueturn_sync_pulse' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            this.notifySubscribers(parsed);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  private initSupabaseIfConfigured() {
    if (sharedSupabase) {
      try {
        this.supabase = sharedSupabase;
        this.isSupabaseConnected = true;
        console.log('[QueueTurn] Connected to Supabase Realtime');
      } catch (e) {
        console.warn('[QueueTurn] Supabase connection error:', e);
      }
    }

  public isUsingCloudSupabase(): boolean {
    return this.isSupabaseConnected;
  }

  public subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public broadcast(message: Omit<RealtimeMessage, 'timestamp'>) {
    const fullMessage: RealtimeMessage = {
      ...message,
      timestamp: Date.now(),
    };

    // 1. Notify local subscribers
    this.notifySubscribers(fullMessage);

    // 2. Broadcast to other tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage(fullMessage);
      } catch (err) {
        console.warn('BroadcastChannel send error:', err);
      }
    }

    // 3. Supabase Broadcast for cross-device queue events
    if (this.supabase && message.queueId) {
      const channel = this.supabase.channel(`queue-events:${message.queueId}`);
      channel.send({
        type: 'broadcast',
        event: message.type,
        payload: fullMessage,
      }).catch((e) => console.warn('[QueueTurn] Supabase broadcast error:', e));
    }

    // 4. Fallback sync storage pulse
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('queueturn_sync_pulse', JSON.stringify(fullMessage));
      } catch {
        // ignore
      }
    }

    // Supabase broadcast is handled above.

  private notifySubscribers(message: RealtimeMessage) {
    this.subscribers.forEach((sub) => {
      try {
        sub(message);
      } catch (err) {
        console.error('Subscriber callback error:', err);
      }
    });
  }
}

export const realtimeService = new RealtimeService();
