import React, { useState } from 'react';
import { Search, Download, Filter, CheckCircle2, Clock, SkipForward, XCircle, Sparkles } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { EntryStatus } from '../../types/queue';

export const CustomersTab: React.FC = () => {
  const { activeQueue, state, callSpecific, removeEntry } = useQueue();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!activeQueue) return null;

  const queueEntries = state.entries.filter((e) => e.queueId === activeQueue.id);

  const filteredEntries = queueEntries.filter((entry) => {
    const matchesStatus = filterStatus === 'all' || entry.status === filterStatus;
    const matchesSearch = 
      entry.displayNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.customerName && entry.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (entry.notes && entry.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const exportCsv = () => {
    const headers = ['Number', 'Name', 'Phone', 'Status', 'JoinedAt', 'CalledAt', 'CompletedAt', 'Counter'];
    const rows = filteredEntries.map((e) => [
      e.displayNumber,
      e.customerName || '',
      e.customerPhone || '',
      e.status,
      e.joinedAt,
      e.calledAt || '',
      e.completedAt || '',
      e.counterName || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `queueturn_${activeQueue.slug}_customers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            Log of all tickets issued, current visitors, and completed appointments for {activeQueue.name}.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search number or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'waiting', 'serving', 'completed', 'skipped'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition ${
                filterStatus === tab
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-400 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
              <tr>
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
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono-numbers font-black text-slate-900 text-sm">
                      {entry.displayNumber}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {entry.customerName || <span className="text-slate-400 italic">Walk-in</span>}
                      {entry.customerPhone && (
                        <span className="block text-[10px] text-slate-400">{entry.customerPhone}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(entry.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(entry.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {entry.calledAt 
                        ? new Date(entry.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {entry.counterName || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {entry.status === 'waiting' && (
                        <button
                          onClick={() => callSpecific(entry.id)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-[11px] transition"
                        >
                          Call Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No customers found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
