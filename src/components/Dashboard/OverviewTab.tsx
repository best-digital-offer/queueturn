import React, { useState } from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  Play, 
  Pause, 
  RotateCcw, 
  UserPlus, 
  Sparkles, 
  Volume2, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { soundService } from '../../services/sound';

interface OverviewTabProps {
  onOpenCustomerView: () => void;
  onOpenDisplayView: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ 
  onOpenCustomerView, 
  onOpenDisplayView 
}) => {
  const {
    activeQueue,
    counters,
    waitingEntries,
    servingEntry,
    completedEntries,
    skippedEntries,
    callNext,
    skipEntry,
    completeEntry,
    pauseQueue,
    resumeQueue,
    resetQueue,
    addWalkIn,
  } = useQueue();

  const [selectedCounterId, setSelectedCounterId] = useState<string>('');
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInNotes, setWalkInNotes] = useState('');
  const [isCallingNext, setIsCallingNext] = useState(false);
  const isFutureScheduled = Boolean(activeQueue?.scheduledFor && activeQueue.scheduledFor > (() => { const now = new Date(); return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); })());

  if (!activeQueue) {
    return (
      <div className="p-8 text-center text-slate-500">
        Please select or create a queue to begin.
      </div>
    );
  }

  const handleNextCustomer = async () => {
    soundService.prepareForAnnouncement();
    setIsCallingNext(true);
    try {
      await callNext(activeQueue.id, selectedCounterId || undefined);
    } finally {
      setIsCallingNext(false);
    }
  };

  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    addWalkIn(activeQueue.id, walkInName, walkInPhone, walkInNotes);
    setWalkInName('');
    setWalkInPhone('');
    setWalkInNotes('');
    setShowWalkInModal(false);
  };

  const formatWaitTime = (joinedIso: string) => {
    const diffMs = Date.now() - new Date(joinedIso).getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    return `${mins}m`;
  };

  const formatJoinedTime = (joinedIso: string) => {
    return new Date(joinedIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{isFutureScheduled ? 'Scheduled Queue' : "Today's Queue"}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              activeQueue.status === 'active'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {activeQueue.status === 'active' ? '● Active' : '❚❚ Paused'}
            </span>
          </div>
          {isFutureScheduled && <p className="mt-1 text-xs font-semibold text-violet-700">Scheduled to open {new Date(activeQueue.scheduledFor + 'T12:00:00').toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</p>}
          <p className="text-sm text-slate-500 mt-0.5">
            Queue: <span className="font-semibold text-slate-700">{activeQueue.name}</span> (Prefix: {activeQueue.prefix || 'None'})
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button onClick={() => setShowWalkInModal(true)} className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />
            Add Appointment
          </button>
          <button onClick={onOpenCustomerView} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5" title="Open customer phone view">
            <ExternalLink className="w-3.5 h-3.5" />
            Customer View
          </button>
          <button onClick={onOpenDisplayView} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5" title="Open public display view">
            <ExternalLink className="w-3.5 h-3.5" />
            TV Display
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Currently Serving</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono-numbers text-indigo-600">{servingEntry ? servingEntry.displayNumber : 'None'}</span>
            {servingEntry && <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Waiting</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono-numbers text-slate-900">{waitingEntries.length}</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono-numbers text-slate-900">{completedEntries.length}</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Wait</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono-numbers text-slate-900">14 <span className="text-xs font-normal text-slate-500">min</span></span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Service Time</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono-numbers text-slate-900">{activeQueue.averageServiceMinutes} <span className="text-xs font-normal text-slate-500">min</span></span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">COUNTER STATION</span>
            {counters.length > 0 && (
              <select aria-label="Select service counter station" value={selectedCounterId || counters[0]?.id} onChange={(e) => setSelectedCounterId(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700">
                {counters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          <div className="text-center py-4 bg-gradient-to-b from-indigo-50/60 to-slate-50/50 rounded-2xl border border-indigo-100/60">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 block">NOW SERVING</span>
            <div className="text-6xl sm:text-7xl font-black font-mono-numbers tracking-tight text-slate-900 my-2">{servingEntry ? servingEntry.displayNumber : '—'}</div>
            {servingEntry ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">{servingEntry.customerName || 'Anonymous Visitor'}</p>
                <p className="text-xs text-slate-500">Assigned to: <span className="font-semibold text-indigo-600">{servingEntry.counterName || 'Counter 1'}</span></p>
                <div className="pt-2 flex justify-center gap-2">
                  <button onClick={() => soundService.announceTurn(servingEntry.displayNumber, servingEntry.counterName, activeQueue.announcementTemplate)} className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg text-xs font-semibold transition flex items-center gap-1" title="Re-announce turn">
                    <Volume2 className="w-3.5 h-3.5" />
                    Re-announce
                  </button>
                  <button onClick={() => skipEntry(servingEntry.id)} className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition">
                    Skip this customer
                  </button>
                  <button onClick={() => completeEntry(servingEntry.id)} className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Complete
                  </button>
                </div>
              </div>
            ) : <p className="text-xs text-slate-400">Ready for next patient or customer</p>}
          </div>

          <button onClick={handleNextCustomer} disabled={waitingEntries.length === 0 || isCallingNext || activeQueue.status === 'paused' || isFutureScheduled} className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-black text-lg tracking-wide shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition active:scale-[0.98] flex items-center justify-center space-x-2">
            {isCallingNext ? <span>Calling...</span> : waitingEntries.length === 0 ? <span>Queue Empty</span> : activeQueue.status === 'paused' ? <span>Queue Paused</span> : <><span>NEXT CUSTOMER</span><span className="text-indigo-200">({waitingEntries[0]?.displayNumber})</span><ArrowRight className="w-5 h-5 ml-1" /></>}
          </button>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            {activeQueue.status === 'active' ? (
              <button onClick={() => pauseQueue(activeQueue.id)} className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-amber-200"><Pause className="w-3.5 h-3.5" />Pause Queue</button>
            ) : (
              <button onClick={() => resumeQueue(activeQueue.id)} className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-emerald-200"><Play className="w-3.5 h-3.5" />Resume Queue</button>
            )}
            <button onClick={() => { if (window.confirm('Reset this queue? This will archive current numbers and reset sequence to starting number.')) resetQueue(activeQueue.id); }} className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-200" title="Reset sequence number"><RotateCcw className="w-3.5 h-3.5" />Reset</button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">Waiting Customers</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">{waitingEntries.length}</span>
            </div>
            <span className="text-xs text-slate-400">Sorted by arrival time</span>
          </div>

          <div className="mt-4 divide-y divide-slate-100 overflow-x-auto">
            {waitingEntries.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead><tr className="text-slate-400 font-semibold border-b border-slate-100"><th className="pb-2">Number</th><th className="pb-2">Customer</th><th className="pb-2">Joined</th><th className="pb-2">Wait Time</th><th className="pb-2 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {waitingEntries.map((entry, idx) => (
                    <tr key={entry.id} className="group hover:bg-slate-50 transition">
                      <td className="py-3 font-mono-numbers font-black text-slate-900 text-sm"><span className="inline-flex items-center gap-1.5">{idx === 0 && <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" title="Next up" />}{entry.displayNumber}</span></td>
                      <td className="py-3 font-medium text-slate-700">{entry.customerName || <span className="text-slate-400 italic">Walk-in</span>}{entry.notes && <span className="block text-[10px] text-slate-400 truncate max-w-[120px]">{entry.notes}</span>}</td>
                      <td className="py-3 text-slate-500">{formatJoinedTime(entry.joinedAt)}</td>
                      <td className="py-3 font-semibold text-slate-700">{formatWaitTime(entry.joinedAt)}</td>
                      <td className="py-3 text-right">
                        <button onClick={() => skipEntry(entry.id)} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition whitespace-nowrap" title="Skip this customer">Skip this customer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p className="font-semibold text-sm text-slate-600">No Customers Waiting</p><p className="text-xs text-slate-400 mt-1">Share your queue QR code or add an appointment above.</p></div>
            )}
          </div>
        </div>
      </div>

      {showWalkInModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Add Appointment</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">Add a customer appointment directly to this queue.</p>
            <form onSubmit={handleCreateWalkIn} className="space-y-3">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Patient Name</label><input type="text" placeholder="e.g. John Doe" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500" required /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Phone (Optional)</label><input type="tel" placeholder="(555) 123-4567" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label><input type="text" placeholder="e.g. Needs x-ray consultation" value={walkInNotes} onChange={(e) => setWalkInNotes(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowWalkInModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm">Add Appointment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
