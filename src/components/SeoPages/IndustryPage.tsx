import React from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles, 
  QrCode, 
  Clock, 
  Users, 
  ShieldCheck, 
  HelpCircle,
  ArrowRight
} from 'lucide-react';

export interface IndustryConfig {
  slug: string;
  name: string;
  headline: string;
  subheading: string;
  heroBadge: string;
  benefits: string[];
  faqs: { question: string; answer: string }[];
}

export const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  'clinic-queue': {
    slug: 'clinic-queue',
    name: 'Clinics & Dental Practices',
    headline: 'Simple Digital Queue for Clinics & Dental Offices',
    subheading: 'Let patients join your waiting line from their phone. No app download. No crowded reception rooms.',
    heroBadge: 'Healthcare Waiting Line SaaS',
    benefits: [
      'Patients scan a QR code at check-in or outside in their car',
      'Receive instant ticket (e.g. A27) with live countdown of people ahead',
      'Reduces lobby congestion and germ transmission risk',
      'Staff advances line with one click and announces patient by ticket or room',
    ],
    faqs: [
      {
        question: 'Do patients need to create an account or provide medical records?',
        answer: 'Never. Queue Turn is 100% anonymous and lightweight. Patients simply scan and wait.',
      },
      {
        question: 'Can receptionists still add walk-ins without smartphones?',
        answer: 'Yes! Reception staff can click "Add Walk-in Guest" directly from the dashboard.',
      },
      {
        question: 'Can we show the queue on a wall-mounted TV in our lobby?',
        answer: 'Yes. Queue Turn provides a dedicated TV display screen with audio chimes and next-up tickets.',
      },
    ],
  },
  'salon-queue': {
    slug: 'salon-queue',
    name: 'Salons & Barbershops',
    headline: 'Eliminate Paper Sign-In Sheets at Your Salon',
    subheading: 'Allow walk-in clients to scan, check estimated wait times, and browse nearby shops until their chair is ready.',
    heroBadge: 'Salons & Barbershops',
    benefits: [
      'No messy clipboard paper sign-up sheets or lost handwriting',
      'Clients can grab a coffee next door while watching their live queue position',
      'Stylists can claim next client directly from their phone or workstation tablet',
      'Reduces front lobby clutter during peak Saturday rushes',
    ],
    faqs: [
      {
        question: 'Can clients see how long until their turn?',
        answer: 'Yes, based on your configured average service duration, clients see estimated wait times in real time.',
      },
      {
        question: 'Does this replace our appointment calendar?',
        answer: 'Queue Turn is specifically designed for walk-ins and same-day waiting lists, functioning harmoniously alongside scheduled appointments.',
      },
    ],
  },
  'auto-repair-queue': {
    slug: 'auto-repair-queue',
    name: 'Auto Repair & Service Centers',
    headline: 'Organize Walk-in Vehicle Service Without Front Desk Clutter',
    subheading: 'Let motorists check in their vehicle, wait outside or in comfortable lounge seating, and get called when their service bay is ready.',
    heroBadge: 'Automotive & Quick Lube',
    benefits: [
      'Drivers check in right from their driver seat via poster QR code',
      'Service writers can route tickets directly to Bay 1, Bay 2, or Inspection Counter',
      'Live waiting monitor readable across loud garage floors with chime alerts',
      'Full daily history log with CSV exports for shop performance tracking',
    ],
    faqs: [
      {
        question: 'Can we route tickets to different service bays?',
        answer: 'Yes, Queue Turn supports multiple stations and service counters with dedicated assignments.',
      },
      {
        question: 'Does it work on shop tablets?',
        answer: 'Queue Turn is 100% responsive and runs seamlessly on iPads, Android tablets, and desktop workstations.',
      },
    ],
  },
  'restaurant-waitlist': {
    slug: 'restaurant-waitlist',
    name: 'Restaurants & Cafés',
    headline: 'Digital Waiting Line for Busy Restaurants',
    subheading: 'Say goodbye to expensive pager buzzers that get lost or stolen. Guests scan your front door QR code and wait nearby.',
    heroBadge: 'Restaurants & Hospitality',
    benefits: [
      'Replaces lost and broken buzzer hardware ($800+ hardware savings)',
      'Guests can stroll around the block without fearing they will lose their table',
      'Automatic chime notifications and turn celebration alerts right on mobile screens',
      'Hostess advances queue with a single tap on host stand tablet',
    ],
    faqs: [
      {
        question: 'What happens if a guest wanders away?',
        answer: 'Their phone shows live progress and alerts them when they are 1 party away.',
      },
      {
        question: 'Can hostesses skip no-show parties?',
        answer: 'Yes, with a single tap on the Skip button.',
      },
    ],
  },
};

interface IndustryPageProps {
  industrySlug: string;
  onGetStarted: () => void;
  onBackToHome: () => void;
}

export const IndustryPage: React.FC<IndustryPageProps> = ({
  industrySlug,
  onGetStarted,
  onBackToHome,
}) => {
  const config = INDUSTRY_CONFIGS[industrySlug] || INDUSTRY_CONFIGS['clinic-queue'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-9 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="flex items-center text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Queue Turn Home
          </button>

          <button
            onClick={onGetStarted}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Start Free Queue
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 sm:py-24 px-6 text-center max-w-4xl mx-auto space-y-6">
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          {config.heroBadge}
        </span>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
          {config.headline}
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {config.subheading}
        </p>

        <div className="pt-4 flex flex-wrap justify-center gap-3">
          <button
            onClick={onGetStarted}
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-200 transition flex items-center gap-2"
          >
            <span>Create Your Free Queue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-xs space-y-8">
          <h2 className="text-2xl font-black text-slate-900 text-center">
            Why {config.name} Choose Queue Turn
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {config.benefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <span className="text-sm font-semibold text-slate-700 leading-snug">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h2 className="text-2xl font-black text-slate-900 text-center">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          {config.faqs.map((faq, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <h3 className="text-base font-bold text-slate-900">{faq.question}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-6 text-center bg-slate-900 text-white">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-black">Ready to modernize your waiting line?</h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Setup takes under 2 minutes. No credit card required.
          </p>
          <button
            onClick={onGetStarted}
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-md transition inline-flex items-center gap-2"
          >
            <span>Start Free Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
};
