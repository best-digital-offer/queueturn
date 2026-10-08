import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://')) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.isSupabaseConnected = true;
        console.log('[Queue Turn] Connected to Supabase Realtime');

        // Subscribe to postgres changes
        this.supabase
          .channel('public:queues_and_entries')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, (payload) => {
            this.notifySubscribers({
              type: 'QUEUE_UPDATED',
              queueId: (payload.new as { queue_id?: string })?.queue_id || '',
              data: payload,
              timestamp: Date.now(),
            });
          })
          .subscribe();
      } catch (e) {
        console.warn('[Queue Turn] Supabase connection error:', e);
      }
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

    // 3. Fallback sync storage pulse
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('queueturn_sync_pulse', JSON.stringify(fullMessage));
      } catch {
        // ignore
      }
    }

    // 4. If Supabase configured, publish broadcast
    if (this.supabase) {
      this.supabase.channel('queue_events').send({
        type: 'broadcast',
        event: message.type,
        payload: fullMessage,
      }).catch((e) => console.warn('Supabase broadcast error:', e));
    }
  }

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
