import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  Check, 
  ArrowRight, 
  Sparkles, 
  QrCode, 
  Lock, 
  Mail, 
  User,
  ShieldCheck
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { BusinessType } from '../../types/queue';
import { QrCodeCanvas } from '../Common/QrCodeCanvas';
import { supabase } from '../../services/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signup',
}) => {
  const { createBusiness, createQueue } = useQueue();
  const [mode, setMode] = useState<'login' | 'signup' | 'onboarding' | 'success'>(initialMode);

  // Signup fields
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Onboarding fields
  const [businessType, setBusinessType] = useState<BusinessType>('clinic');
  const [queueName, setQueueName] = useState('General Service');
  const [prefixFormat, setPrefixFormat] = useState<'A' | 'B' | ''>('A');
  const [startNumber, setStartNumber] = useState(1);
  const [avgServiceMinutes, setAvgServiceMinutes] = useState(10);
  const [allowEstimatedWait, setAllowEstimatedWait] = useState(true);

  // Result info
  const [createdBizId, setCreatedBizId] = useState('');
  const [createdBizSlug, setCreatedBizSlug] = useState('');
  const [createdQueueSlug, setCreatedQueueSlug] = useState('');

  if (!isOpen) return null;

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !ownerName || !email) return;
    setMode('onboarding');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // In local demo mode, log into default account
    onSuccess();
    onClose();
  };

  const handleCompleteOnboarding = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: ownerName, business_name: businessName } } });
        if (error) throw error;
        if (!data.user) throw new Error('Account creation failed.');
        if (!data.session) {
          alert('Account created. Please confirm your email, then sign in to continue.');
          setMode('login');
          return;
        }

        const bizSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'business';
        const { data: biz, error: bizError } = await supabase.from('businesses').insert({
          owner_id: data.user.id, name: businessName
        }).select('id,name').single();
        if (bizError) throw bizError;

        const queueSlugValue = queueName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'general-service';
        const { data: q, error: qError } = await supabase.from('queues').insert({
          business_id: biz.id, name: queueName, slug: queueSlugValue,
          prefix: prefixFormat, next_number: startNumber,
          estimated_minutes_per_person: avgServiceMinutes
        }).select('id,slug').single();
        if (qError) throw qError;

        setCreatedBizId(biz.id);
        setCreatedBizSlug(bizSlug);
        setCreatedQueueSlug(q.slug);
        setMode('success');
      } else {
        const biz = createBusiness({ name: businessName, ownerName, email, businessType });
        const q = createQueue({ businessId: biz.id, name: queueName, prefix: prefixFormat, startNumber, averageServiceMinutes: avgServiceMinutes, allowEstimatedWait });
        setCreatedBizId(biz.id);
        setCreatedBizSlug(biz.slug);
        setCreatedQueueSlug(q.slug);
        setMode('success');
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Unable to create account. Please try again.');
    }
  };

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?view=customer&q=${createdBizSlug}/${createdQueueSlug}`
    : `https://queueturn.com/q/${createdBizSlug}/${createdQueueSlug}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* STEP 1: SIGNUP */}
          {mode === 'signup' && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                  Create Your Free Account
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">Get Started with Queue Turn</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Start serving walk-in customers digitally in under 2 minutes.
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Business / Clinic Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Dental, Studio 88"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Owner / Manager Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Alex Mercer"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition"
                >
                  Continue to Queue Setup →
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Log In
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: LOGIN */}
          {mode === 'login' && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                  Welcome Back
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">Sign In to Dashboard</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Access your active queues, display screen, and analytics.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    defaultValue="sarah@abcclinic.example"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    defaultValue="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition"
                >
                  Sign In to Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition"
                >
                  Continue with Demo Account (ABC Clinic)
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-slate-500">
                Need an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Sign Up Free
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: BUSINESS ONBOARDING */}
          {mode === 'onboarding' && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                  Step 2 of 2
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">Create Your First Queue</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Customize the tickets your customers will receive when scanning your QR code.
                </p>
              </div>

              <form onSubmit={handleCompleteOnboarding} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Business Type
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="clinic">Clinic / Medical</option>
                    <option value="dental">Dental Practice</option>
                    <option value="salon">Salon / Spa</option>
                    <option value="barbershop">Barbershop</option>
                    <option value="auto_repair">Auto Repair</option>
                    <option value="service_center">Service Center</option>
                    <option value="government">Government Office</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="retail">Retail Counter</option>
                    <option value="other">Other Business</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Queue Name
                  </label>
                  <input
                    type="text"
                    required
                    value={queueName}
                    onChange={(e) => setQueueName(e.target.value)}
                    placeholder="e.g. General Service, Check-in"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Number Format
                    </label>
                    <select
                      value={prefixFormat}
                      onChange={(e) => setPrefixFormat(e.target.value as 'A' | 'B' | '')}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="A">A1, A2, A3...</option>
                      <option value="B">B1, B2, B3...</option>
                      <option value="">1, 2, 3... (No letter)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Starting Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={startNumber}
                      onChange={(e) => setStartNumber(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Average Service Time (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={avgServiceMinutes}
                    onChange={(e) => setAvgServiceMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="allowWaitCheck"
                    checked={allowEstimatedWait}
                    onChange={(e) => setAllowEstimatedWait(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                  />
                  <label htmlFor="allowWaitCheck" className="text-xs font-medium text-slate-700">
                    Allow customers to see estimated wait on their phone
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm shadow-md shadow-indigo-200 transition"
                >
                  Create Queue & Launch 🚀
                </button>
              </form>
            </div>
          )}

          {/* STEP 4: ONBOARDING SUCCESS */}
          {mode === 'success' && (
            <div className="text-center space-y-5 py-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900">Queue Ready!</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Your queue has been created with a unique link and QR code.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 inline-block mx-auto">
                <QrCodeCanvas url={publicUrl} size={160} />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                  Scan to Test
                </p>
              </div>

              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition"
              >
                Go to Business Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
