import React from 'react';
import { LayoutDashboard, Smartphone, Tv, Sparkles, RotateCcw, ExternalLink, Home } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';

interface DemoControlBarProps {
  currentView: 'landing' | 'dashboard' | 'customer' | 'display' | 'admin' | 'seo';
  onNavigate: (view: 'landing' | 'dashboard' | 'customer' | 'display' | 'admin' | 'seo', params?: string) => void;
  activeQueueSlug?: string;
  businessSlug?: string;
}

export const DemoControlBar: React.FC<DemoControlBarProps> = ({
  currentView,
  onNavigate,
  activeQueueSlug = 'general-service',
  businessSlug = 'abc-clinic',
}) => {
  const { resetDemoData } = useQueue();

  const customerUrl = `${window.location.origin}/?view=customer&q=${businessSlug}/${activeQueueSlug}`;
  const displayUrl = `${window.location.origin}/?view=display&q=${activeQueueSlug}`;

  return (
    <aside aria-label="Demo environment controls" className="bg-slate-900 text-white text-xs py-2 px-3 sm:px-6 sticky top-0 z-50 shadow-md border-b border-slate-800 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            Live Demo Mode
          </span>
          <span className="hidden md:inline text-slate-300 text-xs">
            Test real-time sync across devices:
          </span>
        </div>

        <nav aria-label="Quick test mode switcher" className="flex items-center flex-wrap gap-1">
          <button
            onClick={() => onNavigate('landing')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              currentView === 'landing'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </button>

          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              currentView === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Staff Dashboard
          </button>

          <button
            onClick={() => onNavigate('customer', `${businessSlug}/${activeQueueSlug}`)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              currentView === 'customer'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Customer Mobile View
          </button>

          <button
            onClick={() => onNavigate('display')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              currentView === 'display'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            TV Display Screen
          </button>

        </nav>

        <div className="flex items-center gap-2">
          {currentView === 'dashboard' && (
            <button
              onClick={() => {
                window.open(customerUrl, '_blank');
              }}
              className="text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded text-[11px] font-medium hidden sm:flex items-center gap-1"
              title="Open customer phone in a separate tab to test live sync"
            >
              <ExternalLink className="w-3 h-3" />
              New Tab (Customer)
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm('Reset queue demo data back to default (A21-A26)?')) {
                resetDemoData();
              }
            }}
            className="text-slate-300 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 border border-slate-700/60"
            title="Reset ABC Clinic demo data"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Demo
          </button>
        </div>
      </div>
    </aside>
  );
};
