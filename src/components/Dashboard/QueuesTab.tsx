import React, { useState } from 'react';
import { Plus, ListFilter, Check, Play, Pause, ExternalLink, Settings, Users, Clock, CalendarDays, Copy, CheckCheck, UserPlus } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';

interface QueuesTabProps {
  onOpenCustomerView: (queueSlug: string) => void;
  onOpenDisplayView: (queueSlug: string) => void;
}

export const QueuesTab: React.FC<QueuesTabProps> = ({ 
  onOpenCustomerView, 
  onOpenDisplayView 
}) => {
  const { 
    currentBusiness, 
    queues, 
    activeQueue, 
    setActiveQueueId, 
    createQueue, 
    addWalkIn,
    pauseQueue, 
    resumeQueue,
    state 
  } = useQueue();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [queueName, setQueueName] = useState('');
  const [prefix, setPrefix] = useState('B');
  const [startNumber, setStartNumber] = useState(1);
  const [avgServiceMinutes, setAvgServiceMinutes] = useState(10);
  const [allowEstimatedWait, setAllowEstimatedWait] = useState(true);
  const [scheduledFor, setScheduledFor] = useState('');
  const [copiedDisplayQueue, setCopiedDisplayQueue] = useState<string | null>(null);
  const [appointmentQueueId, setAppointmentQueueId] = useState<string | null>(null);
  const [appointmentName, setAppointmentName] = useState('');
  const [appointmentPhone, setAppointmentPhone] = useState('');
  const [appointmentError, setAppointmentError] = useState('');
  const [isAddingAppointment, setIsAddingAppointment] = useState(false);

  if (!currentBusiness) return null;

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetQueue = queues.find((queue) => queue.id === appointmentQueueId);
    if (!targetQueue || !appointmentName.trim()) { setAppointmentError('Enter the customer name to continue.'); return; }
    setIsAddingAppointment(true);
    setAppointmentError('');
    try {
      await addWalkIn(targetQueue.id, appointmentName.trim(), appointmentPhone.trim() || undefined);
      setAppointmentName(''); setAppointmentPhone(''); setAppointmentError(''); setAppointmentQueueId(null);
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : 'Could not add this appointment.');
    } finally { setIsAddingAppointment(false); }
  };

  const handleCreateQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueName.trim()) return;

    createQueue({
      businessId: currentBusiness.id,
      name: queueName.trim(),
      prefix: prefix.trim().toUpperCase(),
      startNumber: Number(startNumber) || 1,
      averageServiceMinutes: Number(avgServiceMinutes) || 10,
      allowEstimatedWait,
      scheduledFor: scheduledFor || undefined,
    });

    setQueueName('');
    setScheduledFor('');
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Queues</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage different service lines, consultation counters, or express queues.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create New Queue
        </button>
      </div>

      {/* Queues Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {queues.map((q) => {
          const isSelected = activeQueue?.id === q.id;
          const waitingCount = state.entries.filter((e) => e.queueId === q.id && e.status === 'waiting').length;
          const servingEntry = state.entries.find((e) => e.queueId === q.id && e.status === 'serving');

          return (
            <div
              key={q.id}
              className={`bg-white rounded-3xl p-6 border transition-all shadow-xs flex flex-col justify-between ${
                isSelected 
                  ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-indigo-100' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    q.scheduledFor && q.scheduledFor > (() => { const now = new Date(); return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); })()
                      ? 'bg-violet-50 text-violet-700 border border-violet-200'
                      : q.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {q.scheduledFor && q.scheduledFor > (() => { const now = new Date(); return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); })() ? '◷ Scheduled' : q.status === 'active' ? '● Active' : '❚❚ Paused'}
                  </span>
                  {isSelected && (
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                      Selected in Dashboard
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900">{q.name}</h3>
                {q.scheduledFor && q.scheduledFor > (() => { const now = new Date(); return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); })() && <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700"><CalendarDays className="w-3.5 h-3.5" /> Scheduled for {new Date(`${q.scheduledFor}T12:00:00`).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}</p>}
                <p className="text-xs text-slate-400 mt-0.5">Prefix: <span className="font-semibold text-slate-700">{q.prefix || 'None'}</span> • Next: #{q.nextNumber}</p>

                <div className="mt-5 grid grid-cols-2 gap-3 py-3 px-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Serving</span>
                    <p className="text-xl font-bold font-mono-numbers text-indigo-600 mt-0.5">
                      {servingEntry ? servingEntry.displayNumber : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Waiting</span>
                    <p className="text-xl font-bold font-mono-numbers text-slate-800 mt-0.5">
                      {waitingCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => { setAppointmentQueueId(q.id); setAppointmentError(''); }}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                  title={q.scheduledFor && q.scheduledFor > (() => { const now = new Date(); return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); })() ? 'Add future appointment' : 'Add customer'}
                  aria-label="Add customer or appointment"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveQueueId(q.id)}
                  disabled={isSelected}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition text-center ${
                    isSelected 
                      ? 'bg-slate-100 text-slate-400 cursor-default' 
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  {isSelected ? 'Active Now' : 'Manage Queue'}
                </button>

                <button
                  onClick={() => onOpenCustomerView(q.slug)}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition"
                  title="Open Customer View"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    const url = new URL(window.location.origin + '/');
                    url.searchParams.set('view','display');
                    url.searchParams.set('q',q.slug);
                    try { await navigator.clipboard.writeText(url.toString()); setCopiedDisplayQueue(q.id); window.setTimeout(()=>setCopiedDisplayQueue(current=>current===q.id?null:current),1800); }
                    catch { window.prompt('Copy this TV display link:', url.toString()); }
                  }}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition"
                  title="Copy TV Display Link"
                  aria-label="Copy TV Display Link"
                >
                  {copiedDisplayQueue === q.id ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>

                {q.status === 'active' ? (
                  <button
                    onClick={() => pauseQueue(q.id)}
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition"
                    title="Pause Queue"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => resumeQueue(q.id)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                    title="Resume Queue"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>


      {/* ADD CUSTOMER / FUTURE APPOINTMENT MODAL */}
      {appointmentQueueId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Add Customer / Appointment</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Add a customer directly to <strong>{queues.find((q) => q.id === appointmentQueueId)?.name}</strong>
              {queues.find((q) => q.id === appointmentQueueId)?.scheduledFor
                ? ` for ${new Date(`${queues.find((q) => q.id === appointmentQueueId)?.scheduledFor}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                : ' for the current service day'}.
            </p>
            <form onSubmit={handleAddAppointment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer name</label>
                <input autoFocus required value={appointmentName} onChange={(e) => setAppointmentName(e.target.value)} placeholder="Enter customer name" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone number (optional)</label>
                <input type="tel" value={appointmentPhone} onChange={(e) => setAppointmentPhone(e.target.value)} placeholder="Enter phone number" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              {appointmentError && <p role="alert" className="text-xs text-rose-600">{appointmentError}</p>}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => { setAppointmentQueueId(null); setAppointmentError(''); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={isAddingAppointment} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl text-xs font-bold">{isAddingAppointment ? "Adding…" : "Add Customer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE QUEUE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Create New Queue</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Add a department, counter, or specialty line.
            </p>

            <form onSubmit={handleCreateQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Queue Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Express Consultation, Lab Work"
                  value={queueName}
                  onChange={(e) => setQueueName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Number Prefix
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="e.g. B, LAB, E"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Starting Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={startNumber}
                    onChange={(e) => setStartNumber(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Queue Service Date (optional)
                </label>
                <input
                  type="date"
                  min={(() => { const now = new Date(); return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); })()}
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">Leave blank to start today. Future-dated queues won't accept tickets or allow staff to call customers until the selected date.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Average Service Time (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={avgServiceMinutes}
                  onChange={(e) => setAvgServiceMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="estWait"
                  checked={allowEstimatedWait}
                  onChange={(e) => setAllowEstimatedWait(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <label htmlFor="estWait" className="text-xs font-medium text-slate-700">
                  Show estimated wait time to customers on their phone
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Create Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
