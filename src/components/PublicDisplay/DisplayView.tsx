import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Clock, 
  QrCode, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { findPublicQueue, getCloudQueueStats } from '../../services/cloudQueue';
import { supabase } from '../../services/supabaseClient';
import { soundService } from '../../services/sound';
import { QrCodeCanvas } from '../Common/QrCodeCanvas';

interface DisplayViewProps {
  queueSlug?: string;
  onExit?: () => void;
}

export const DisplayView: React.FC<DisplayViewProps> = ({ 
  queueSlug = 'general-service',
  onExit 
}) => {
  const { state } = useQueue();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundService.isSoundEnabled());
  const [currentTime, setCurrentTime] = useState('');
  const [animateNumber, setAnimateNumber] = useState(false);
  const [publicQueue, setPublicQueue] = useState<any>(null);
  const [publicStats, setPublicStats] = useState<any>(null);
  const [publicWaiting, setPublicWaiting] = useState<any[]>([]);

  const business = state.businesses[0];
  const queue = state.queues.find((q) => q.slug === queueSlug || q.id === queueSlug) || state.queues[0];

  const servingEntry = queue ? state.entries.find((e) => e.queueId === queue.id && e.status === 'serving') : null;
  const waitingEntries = queue ? state.entries.filter((e) => e.queueId === queue.id && e.status === 'waiting').slice(0, 5) : [];

  // Public TV screens can run on a separate device without an owner login.
  // Poll the public queue endpoints so they do not depend on stale local context.
  useEffect(() => {
    const db = supabase;
    if (!db || !queueSlug) return;
    let alive = true;
    const refresh = async () => {
      const found = await findPublicQueue(queueSlug, '');
      if (!alive || !found) return;
      setPublicQueue(found.queue);
      const stats = await getCloudQueueStats(found.queue.id);
      if (!alive || !stats) return;
      setPublicStats(stats);
      const { data, error } = await db.rpc('get_public_waiting_numbers', { p_queue_id: found.queue.id });
      if (!error && alive && Array.isArray(data)) {
        setPublicWaiting(data.slice(0, 5).map((v: any) => ({
          id: v.visitor_id || `${found.queue.id}-${v.queue_number}`,
          displayNumber: `${stats.prefix || found.queue.prefix || ''}${v.queue_number}`,
          status: 'waiting'
        })));
      }
    };
    void refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 3000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(poll);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queueSlug]);

  const liveQueue = publicQueue || queue;
  const liveServingEntry = publicQueue
    ? (publicStats?.current_number ? { displayNumber: `${publicStats.prefix || publicQueue.prefix || ''}${publicStats.current_number}`, counterName: 'Counter 1' } : null)
    : servingEntry;
  const liveWaitingEntries = publicQueue ? publicWaiting : waitingEntries;

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Trigger subtle pop animation when serving number changes
  useEffect(() => {
    if (servingEntry) {
      setAnimateNumber(true);
      const timer = setTimeout(() => setAnimateNumber(false), 800);
      return () => clearTimeout(timer);
    }
  }, [servingEntry?.displayNumber]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setSoundEnabled(next);
    if (next) {
      soundService.playChime();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keep printed display QR codes on the canonical custom domain.
  const qrUrl = `https://queueturn.com/?view=customer&q=${business?.slug || 'abc-clinic'}/${queue?.slug || 'general-service'}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-indigo-500 overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-600/30">
            {business?.name ? business.name.charAt(0) : 'Q'}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              {business?.name || 'ABC CLINIC'}
            </h1>
            <p className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">
              {liveQueue?.name || 'General Service'} • Live Queue Display
            </p>
          </div>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60 text-slate-200">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="font-mono-numbers text-sm font-bold tracking-widest">{currentTime}</span>
          </div>

          <button
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute announcement chime' : 'Enable announcement chime'}
            className={`p-2.5 rounded-xl border transition flex items-center gap-2 text-xs font-semibold ${
              soundEnabled 
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Announcement Audio Chime"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline">{soundEnabled ? 'Chime On' : 'Chime Muted'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen display' : 'Enter full screen display'}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {onExit && (
            <button
              onClick={onExit}
              className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-slate-300 border border-slate-700 transition font-medium"
            >
              Exit Display
            </button>
          )}
        </div>
      </header>

      {/* Main Display Grid */}
      <main className="flex-1 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-w-7xl mx-auto w-full">
        {/* Left Column: Huge Currently Serving (8 columns) */}
        <div className="lg:col-span-8 flex flex-col justify-center">
          <div className="bg-slate-900/90 rounded-3xl p-8 sm:p-12 border-2 border-indigo-500/30 shadow-2xl relative overflow-hidden text-center flex flex-col items-center justify-center min-h-[420px]">
            {/* Background glowing aura */}
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center space-x-2 px-5 py-2 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-sm font-bold uppercase tracking-widest mb-4">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>NOW SERVING</span>
            </div>

            {liveServingEntry ? (
              <div className="space-y-4">
                <div 
                  className={`text-8xl sm:text-9xl lg:text-[140px] font-black font-mono-numbers tracking-tight text-white drop-shadow-md transition-transform duration-300 ${
                    animateNumber ? 'scale-110 text-emerald-300' : 'scale-100'
                  }`}
                >
                  {liveServingEntry.displayNumber}
                </div>

                <div className="mt-4 pt-6 border-t border-slate-800/80 inline-block px-8 py-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                  <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider block">Please proceed to</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1 block">
                    {liveServingEntry.counterName || 'Counter 1'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-slate-500 space-y-3">
                <div className="text-6xl sm:text-7xl font-mono-numbers font-bold text-slate-700">
                  —
                </div>
                <p className="text-xl font-semibold text-slate-400">Please wait for the next announcement</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Next in Line & QR Code Joiner (4 columns) */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-6">
          {/* Next Up Card */}
          <div className="bg-slate-900/80 rounded-3xl p-6 border border-slate-800/80 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">NEXT IN LINE</span>
              <span className="text-xs font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800/50">
                {(publicQueue ? Number(publicStats?.total_waiting || 0) : waitingEntries.length)} Waiting
              </span>
            </div>

            <div className="mt-4 space-y-2.5 flex-1">
              {liveWaitingEntries.length > 0 ? (
                liveWaitingEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition ${
                      idx === 0 
                        ? 'bg-indigo-950/40 border-indigo-500/40 text-white' 
                        : 'bg-slate-800/40 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold text-slate-500 w-5">#{idx + 1}</span>
                      <span className="text-2xl font-black font-mono-numbers tracking-tight text-white">
                        {entry.displayNumber}
                      </span>
                    </div>
                    {idx === 0 ? (
                      <span className="text-[11px] font-bold text-amber-300 bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-800/40">
                        Up Next
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Waiting</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm font-medium">No one currently in line</p>
                </div>
              )}
            </div>
          </div>

          {/* Join From Phone QR Box */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950/50 rounded-3xl p-5 border border-indigo-500/20 shadow-xl flex items-center space-x-4">
            <div className="bg-white p-2 rounded-2xl shrink-0 shadow-sm">
              <QrCodeCanvas url={qrUrl} size={100} className="p-0 border-0 shadow-none" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40 mb-1">
                <QrCode className="w-3 h-3" />
                Scan QR Code
              </span>
              <h2 className="text-base font-extrabold text-white leading-tight">Join From Your Phone</h2>
              <p className="text-xs text-slate-400 mt-1">No app needed. Get a ticket and wait anywhere.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer ticker */}
      <footer className="px-6 py-3 border-t border-slate-800/80 bg-slate-900/40 text-center text-xs text-slate-400">
        <span>Queue Turn (queueturn.com) Digital Queue System • Real-Time Synchronization Active</span>
      </footer>
    </div>
  );
};
