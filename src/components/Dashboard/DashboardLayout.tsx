import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ListOrdered, 
  Users, 
  Tv, 
  QrCode, 
  BarChart3, 
  Settings, 
  UserCheck, 
  CreditCard, 
  LogOut, 
  Menu, 
  X, 
  ChevronDown,
  Building2,
  Sparkles
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { OverviewTab } from './OverviewTab';
import { QueuesTab } from './QueuesTab';
import { CustomersTab } from './CustomersTab';
import { DisplayTab } from './DisplayTab';
import { QrCodeTab } from './QrCodeTab';
import { AnalyticsTab } from './AnalyticsTab';
import { SettingsTab } from './SettingsTab';
import { StaffTab } from './StaffTab';
import { BillingTab } from './BillingTab';
import { supabase } from '../../services/supabaseClient';

interface DashboardLayoutProps {
  onNavigateHome: () => void;
  onOpenCustomerView: (queueSlug?: string) => void;
  onOpenDisplayView: (queueSlug?: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  onNavigateHome,
  onOpenCustomerView,
  onOpenDisplayView,
}) => {
  const { 
    currentBusiness, 
    activeQueue, 
    queues, 
    setActiveQueueId, 
    setCurrentUser, 
    state 
  } = useQueue();

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'queues' | 'customers' | 'display' | 'qrcode' | 'analytics' | 'settings' | 'staff' | 'billing'
  >(() => new URLSearchParams(window.location.search).get('tab') === 'billing' ? 'billing' : 'dashboard');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'queues', label: 'Queues / Appointments', icon: ListOrdered },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'display', label: 'Display Screen', icon: Tv },
    { id: 'qrcode', label: 'QR Code', icon: QrCode },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'staff', label: 'Staff Roles', icon: UserCheck },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as typeof activeTab);
    setMobileMenuOpen(false);
  };

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
      }
      setCurrentUser(null);
      onNavigateHome();
    } catch (error) {
      console.error('Could not sign out:', error);
      window.alert('Could not sign out. Please check your connection and try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-9 z-40">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base">
            Q
          </div>
          <div>
            <span className="font-extrabold text-sm text-slate-900">Queue Turn</span>
            <span className="text-[10px] text-slate-500 block leading-none">{currentBusiness?.name}</span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 flex flex-col h-full overflow-y-auto">
          {/* Logo & Business Selector */}
          <div className="pb-5 border-b border-slate-100">
            <div className="flex items-center space-x-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm shadow-indigo-200">
                Q
              </div>
              <div>
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">Queue Turn</span>
                <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-none">
                  Business Portal
                </span>
              </div>
            </div>

            {/* Business Badge */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{currentBusiness?.name || 'ABC Clinic'}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{currentBusiness?.businessType || 'Clinic'}</p>
                </div>
              </div>
            </div>

            {/* Active Queue Switcher */}
            {queues.length > 1 && (
              <div className="mt-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Active Queue
                </label>
                <select
                  value={activeQueue?.id}
                  onChange={(e) => setActiveQueueId(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-indigo-500"
                >
                  {queues.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name} ({q.prefix || 'No prefix'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="mt-5 space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer User & Logout */}
          <div className="pt-4 mt-auto border-t border-slate-100 space-y-2">
            <div className="px-3 py-2 flex items-center justify-between text-xs text-slate-600">
              <div className="truncate">
                <p className="font-bold text-slate-800 truncate">
                  {state.currentUser?.name || currentBusiness?.ownerName || 'Staff Member'}
                </p>
                <p className="text-[10px] text-slate-400 capitalize">{state.currentUser?.role || 'Owner'}</p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-60 disabled:cursor-wait"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {activeTab === 'dashboard' && (
          <OverviewTab
            onOpenCustomerView={() => onOpenCustomerView(activeQueue?.slug)}
            onOpenDisplayView={() => onOpenDisplayView(activeQueue?.slug)}
          />
        )}
        {activeTab === 'queues' && (
          <QueuesTab
            onOpenCustomerView={onOpenCustomerView}
            onOpenDisplayView={onOpenDisplayView}
            onManageQueue={(queueId) => {
              setActiveQueueId(queueId);
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
          />
        )}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'display' && (
          <DisplayTab onOpenDisplayView={() => onOpenDisplayView(activeQueue?.slug)} />
        )}
        {activeTab === 'qrcode' && (
          <QrCodeTab
            onOpenCustomerView={() => onOpenCustomerView(activeQueue?.slug)}
            onOpenDisplayView={() => onOpenDisplayView(activeQueue?.slug)}
          />
        )}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'billing' && <BillingTab />}
      </main>
    </div>
  );
};
