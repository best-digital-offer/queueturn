import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Users, 
  CheckCircle2, 
  SkipForward, 
  ArrowUpRight,
  Flame,
  Award
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';

export const AnalyticsTab: React.FC = () => {
  const { activeQueue, getAnalytics } = useQueue();

  if (!activeQueue) return null;

  const stats = getAnalytics(activeQueue.id);

  const maxHourCount = Math.max(...stats.hourlyVolume.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Queue Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Visitor volume, wait duration benchmarks, and service speed statistics.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Visitors</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold font-mono-numbers text-slate-900">
              {stats.totalToday}
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              +18% compared to yesterday
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold font-mono-numbers text-slate-900">
              {stats.completed}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              94% completion rate
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Wait Time</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold font-mono-numbers text-slate-900">
              {stats.avgWaitMinutes} <span className="text-sm font-normal text-slate-500">min</span>
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
              -3 min vs last week average
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Peak Hour</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-900 mt-1">
              {stats.peakHour}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Highest check-in influx
            </p>
          </div>
        </div>
      </div>

      {/* Hourly Chart Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Today's Hourly Traffic</h2>
            <p className="text-xs text-slate-500 mt-0.5">Check-in density by hour of the day</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
            Real-time Aggregation
          </span>
        </div>

        <div className="pt-4">
          <div className="h-48 flex items-end justify-between gap-2 sm:gap-4 px-2">
            {stats.hourlyVolume.map((item) => {
              const heightPercent = Math.round((item.count / maxHourCount) * 100);
              const isPeak = item.count === maxHourCount;

              return (
                <div key={item.hour} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[11px] font-bold font-mono-numbers text-slate-600 group-hover:text-indigo-600 transition">
                    {item.count}
                  </span>
                  <div className="w-full bg-slate-100 rounded-xl h-36 flex items-end p-1">
                    <div 
                      className={`w-full rounded-lg transition-all duration-500 ${
                        isPeak 
                          ? 'bg-gradient-to-t from-indigo-600 to-indigo-500 shadow-sm shadow-indigo-300' 
                          : 'bg-slate-300 group-hover:bg-indigo-400'
                      }`}
                      style={{ height: `${Math.max(12, heightPercent)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                    {item.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Efficiency Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Customer Patience Benchmark</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Because customers can view their live position and estimated wait time from their smartphone without being tied to the physical waiting room, line walkaways dropped by <strong>82%</strong>.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            98.5% visitor satisfaction rate
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Front Desk Efficiency</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Staff average <strong>1 click</strong> per patient turnaround, eliminating manual clipboard names, repeated shouting in the lobby, and lost tickets.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-indigo-600">
            <Award className="w-4 h-4" />
            Zero app installation friction
          </div>
        </div>
      </div>
    </div>
  );
};
