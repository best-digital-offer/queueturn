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
import { IndustryPage } from './components/SeoPages/IndustryPage';
import { AuthModal } from './components/Auth/AuthModal';
import { supabase } from './services/supabaseClient';
import { LegalPages } from './components/LegalPages';
import { WelcomePage } from './components/Billing/WelcomePage';

function AppContent() {
  const { currentBusiness, activeQueue, state } = useQueue();
  // Demo storage includes a fake demo user, so authentication must come from Supabase,
  // never from state.currentUser. This prevents fresh browsers from treating demo data
  // as a real signed-in business account.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const isSignedIn = isAuthenticated === true;

  useEffect(() => {
    if (!supabase) {
      setIsAuthenticated(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setIsAuthenticated(Boolean(data.session?.user));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Read URL query params on initial load
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'customer' | 'display' | 'admin' | 'seo' | 'legal' | 'welcome'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/welcome') return 'welcome';
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      if (pageParam) return 'legal';
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
      if (window.location.pathname === '/welcome') { setCurrentView('welcome'); return; }
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
    view: 'landing' | 'dashboard' | 'customer' | 'display' | 'admin' | 'seo' | 'legal',
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
      } else if (view === 'legal') {
        url.search = params || '?page=about';
      } else {
        url.searchParams.set('view', view);
        if (params) {
          url.searchParams.set('q', params);
        }
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  // After authentication, send users straight to their dashboard rather than the marketing home.
  useEffect(() => {
    if (isSignedIn && currentView === 'landing' && !sessionStorage.getItem('queueturn-pending-checkout')) {
      setCurrentView('dashboard');
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'dashboard');
      window.history.replaceState({}, '', url.toString());
    }
  }, [isSignedIn, currentView]);

  // A dashboard URL opened in a fresh browser must not silently show seeded demo data.
  // Ask the visitor to sign in, then load their own Supabase business and queues.
  useEffect(() => {
    if (isAuthenticated === false && currentView === 'dashboard') {
      setCurrentView('landing');
      setAuthModalMode('login');
      setAuthModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isAuthenticated, currentView]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      {/* Public marketing home is only shown before sign-in. */}
      {!isSignedIn && currentView !== 'welcome' && <DemoControlBar
        currentView={currentView}
        onNavigate={handleNavigate}
        activeQueueSlug={activeQueue?.slug || activeQueueSlug}
        businessSlug={currentBusiness?.slug || activeBusinessSlug}
      />}

      {/* Main View Router */}
      <div className="flex-1 flex flex-col">
        {currentView === 'legal' && <LegalPages page={new URLSearchParams(window.location.search).get('page') || 'about'} />}
        {currentView === 'welcome' && <WelcomePage onContinue={() => {
          const url = new URL('/', window.location.origin);
          url.searchParams.set('view', 'dashboard');
          window.history.replaceState({}, '', url.toString());
          setCurrentView('dashboard');
        }} />}

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
            onSubscribe={(plan, cycle) => {
              if (isSignedIn) {
                const url = new URL(window.location.href);
                url.searchParams.set('view', 'dashboard');
                url.searchParams.set('tab', 'billing');
                url.searchParams.set('subscribe', plan);
                url.searchParams.set('cycle', cycle);
                window.history.pushState({}, '', url.toString());
                setCurrentView('dashboard');
                return;
              }
              sessionStorage.setItem('queueturn-pending-checkout', JSON.stringify({ plan, cycle }));
              setAuthModalMode('signup');
              setAuthModalOpen(true);
            }}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardLayout
            onNavigateHome={() => handleNavigate('landing')}
            onOpenCustomerView={(slug) => { const target = slug || activeQueueSlug; handleNavigate('customer', target.includes('/') ? target : (currentBusiness?.slug || activeBusinessSlug) + '/' + target); }}
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
          const pending = sessionStorage.getItem('queueturn-pending-checkout');
          if (pending) {
            try {
              const selection = JSON.parse(pending) as { plan: string; cycle: string };
              if (['starter', 'pro', 'unlimited'].includes(selection.plan)
                  && ['monthly', 'annual'].includes(selection.cycle)) {
                const url = new URL(window.location.href);
                url.searchParams.set('view', 'dashboard');
                url.searchParams.set('tab', 'billing');
                url.searchParams.set('subscribe', selection.plan);
                url.searchParams.set('cycle', selection.cycle);
                window.history.replaceState({}, '', url.toString());
              }
            } catch {
              // Ignore malformed stale browser state; authentication should still succeed.
            } finally {
              sessionStorage.removeItem('queueturn-pending-checkout');
            }
          }
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
