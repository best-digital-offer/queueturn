import React, { useMemo, useState } from 'react';
import { Search, Download, CheckCircle2 } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { EntryStatus } from '../../types/queue';

export const CustomersTab: React.FC = () => {
  const { activeQueue, state, callSpecific } = useQueue();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQueueId, setSelectedQueueId] = useState('all');
  const [selectedDate, setSelectedDate] = useState('all');

  const businessQueues = state.queues.filter((queue) => queue.businessId === state.currentBusinessId);
  const businessQueueIds = new Set(businessQueues.map((queue) => queue.id));
  const queueById = new Map(businessQueues.map((queue) => [queue.id, queue]));
  const allEntries = state.entries.filter((entry) => businessQueueIds.has(entry.queueId));

  const dateKey = (value: string) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const formatDate = (value: string) => {
    const key = dateKey(value);
    if (!key) return '—';
    return new Date(key + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const availableDates = useMemo(() => Array.from(new Set(allEntries.map((entry) => dateKey(entry.joinedAt)).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [state.entries, state.currentBusinessId, state.queues]);

  const filteredEntries = allEntries.filter((entry) => {
    const queue = queueById.get(entry.queueId);
    const matchesStatus = filterStatus === 'all' || entry.status === filterStatus;
    const matchesQueue = selectedQueueId === 'all' || entry.queueId === selectedQueueId;
    const matchesDate = selectedDate === 'all' || dateKey(entry.joinedAt) === selectedDate;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      entry.displayNumber.toLowerCase().includes(query) ||
      (entry.customerName || '').toLowerCase().includes(query) ||
      (entry.customerPhone || '').toLowerCase().includes(query) ||
      (entry.notes || '').toLowerCase().includes(query) ||
      (queue?.name || '').toLowerCase().includes(query);
    return matchesStatus && matchesQueue && matchesDate && matchesSearch;
  }).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));

  const exportCsv = () => {
    const headers = ['Date', 'Queue Name', 'Ticket Number', 'Customer Name', 'Phone', 'Status', 'Joined At', 'Called At', 'Completed At', 'Counter'];
    const rows = filteredEntries.map((entry) => [
      dateKey(entry.joinedAt),
      queueById.get(entry.queueId)?.name || '',
      entry.displayNumber,
      entry.customerName || '',
      entry.customerPhone || '',
      entry.status,
      entry.joinedAt,
      entry.calledAt || '',
      entry.completedAt || '',
      entry.counterName || '',
    ]);
    const escapeCsv = (value: string) => '"' + value.replace(/"/g, '""') + '"';
    const csvContent = [headers, ...rows].map((row) => row.map((value) => escapeCsv(String(value))).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `queueturn_customers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: EntryStatus) => {
    switch (status) {
      case 'serving':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700">Serving</span>;
      case 'waiting':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700">Waiting</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">Completed</span>;
      case 'skipped':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600">Skipped</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-600">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Customer history across all queues, organized by service date and queue name.
          </p>
        </div>
        <button onClick={exportCsv} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input type="text" placeholder="Search customer, ticket, or queue..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filter by queue" value={selectedQueueId} onChange={(e) => setSelectedQueueId(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700">
            <option value="all">All queues</option>
            {businessQueues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}</option>)}
          </select>
          <select aria-label="Filter by date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700">
            <option value="all">All dates</option>
            {availableDates.map((date) => <option key={date} value={date}>{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'waiting', 'serving', 'completed', 'skipped', 'cancelled'].map((tab) => (
            <button key={tab} onClick={() => setFilterStatus(tab)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition ${filterStatus === tab ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-400 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Queue Name</th>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined At</th>
                <th className="py-3 px-4">Called At</th>
                <th className="py-3 px-4">Station</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length > 0 ? filteredEntries.map((entry) => {
                const queue = queueById.get(entry.queueId);
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{formatDate(entry.joinedAt)}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{queue?.name || 'Unknown queue'}</td>
                    <td className="py-3.5 px-4 font-mono-numbers font-black text-slate-900 text-sm">{entry.displayNumber}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {entry.customerName || <span className="text-slate-400 italic">Walk-in</span>}
                      {entry.customerPhone && <span className="block text-[10px] text-slate-400">{entry.customerPhone}</span>}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(entry.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{new Date(entry.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{entry.calledAt ? new Date(entry.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="py-3.5 px-4 text-slate-600">{entry.counterName || '—'}</td>
                    <td className="py-3.5 px-4 text-right">
                      {entry.status === 'waiting' && <button onClick={() => callSpecific(entry.id)} className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-[11px] transition">Call Now</button>}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">No customers found matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
