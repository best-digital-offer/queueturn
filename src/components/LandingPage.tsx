import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  QrCode, 
  Smartphone, 
  LayoutDashboard, 
  Tv, 
  Check, 
  Users, 
  Clock, 
  ShieldCheck, 
  ChevronRight,
  Stethoscope,
  Scissors,
  Wrench,
  UtensilsCrossed,
  Building,
  Store,
  Laptop,
  CheckCircle2,
  Play,
  RotateCcw
} from 'lucide-react';
import { useQueue } from '../context/QueueContext';
import { QrCodeCanvas } from './Common/QrCodeCanvas';
import { PaddlePricingTable } from './Billing/PaddlePricingTable';
interface LandingPageProps {
  onStartFree: () => void;
  onOpenDemoDashboard: () => void;
  onOpenDemoCustomer: () => void;
  onOpenDemoDisplay: () => void;
  onSelectIndustry: (slug: string) => void;
  onSubscribe: (plan: 'starter' | 'pro' | 'unlimited', cycle: 'monthly' | 'annual') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartFree,
  onOpenDemoDashboard,
  onOpenDemoCustomer,
  onOpenDemoDisplay,
  onSelectIndustry,
  onSubscribe,
}) => {
  const { state, callNext } = useQueue();
  const [mockServing, setMockServing] = useState('A23');
  const [mockAhead, setMockAhead] = useState(3);
  const [mockNextInLine, setMockNextInLine] = useState(['A24', 'A25', 'A26', 'A27']);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Interactive Hero Widget Simulator
  const handleHeroNextCustomer = () => {
    setIsAdvancing(true);
    setTimeout(() => {
      if (mockNextInLine.length > 0) {
        const next = mockNextInLine[0];
        setMockServing(next);
        setMockNextInLine(mockNextInLine.slice(1));
        setMockAhead((prev) => Math.max(0, prev - 1));
      } else {
        setMockServing('A28');
        setMockNextInLine(['A29', 'A30']);
        setMockAhead(2);
      }
      setIsAdvancing(false);
    }, 200);
  };

  const handleResetHero = () => {
    setMockServing('A23');
    setMockAhead(3);
    setMockNextInLine(['A24', 'A25', 'A26', 'A27']);
  };

  const useCases = [
    {
      title: 'Clinics & Dental',
      description: 'Reduce crowded waiting rooms. Patients can check in and wait safely in their car or outdoor lounge until their examination room is prepared.',
      icon: Stethoscope,
      slug: 'clinic-queue',
      benefit: 'Zero lobby overcrowding',
    },
    {
      title: 'Salons & Barbers',
      description: 'Manage walk-ins without handwritten paper clipboards. Clients stroll nearby shops while tracking their live chair queue position.',
      icon: Scissors,
      slug: 'salon-queue',
      benefit: 'Ditch paper sign-ins',
    },
    {
      title: 'Auto Repair & Lube',
      description: 'Let drivers wait without hovering at reception. Call vehicles directly into Bay 1 or Bay 2 with clear lobby announcements.',
      icon: Wrench,
      slug: 'auto-repair-queue',
      benefit: 'Hands-free dispatch',
    },
    {
      title: 'Restaurants & Bars',
      description: 'Replace expensive lost buzzer pagers ($800+ hardware). Guests scan a QR at the host stand and receive real-time table alerts.',
      icon: UtensilsCrossed,
      slug: 'restaurant-waitlist',
      benefit: 'Save hardware costs',
    },
    {
      title: 'Service Centers',
      description: 'Organize walk-in warranty and technical requests smoothly across multiple counters without chaos.',
      icon: Laptop,
      slug: 'service-center-queue',
      benefit: 'Multi-counter support',
    },
    {
      title: 'Government & DMV',
      description: 'Simple digital visitor queues for licenses, permits, and municipal services without complex enterprise bloat.',
      icon: Building,
      slug: 'government-queue',
      benefit: 'Crystal-clear tickets',
    },
    {
      title: 'Retail Stores',
      description: 'Manage specialized customer service counters, returns desks, and fitting room lines with minimal staff overhead.',
      icon: Store,
      slug: 'retail-queue',
      benefit: 'Happier shoppers',
    },
    {
      title: 'Repair Shops',
      description: 'Keep electronics and bike repair customers informed with transparent, predictable wait benchmarks.',
      icon: Wrench,
      slug: 'repair-shop-queue',
      benefit: 'Predictable wait times',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white font-sans">
      {/* SaaS Navigation Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-9 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/queueturn-icon.svg" alt="" className="h-10 w-10 rounded-xl shadow-sm" />
            <div>
              <span className="font-extrabold text-xl tracking-tight"><span className="text-slate-900">Queue</span><span className="bg-gradient-to-r from-sky-500 via-violet-600 to-orange-500 bg-clip-text text-transparent">Turn</span></span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-7 text-xs font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-indigo-600 transition">How It Works</a>
            <a href="#use-cases" className="hover:text-indigo-600 transition">Use Cases</a>
            <a href="#features" className="hover:text-indigo-600 transition">Features</a>
            <a href="#pricing" className="hover:text-indigo-600 transition">Pricing</a>
            <a href="/blog/" className="hover:text-indigo-600 transition">Blog</a>
          </nav>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onOpenDemoDashboard}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            >
              Sign In
            </button>
            <button
              onClick={onStartFree}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm shadow-indigo-200 transition"
            >
              Start Free
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Simple Digital Queues. No App Required.
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Let customers join your queue from their phone.
          </h1>

          <p className="text-base sm:text-xl text-slate-600 leading-relaxed font-normal">
            A simple digital waiting line for clinics, salons, repair shops, service centers, restaurants, and local businesses. 
            <span className="font-semibold text-slate-900"> No app download required.</span>
          </p>

          <div className="pt-2 flex flex-wrap justify-center items-center gap-3">
            <button
              onClick={onStartFree}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition flex items-center gap-2"
            >
              <span>Start Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenDemoDashboard}
              className="px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl text-sm font-bold border border-slate-200/90 shadow-xs transition"
            >
              View Demo
            </button>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            ✓ Free 100-visitor tier • ✓ Ready in 2 minutes • ✓ Works on any mobile browser
          </p>
        </div>

        {/* HERO INTERACTIVE DUAL-DEVICE SHOWCASE */}
        <div className="mt-12 sm:mt-16 bg-gradient-to-b from-slate-100 to-slate-200/60 p-4 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xl max-w-5xl mx-auto">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-300/60">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
              <span className="text-xs font-bold text-slate-600 ml-2">Interactive Live Simulation: Click "Next Customer" below</span>
            </div>
            <button
              onClick={handleResetHero}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Simulation
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Desktop Dashboard Mockup (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold">
                <span className="text-slate-800">Staff Dashboard • ABC Clinic</span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Live Line</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-bold uppercase text-indigo-600">Currently Serving</span>
                  <div className="text-4xl font-black font-mono-numbers text-indigo-700 mt-0.5">
                    {mockServing}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Counter 1</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Waiting Line</span>
                  <div className="text-4xl font-black font-mono-numbers text-slate-800 mt-0.5">
                    {mockNextInLine.length}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Next: {mockNextInLine[0] || 'Done'}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleHeroNextCustomer}
                disabled={isAdvancing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl font-black text-sm tracking-wide shadow-md shadow-indigo-200 transition flex items-center justify-center space-x-2"
              >
                <span>NEXT CUSTOMER</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <div className="text-[11px] text-slate-500 flex justify-between items-center px-1">
                <span>Waiting: {mockNextInLine.join(', ') || 'Queue clear'}</span>
                <span className="text-indigo-600 font-semibold cursor-pointer" onClick={onOpenDemoDashboard}>Open Full Staff UI →</span>
              </div>
            </div>

            {/* Mobile Customer Phone Mockup (5 cols) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-64 bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-800">
                <div className="w-16 h-3 bg-slate-800 rounded-full mx-auto mb-3" />
                
                <div className="bg-white rounded-[2rem] p-4 text-center space-y-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center mx-auto">
                    A
                  </div>
                  <p className="text-[11px] font-bold text-slate-800">ABC Clinic</p>
                  
                  <div className="py-3 px-2 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Your Ticket</span>
                    <div className="text-4xl font-black font-mono-numbers text-indigo-600 mt-0.5">
                      A27
                    </div>
                  </div>

                  <div className="space-y-1 py-1">
                    <p className="text-xs font-extrabold text-slate-900">
                      {mockAhead === 0 ? "🎉 It's Your Turn!" : `${mockAhead} people ahead of you`}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {mockAhead === 0 ? 'Please proceed to Counter 1' : `Estimated wait: ~${mockAhead * 8} mins`}
                    </p>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(20, (4 - mockAhead) * 25))}%` }}
                    />
                  </div>

                  <p className="text-[9px] text-slate-400">Updates automatically • No refresh</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Three Simple Steps</span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            How Queue Turn Works
          </h2>
          <p className="text-sm text-slate-500">
            From QR scan to called number in seconds, with zero app downloads or accounts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs space-y-4 text-center sm:text-left relative">
            <span className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center">
              1
            </span>
            <h3 className="text-xl font-bold text-slate-900">Create Your Queue</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Create your business and generate your unique queue link and QR code in under 60 seconds.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-bold text-indigo-600">Instant Poster Generation →</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs space-y-4 text-center sm:text-left relative">
            <span className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center">
              2
            </span>
            <h3 className="text-xl font-bold text-slate-900">Customers Scan</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Customers scan the QR code with their phone camera and instantly join the queue without downloading an app.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-bold text-indigo-600">Zero App Installation →</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs space-y-4 text-center sm:text-left relative">
            <span className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center">
              3
            </span>
            <h3 className="text-xl font-bold text-slate-900">Call Customers</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Staff clicks "Next Customer" and customers see their position update instantly with chime notifications.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-bold text-indigo-600">Subtle Audio Alerts →</span>
            </div>
          </div>
        </div>

        {/* Visual Flow diagram bar */}
        <div className="mt-12 p-6 bg-white rounded-2xl border border-slate-200 flex flex-wrap items-center justify-around gap-4 text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5"><QrCode className="w-4 h-4 text-indigo-600" /> QR Code Poster</span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-indigo-600" /> Customer Phone (A27)</span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1.5"><LayoutDashboard className="w-4 h-4 text-indigo-600" /> Staff Dashboard</span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1.5"><Tv className="w-4 h-4 text-indigo-600" /> Lobby TV Display</span>
        </div>
      </section>

      {/* USE CASES SECTION */}
      <section id="use-cases" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Versatile For Any Walk-in Business</span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Built for Local Businesses
          </h2>
          <p className="text-sm text-slate-500">
            Explore how different industries modernize waiting lines with Queue Turn.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {useCases.map((uc, i) => {
            const Icon = uc.icon;
            return (
              <div
                key={i}
                onClick={() => onSelectIndustry(uc.slug)}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 hover:border-indigo-500/60 transition shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900 mb-1.5">{uc.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{uc.description}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                  <span>{uc.benefit}</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Simple, Transparent Pricing</span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Plans That Scale With Your Visitors
          </h2>
          <p className="text-sm text-slate-500">
            Start completely free. Upgrade when your queue volume grows.
          </p>
        </div>

        <PaddlePricingTable onSubscribe={onSubscribe} />
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">Looking for the free plan?</p>
          <button onClick={onStartFree} className="mt-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Start Free</button>
        </div>      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center space-x-2.5">
              <img src="/queueturn-icon.svg" alt="QueueTurn" className="h-9 w-9 rounded-xl" />
              <span className="font-black text-lg tracking-tight"><span className="text-slate-900">Queue</span><span className="bg-gradient-to-r from-sky-500 via-violet-600 to-orange-500 bg-clip-text text-transparent">Turn</span></span>
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Simple digital visitor queues for clinics, salons, auto shops, and local businesses. Let customers wait comfortably without standing in line.
            </p>
            <p className="text-[11px] text-slate-400">© 2026 N&N Digitals. All rights reserved.</p>
          </div>

          <div className="col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Contact</h4>
            <p className="text-xs text-slate-500"><a href="mailto:support@queueturn.com" className="hover:text-indigo-600">support@queueturn.com</a></p>
            <p className="text-xs leading-5 text-slate-500">N&N Digitals, Sree Hemadurga Towers, 207, 2nd Floor, A Block, Alwin Cross, Hyderabad 500059, India.</p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Industries</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><button onClick={() => onSelectIndustry('clinic-queue')} className="hover:text-indigo-600">Clinics & Medical</button></li>
              <li><button onClick={() => onSelectIndustry('salon-queue')} className="hover:text-indigo-600">Salons & Barbers</button></li>
              <li><button onClick={() => onSelectIndustry('auto-repair-queue')} className="hover:text-indigo-600">Auto Repair</button></li>
              <li><button onClick={() => onSelectIndustry('restaurant-waitlist')} className="hover:text-indigo-600">Restaurants</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><button onClick={onOpenDemoDashboard} className="hover:text-indigo-600">Staff Dashboard</button></li>
              <li><button onClick={onOpenDemoCustomer} className="hover:text-indigo-600">Customer Mobile View</button></li>
              <li><button onClick={onOpenDemoDisplay} className="hover:text-indigo-600">TV Display Screen</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Company</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><a href="#how-it-works" className="hover:text-indigo-600">How It Works</a></li>
              <li><a href="#pricing" className="hover:text-indigo-600">Pricing Plans</a></li>
              <li><a href="/?page=about" className="hover:text-indigo-600">About Us</a></li>
              <li><a href="/?page=contact" className="hover:text-indigo-600">Contact Us</a></li>
              <li><a href="/?page=faq" className="hover:text-indigo-600">FAQ</a></li>
              <li><a href="/?page=privacy" className="hover:text-indigo-600">Privacy Policy</a></li>
              <li><a href="/?page=terms" className="hover:text-indigo-600">Terms of Service</a></li>
              <li><a href="/?page=refund" className="hover:text-indigo-600">Refund & Cancellation</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};
