import React from 'react';
import { ShieldCheck, Building2, ListOrdered, Users, CreditCard, Activity, ArrowLeft } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';

interface AdminPanelProps {
  onBackToDashboard: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToDashboard }) => {
  const { state } = useQueue();

  const totalBusinesses = state.businesses.length + 142;
  const activeBusinesses = totalBusinesses - 12;
  const totalQueues = state.queues.length + 384;
  const visitorsToday = state.entries.length + 4210;

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={onBackToDashboard}
              className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Business Dashboard
            </button>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Queue Turn SaaS Admin</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Platform overview & global metrics</p>
          </div>

          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
            Platform Operational
          </span>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Businesses</span>
            <div className="text-3xl font-extrabold font-mono-numbers text-slate-900 mt-2">
              {totalBusinesses}
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">+14 this week</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Lines</span>
            <div className="text-3xl font-extrabold font-mono-numbers text-slate-900 mt-2">
              {totalQueues}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Across 8 industries</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Visitors Today</span>
            <div className="text-3xl font-extrabold font-mono-numbers text-slate-900 mt-2">
              {visitorsToday}
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">99.8% served without app</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Monthly Subscriptions</span>
            <div className="text-3xl font-extrabold font-mono-numbers text-slate-900 mt-2">
              $3,840
            </div>
            <p className="text-[11px] text-indigo-600 font-semibold mt-1">MRR Benchmark</p>
          </div>
        </div>

        {/* Subscription breakdown & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Subscription Breakdown</h2>
            <div className="space-y-3">
              {[
                { plan: 'Pro ($19/mo)', count: 88, percent: '62%' },
                { plan: 'Starter ($9/mo)', count: 34, percent: '24%' },
                { plan: 'Business ($49/mo)', count: 12, percent: '8%' },
                { plan: 'Free Tier', count: 8, percent: '6%' },
              ].map((sub, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{sub.plan}</span>
                  <span className="font-bold text-slate-900 font-mono-numbers">{sub.count} ({sub.percent})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Recent Businesses on Platform</h2>
            <div className="divide-y divide-slate-100 text-xs">
              {state.businesses.map((biz) => (
                <div key={biz.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{biz.name}</span>
                    <span className="text-[10px] text-slate-400 capitalize">{biz.businessType} • {biz.ownerEmail}</span>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold text-[11px]">
                    Active
                  </span>
                </div>
              ))}
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Downtown Dental Care</span>
                  <span className="text-[10px] text-slate-400">Dental • contact@downtowndental.example</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold text-[11px]">
                  Active
                </span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">City Hall Motor Vehicles Dept</span>
                  <span className="text-[10px] text-slate-400">Government • services@citygov.example</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold text-[11px]">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
