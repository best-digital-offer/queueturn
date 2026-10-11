import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  Bell, 
  ArrowLeft, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Volume2, 
  RefreshCw,
  MapPin,
  Phone,
  ShieldCheck,
  PauseCircle
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { notificationService } from '../../services/notifications';
import { soundService } from '../../services/sound';
import { findPublicQueue, joinCloudQueue, getCloudVisitor, getCloudQueueStats, subscribeToCloudQueue } from '../../services/cloudQueue';
import { supabase } from '../../services/supabaseClient';
import confetti from 'canvas-confetti';

interface CustomerViewProps {
  onBackToHome?: () => void;
  queueSlug?: string;
  businessSlug?: string;
}

export const CustomerView: React.FC<CustomerViewProps> = ({
  onBackToHome,
  queueSlug = 'general-service',
  businessSlug = 'abc-clinic',
}) => {
  const {
    state,
    joinQueue,
    leaveQueue,
    getCustomerActiveEntry,
    calculatePosition,
  } = useQueue();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [confettiFired, setConfettiFired] = useState(false);
  const [cloudQueue, setCloudQueue] = useState<any>(null);
  const [cloudBusiness, setCloudBusiness] = useState<any>(null);
  const [cloudLookupComplete, setCloudLookupComplete] = useState(!supabase);
  const [cloudVisitor, setCloudVisitor] = useState<any>(null);
  const [cloudTicketPending, setCloudTicketPending] = useState(false);
  const [cloudStats, setCloudStats] = useState<any>(null);
  const [cloudStatsLoaded, setCloudStatsLoaded] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Cloud mode: QR/customer links use Supabase when configured.
  useEffect(() => {
    let cancelled=false;
    if (!supabase) {
      setCloudLookupComplete(true);
      return;
    }
    // Do not briefly render demo/local queue data while the QR's real cloud queue is loading.
    setCloudLookupComplete(false);
    setCloudQueue(null);
    setCloudBusiness(null);
    findPublicQueue(queueSlug, businessSlug)
      .then(found => {
        if (cancelled) return;
        if (found) {
          setCloudQueue(found.queue);
          setCloudBusiness(found.business);
        }
      })
      .catch(error => {
        console.error('Could not load public queue:', error);
      })
      .finally(() => {
        if (!cancelled) setCloudLookupComplete(true);
      });
    return () => { cancelled=true; };
  }, [queueSlug,businessSlug]);

  useEffect(() => {
    if (!cloudQueue || !supabase) return;
    const visitorId=localStorage.getItem('queueturn_cloud_visitor_id_'+cloudQueue.id);
    const token=localStorage.getItem('queueturn_cloud_visitor_token_'+cloudQueue.id);
    setCloudTicketPending(Boolean(visitorId && token));
    let alive=true;
    const refresh=async()=> {
      // Queue-wide totals use a narrow public RPC; visitor details remain token-protected.
      const [stats, visitor] = await Promise.all([
        getCloudQueueStats(cloudQueue.id),
        visitorId && token ? getCloudVisitor(visitorId,token) : Promise.resolve(null),
      ]);
      if (!alive) return;
      if (stats) setCloudStats(stats);
      setCloudStatsLoaded(true);
      // Keep the last valid visitor state if a single polling request fails.
      // A stored ticket must never fall back to the join form just because a status
      // request temporarily returns no row or the visitor has reached a terminal state.
      if (visitor) {
        setCloudVisitor(visitor);
        setCloudTicketPending(false);
      }
    };
    void refresh();
    const poll=window.setInterval(()=>{ void refresh(); },5000);
    const unsubscribe=subscribeToCloudQueue(cloudQueue.id,()=>{ void refresh(); });
    return ()=>{ alive=false; window.clearInterval(poll); unsubscribe(); };
  }, [cloudQueue?.id]);

  // In production/cloud mode, only show the queue resolved from the QR URL.
  // Demo/local state is used only when Supabase is not configured.
  const business = supabase
    ? cloudBusiness
    : (state.businesses.find((b) => b.slug === businessSlug) || state.businesses[0]);
  const queue = supabase
    ? cloudQueue
    : (state.queues.find((q) => q.businessId === business?.id && (q.slug === queueSlug || q.id === queueSlug)) || state.queues[0]);

  const cloudEntryStatus = cloudVisitor?.status === 'called' ? 'serving' : cloudVisitor?.status === 'served' ? 'completed' : cloudVisitor?.status === 'removed' ? 'cancelled' : cloudVisitor?.status;
  const activeCustomerEntry = cloudVisitor ? { id:cloudVisitor.visitor_id || cloudVisitor.id, displayNumber:`${cloudVisitor.prefix || cloudQueue?.prefix || ''}${cloudVisitor.queue_number}`, status:cloudEntryStatus, counterName:undefined } as any : (queue ? getCustomerActiveEntry(queue.id) : null);
  const isTerminalTicket = Boolean(activeCustomerEntry && ['completed','cancelled','skipped','removed','served'].includes(activeCustomerEntry.status));
  const positionInfo = cloudVisitor ? { peopleAhead:Number(cloudVisitor.people_ahead||0), estimatedWaitMinutes:Number(cloudVisitor.estimated_wait_minutes||0) } : ((queue && activeCustomerEntry) ? calculatePosition(queue.id, activeCustomerEntry.id) : { peopleAhead: 0, estimatedWaitMinutes: 0 });

  const scheduledDate = cloudQueue?.scheduled_for || queue?.scheduledFor;
  const isFutureScheduled = Boolean(scheduledDate && scheduledDate > new Date().toLocaleDateString('en-CA'));

  const currentServingEntry = cloudQueue
    ? (cloudStats?.current_number ? {displayNumber:`${cloudStats.prefix || cloudQueue.prefix || ''}${cloudStats.current_number}`} : null)
    : (queue ? state.entries.find((e) => e.queueId === queue.id && e.status === 'serving') : null);
  // In cloud mode, never fall back to demo/local data while public stats are loading or unavailable.
  const waitingCount: number | null = cloudQueue
    ? (cloudStats ? Number(cloudStats.total_waiting) : null)
    : (queue ? state.entries.filter((e) => e.queueId === queue.id && e.status === 'waiting').length : 0);

  // Trigger celebration confetti when serving
  useEffect(() => {
    if (activeCustomerEntry?.status === 'serving' && !confettiFired) {
      setConfettiFired(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      soundService.announceTurn(activeCustomerEntry.displayNumber, activeCustomerEntry.counterName);
    } else if (activeCustomerEntry?.status !== 'serving') {
      setConfettiFired(false);
    }
  }, [activeCustomerEntry?.status, activeCustomerEntry?.displayNumber, activeCustomerEntry?.counterName, confettiFired]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queue) return;
    setIsJoining(true);
    setJoinError('');
    try {
      if (isFutureScheduled) {
        throw new Error('This queue is scheduled to open on ' + new Date(scheduledDate + 'T12:00:00').toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}) + '.');
      }
      if (queue.status === 'paused' || queue.status === 'closed') {
        throw new Error(queue.status === 'paused' ? 'This queue is paused right now. Please check with staff before joining.' : 'This queue is closed and is not accepting new tickets.');
      }
      if (cloudQueue) {
        const result=await joinCloudQueue(cloudQueue.id,customerName,customerPhone);
        const visitorId = result?.visitor_id || result?.id;
        if (!visitorId || !result?.customer_token || result?.queue_number == null) {
          throw new Error('The queue service returned an incomplete ticket. Please refresh and try again.');
        }
        localStorage.setItem('queueturn_cloud_visitor_id_'+cloudQueue.id, visitorId);
        localStorage.setItem('queueturn_cloud_visitor_token_'+cloudQueue.id,result.customer_token);
        setCloudVisitor({visitor_id:visitorId,queue_id:result.queue_id || cloudQueue.id,queue_number:result.queue_number,customer_token:result.customer_token,status:'waiting',people_ahead:result.people_ahead ?? 0,estimated_wait_minutes:result.estimated_wait_minutes ?? 0,current_number:cloudQueue.current_number,prefix:cloudQueue.prefix,name:cloudQueue.name,is_paused:cloudQueue.is_paused,is_active:cloudQueue.is_active});
        setCloudTicketPending(false);
      } else await joinQueue(queue.id, customerName, customerPhone);
      soundService.playChime();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : '';
      setJoinError(/paused/i.test(message)
        ? 'This queue is paused right now. Please check with staff before joining.'
        : /closed|not accepting|unavailable/i.test(message)
          ? 'This queue is currently unavailable. Please refresh the page or check with staff.'
          : (supabase && message && !/fetch|network/i.test(message))
            ? `Ticket could not be created: ${message}`
            : 'We could not connect to the queue service. Please check your connection and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!queue || !activeCustomerEntry) return;
    if (cloudQueue && supabase) {
      const visitorKey = 'queueturn_cloud_visitor_id_' + cloudQueue.id;
      const tokenKey = 'queueturn_cloud_visitor_token_' + cloudQueue.id;
      const visitorId = localStorage.getItem(visitorKey);
      const token = localStorage.getItem(tokenKey);
      if (!visitorId || !token) {
        setJoinError('We could not verify this ticket. Refresh the page and try again.');
        setShowLeaveConfirm(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('leave_queue', {
          p_visitor_id: visitorId,
          p_customer_token: token,
        });
        if (error) throw error;
        if (data !== true) throw new Error('This ticket is no longer eligible to leave the queue.');
        localStorage.removeItem(visitorKey);
        localStorage.removeItem(tokenKey);
        setCloudVisitor(null);
        setCloudTicketPending(false);
        setJoinError('');
      } catch (error) {
        console.error('Could not leave cloud queue:', error);
        setJoinError('We could not cancel this ticket right now. Please try again.');
      }
    } else {
      leaveQueue(queue.id, activeCustomerEntry.id);
    }
    setShowLeaveConfirm(false);
  };

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationStatus(granted ? 'granted' : 'denied');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    const visitorId=cloudQueue ? localStorage.getItem('queueturn_cloud_visitor_id_'+cloudQueue.id) : null;
    const token=cloudQueue ? localStorage.getItem('queueturn_cloud_visitor_token_'+cloudQueue.id) : null;
    if (visitorId && token) {
      void getCloudVisitor(visitorId,token).then(v=>{ if(v) setCloudVisitor(v); }).finally(()=>setIsRefreshing(false));
    } else {
      window.setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  if (supabase && !cloudLookupComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full">
          <RefreshCw className="w-8 h-8 text-indigo-600 mx-auto mb-3 animate-spin" />
          <h2 className="text-lg font-bold text-slate-900">Loading live queue</h2>
          <p className="text-slate-500 text-sm mt-1">Fetching the latest queue status…</p>
        </div>
      </div>
    );
  }

  if (cloudQueue && cloudTicketPending && !cloudVisitor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full">
          <ShieldCheck className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Your ticket is saved</h2>
          <p className="text-slate-500 text-sm mt-2">We are reconnecting to your existing ticket. To prevent duplicate entries, this page will not create another ticket while your previous ticket is being checked.</p>
          <button onClick={handleRefresh} className="mt-4 w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition">Check Ticket Status</button>
        </div>
      </div>
    );
  }

  if (!business || !queue) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Queue Not Found</h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">The requested digital line could not be located.</p>
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition"
            >
              Return Home
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- SCREEN 2: POST-JOIN ACTIVE CUSTOMER STATUS ---
  if (activeCustomerEntry) {
    const isServing = activeCustomerEntry.status === 'serving';
    const isTerminal = isTerminalTicket;
    const isAlmostUp = !isServing && !isTerminal && positionInfo.peopleAhead <= 1;

    // Progress calculation (starts from ~10% up to 100%)
    const maxReference = Math.max(positionInfo.peopleAhead + 2, 4);
    const progressPercent = isServing 
      ? 100 
      : Math.min(95, Math.max(15, Math.round(((maxReference - positionInfo.peopleAhead) / maxReference) * 100)));

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 text-slate-900">
        <div className="max-w-md w-full mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {business.name.charAt(0)}
              </div>
              <div>
                <h1 className="font-bold text-slate-900 leading-tight text-base sm:text-lg">{business.name}</h1>
                <p className="text-xs text-slate-500 font-medium">{queue.name}</p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              aria-label="Refresh queue position"
              className={`p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 transition ${
                isRefreshing ? 'animate-spin text-indigo-600' : ''
              }`}
              title="Refresh Position"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* PAUSED BANNER */}
          {queue.status === 'paused' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
              <PauseCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Queue Temporarily Paused</p>
                <p className="text-xs text-amber-700 mt-0.5">Staff has temporarily paused admissions. Your position is held.</p>
              </div>
            </div>
          )}

          {/* MAIN TICKET STATUS CARD */}
          <div className={`rounded-3xl p-6 sm:p-8 text-center shadow-lg transition-all border ${
            isServing
              ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white border-emerald-500 ring-4 ring-emerald-400/30'
              : isTerminal
              ? 'bg-gradient-to-b from-slate-700 to-slate-800 text-white border-slate-600'
              : isAlmostUp
              ? 'bg-gradient-to-b from-indigo-700 to-indigo-900 text-white border-indigo-600'
              : 'bg-white text-slate-900 border-slate-200/80 shadow-slate-200/50'
          }`}>
            {isServing ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/40 text-emerald-100 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  Now Serving
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-emerald-100 font-medium">Your Ticket</span>
                  <div className="text-6xl sm:text-7xl font-extrabold font-mono-numbers tracking-tight mt-1 text-white">
                    {activeCustomerEntry.displayNumber}
                  </div>
                </div>
                <div className="bg-white/15 rounded-2xl p-4 backdrop-blur-xs">
                  <h2 className="text-2xl font-bold text-white">It's Your Turn!</h2>
                  <p className="text-emerald-100 text-sm mt-1 font-medium">
                    {activeCustomerEntry.counterName 
                      ? `Please proceed to ${activeCustomerEntry.counterName}`
                      : 'Please proceed to the service counter now.'}
                  </p>
                </div>
              </div>
            ) : isTerminal ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-slate-100 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  Ticket Complete
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-300 font-medium">Your Ticket</span>
                  <div className="text-6xl sm:text-7xl font-extrabold font-mono-numbers tracking-tight mt-1 text-white">
                    {activeCustomerEntry.displayNumber}
                  </div>
                </div>
                <div className="bg-white/10 rounded-2xl p-4">
                  <h2 className="text-xl font-bold text-white">{activeCustomerEntry.status === 'skipped' || activeCustomerEntry.status === 'cancelled' ? 'This Ticket Is Closed' : 'Thank You for Visiting!'}</h2>
                  <p className="text-slate-200 text-sm mt-1">This ticket has already been processed or closed. You cannot join again using this ticket page.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-1.5">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    isAlmostUp 
                      ? 'bg-amber-400/30 text-amber-200 border border-amber-300/40' 
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {isAlmostUp ? "🔥 You're Almost Up!" : "In Queue"}
                  </span>
                </div>

                <div>
                  <span className={`text-xs uppercase tracking-wider font-semibold ${
                    isAlmostUp ? 'text-indigo-200' : 'text-slate-400'
                  }`}>
                    Your Ticket
                  </span>
                  <div className={`text-6xl sm:text-7xl font-extrabold font-mono-numbers tracking-tight mt-1 ${
                    isAlmostUp ? 'text-white' : 'text-slate-900'
                  }`}>
                    {activeCustomerEntry.displayNumber}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span className={isAlmostUp ? 'text-indigo-200' : 'text-slate-500'}>Queue Progress</span>
                    <span className={isAlmostUp ? 'text-white font-bold' : 'text-slate-700 font-bold'}>
                      {positionInfo.peopleAhead === 0 ? 'Next in Line!' : `${positionInfo.peopleAhead} ahead`}
                    </span>
                  </div>
                  <div className={`w-full h-3 rounded-full overflow-hidden ${isAlmostUp ? 'bg-indigo-950/60' : 'bg-slate-100'}`}>
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${isAlmostUp ? 'bg-amber-400' : 'bg-indigo-600'}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* POSITION & WAIT METRICS */}
          {!isServing && !isTerminal && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center">
                <Users className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <span className="text-xs text-slate-500 font-medium">People Ahead</span>
                <p className="text-2xl font-bold font-mono-numbers text-slate-900 mt-0.5">
                  {positionInfo.peopleAhead}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center">
                <Clock className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <span className="text-xs text-slate-500 font-medium">Estimated Wait</span>
                <p className="text-2xl font-bold font-mono-numbers text-slate-900 mt-0.5">
                  ~{positionInfo.estimatedWaitMinutes} <span className="text-sm font-normal text-slate-500">min</span>
                </p>
              </div>
            </div>
          )}

          {/* CURRENTLY SERVING SUMMARY */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                📢
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Currently Serving</p>
                <p className="text-base font-bold font-mono-numbers text-slate-900">
                  {currentServingEntry ? currentServingEntry.displayNumber : 'None yet'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                Live Sync
              </span>
            </div>
          </div>

          {/* NOTIFICATION ENABLE BUTTON */}
          {notificationStatus !== 'granted' && (
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-indigo-600 shrink-0" />
                <p className="text-xs text-indigo-900 font-medium">
                  Get a chime alert when it's your turn
                </p>
              </div>
              <button
                onClick={handleEnableNotifications}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shrink-0 transition"
              >
                Enable Alert
              </button>
            </div>
          )}

          {/* LEAVE QUEUE CONFIRMATION */}
          {!isTerminal && activeCustomerEntry.status === 'waiting' && showLeaveConfirm ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center space-y-3">
              <p className="text-xs text-rose-800 font-medium">
                Are you sure you want to leave the waiting line? You will lose ticket <strong>{activeCustomerEntry.displayNumber}</strong>.
              </p>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={handleLeave}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
                >
                  Yes, Leave Queue
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : !isTerminal && activeCustomerEntry.status === 'waiting' ? (
            <div className="text-center pt-2">
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="text-xs text-slate-400 hover:text-rose-600 font-medium transition underline"
              >
                Leave Queue
              </button>
            </div>
          )}
        </div>

        {/* QueueTurn brand footer */}
        <footer className="max-w-md w-full mx-auto flex flex-col items-center text-center pt-6 pb-2 gap-2">
          <a href="https://www.queueturn.com" target="_blank" rel="noreferrer" aria-label="QueueTurn — Smart Queue Management" className="inline-flex items-center justify-center">
            <img src="/queueturn-logo.svg" alt="QueueTurn — Smart Queue Management" className="w-52 sm:w-60 max-w-full h-auto object-contain" loading="lazy" />
          </a>
          <p className="text-[11px] text-slate-400">No app download required</p>
          <p className="text-[11px] text-slate-400">Keep this browser tab open to receive live updates</p>
        </footer>
      </div>
    );
  }

  // --- SCREEN 1: PRE-JOIN VIEW ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 text-slate-900">
      <div className="max-w-md w-full mx-auto space-y-5">
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Queue Turn
          </button>
        )}

        {/* Business Branding Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md shadow-indigo-200">
            {business.name.charAt(0)}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {business.name}
          </h1>
          <p className="text-sm font-medium text-indigo-600 bg-indigo-50 inline-block px-3 py-1 rounded-full">
            {queue.name} • Digital Waiting Line
          </p>
          {business.address && (
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {business.address}
            </p>
          )}
        </div>

        {/* Current Queue Stats Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
          <div className="grid grid-cols-2 gap-4 text-center divide-x divide-slate-100">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Now Serving</span>
              <p className="text-3xl sm:text-4xl font-extrabold font-mono-numbers text-indigo-600 mt-1">
                {currentServingEntry ? currentServingEntry.displayNumber : '—'}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Currently Waiting</span>
              <p className="text-3xl sm:text-4xl font-extrabold font-mono-numbers text-slate-800 mt-1">
                {cloudQueue && !cloudStatsLoaded ? '—' : waitingCount ?? '—'}
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Avg wait: ~{queue.averageServiceMinutes} min/person
            </span>
            <span className={`inline-flex items-center font-medium ${queue.status === 'active' ? 'text-emerald-600' : queue.status === 'paused' ? 'text-amber-600' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${queue.status === 'active' ? 'bg-emerald-500 animate-pulse' : queue.status === 'paused' ? 'bg-amber-500' : 'bg-slate-400'}`} />
              {queue.status === 'paused' ? 'Temporarily Paused' : queue.status === 'closed' ? 'Closed' : 'Open Now'}
            </span>
          </div>
        </div>

        {/* Join Queue Form */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-900">Get Your Digital Ticket</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              No account or password needed. You'll receive a ticket immediately.
            </p>
          </div>

          {isFutureScheduled && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              <p className="font-bold">Queue opens on {new Date(scheduledDate + 'T12:00:00').toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</p>
              <p className="mt-1 text-xs">Tickets will be available on the scheduled date. Please return then to join this queue.</p>
            </div>
          )}
          <form onSubmit={handleJoin} className="space-y-3">
            <div>
              <label htmlFor="customer-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Your Name <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="customer-name"
                type="text"
                placeholder="e.g. Alex"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label htmlFor="customer-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number <span className="text-slate-400 font-normal">(optional for SMS alert)</span>
              </label>
              <input
                id="customer-phone"
                type="tel"
                placeholder="(555) 000-0000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isJoining || isFutureScheduled || queue.status === 'closed' || queue.status === 'paused'}
              className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-extrabold text-base shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center space-x-2"
            >
              {isJoining ? (
                <span>Generating Ticket...</span>
              ) : isFutureScheduled ? (
                <span>Opens {new Date(scheduledDate + 'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span>
              ) : queue.status === 'closed' ? (
                <span>Queue Closed</span>
              ) : queue.status === 'paused' ? (
                <span>Queue Temporarily Paused</span>
              ) : (
                <>
                  <span>JOIN QUEUE</span>
                  <span className="text-indigo-200">→</span>
                </>
              )}
            </button>
          </form>
          {joinError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {joinError}
            </div>
          )}

          <div className="pt-2 text-center">
            <span className="inline-flex items-center text-[11px] text-slate-400 gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              100% Free • No download required • Instant live updates
            </span>
          </div>
        </div>
      </div>

      {/* QueueTurn brand footer */}
      <footer className="max-w-md w-full mx-auto flex flex-col items-center text-center pt-8 pb-3 gap-2">
        <a href="https://www.queueturn.com" target="_blank" rel="noreferrer" aria-label="QueueTurn — Smart Queue Management" className="inline-flex items-center justify-center">
          <img src="/queueturn-logo.svg" alt="QueueTurn — Smart Queue Management" className="w-52 sm:w-60 max-w-full h-auto object-contain" loading="lazy" />
        </a>
        <p className="text-[11px] text-slate-400">Digital Line Management · No app download required</p>
      </footer>
    </div>
  );
};
