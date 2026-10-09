/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { QueueProvider, useQueue } from './context/QueueContext';
import { DemoControlBar } from './components/Common/DemoControlBar';
import { LandingPage } from './components/LandingPage';
import { DashboardLayout } from './components/Dashboard/DashboardLayout';
import { CustomerView } from './components/CustomerQueue/CustomerView';
import { DisplayView } from './components/PublicDisplay/DisplayView';
import { AdminPanel } from './components/Admin/AdminPanel';
import { IndustryPage } from './components/SeoPages/IndustryPage';
import { AuthModal } from './components/Auth/AuthModal';

function AppContent() {
  const { currentBusiness, activeQueue } = useQueue();

  // Read URL query params on initial load
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'customer' | 'display' | 'admin' | 'seo'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam === 'customer') return 'customer';
      if (viewParam === 'display') return 'display';
      if (viewParam === 'dashboard') return 'dashboard';
      if (viewParam === 'admin') return 'admin';
      if (viewParam === 'seo') return 'seo';
    }
    return 'landing';
  });

  const [activeQueueSlug, setActiveQueueSlug] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) {
        const parts = q.split('/');
        return parts.length > 1 ? parts[1] : parts[0];
      }
    }
    return 'general-service';
  });

  const [activeBusinessSlug, setActiveBusinessSlug] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) {
        const parts = q.split('/');
        return parts.length > 1 ? parts[0] : 'abc-clinic';
      }
    }
    return 'abc-clinic';
  });

  const [selectedIndustrySlug, setSelectedIndustrySlug] = useState<string>('clinic-queue');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');

  // Handle browser popstate / back button
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam === 'customer') setCurrentView('customer');
      else if (viewParam === 'display') setCurrentView('display');
      else if (viewParam === 'dashboard') setCurrentView('dashboard');
      else if (viewParam === 'admin') setCurrentView('admin');
      else if (viewParam === 'seo') setCurrentView('seo');
      else setCurrentView('landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (
    view: 'landing' | 'dashboard' | 'customer' | 'display' | 'admin' | 'seo',
    params?: string
  ) => {
    setCurrentView(view);
    if (view === 'customer' && params) {
      const parts = params.split('/');
      if (parts.length > 1) {
        setActiveBusinessSlug(parts[0]);
        setActiveQueueSlug(parts[1]);
      } else {
        setActiveQueueSlug(params);
      }
    } else if (view === 'display' && params) {
      setActiveQueueSlug(params);
    }
    // Update URL shallowly
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (view === 'landing') {
        url.search = '';
      } else {
        url.searchParams.set('view', view);
        if (params) {
          url.searchParams.set('q', params);
        }
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      {/* Top Demo Simulation Switcher */}
      <DemoControlBar
        currentView={currentView}
        onNavigate={handleNavigate}
        activeQueueSlug={activeQueue?.slug || activeQueueSlug}
        businessSlug={currentBusiness?.slug || activeBusinessSlug}
      />

      {/* Main View Router */}
      <div className="flex-1 flex flex-col">
        {currentView === 'landing' && (
          <LandingPage
            onStartFree={() => {
              setAuthModalMode('signup');
              setAuthModalOpen(true);
            }}
            onOpenDemoDashboard={() => handleNavigate('dashboard')}
            onOpenDemoCustomer={() => handleNavigate('customer', `${activeBusinessSlug}/${activeQueueSlug}`)}
            onOpenDemoDisplay={() => handleNavigate('display', activeQueueSlug)}
            onSelectIndustry={(slug) => {
              setSelectedIndustrySlug(slug);
              handleNavigate('seo');
            }}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardLayout
            onNavigateHome={() => handleNavigate('landing')}
            onOpenCustomerView={(slug) => handleNavigate('customer', slug || activeQueueSlug)}
            onOpenDisplayView={(slug) => handleNavigate('display', slug || activeQueueSlug)}
          />
        )}

        {currentView === 'customer' && (
          <CustomerView
            onBackToHome={() => handleNavigate('landing')}
            queueSlug={activeQueueSlug}
            businessSlug={activeBusinessSlug}
          />
        )}

        {currentView === 'display' && (
          <DisplayView
            queueSlug={activeQueueSlug}
            onExit={() => handleNavigate('dashboard')}
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel onBackToDashboard={() => handleNavigate('dashboard')} />
        )}

        {currentView === 'seo' && (
          <IndustryPage
            industrySlug={selectedIndustrySlug}
            onGetStarted={() => {
              setAuthModalMode('signup');
              setAuthModalOpen(true);
            }}
            onBackToHome={() => handleNavigate('landing')}
          />
        )}
      </div>

      {/* Authentication & Business Onboarding Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          handleNavigate('dashboard');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueueProvider>
      <AppContent />
    </QueueProvider>
  );
}
