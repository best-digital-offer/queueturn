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

// QueueTurn requires a business-domain email. This blocks consumer mailboxes and
// common disposable providers in the UI; the database trigger enforces the same
// rule for direct API calls.
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.in','ymail.com','rocketmail.com',
  'outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','mac.com',
  'aol.com','proton.me','protonmail.com','pm.me','gmx.com','gmx.net','mail.com',
  'yandex.com','yandex.ru','zoho.com','zohomail.com','fastmail.com','tutanota.com',
  'tuta.com','hey.com','rediffmail.com','inbox.com','qq.com','163.com','126.com',
  'yeah.net','hushmail.com','mail.ru','bk.ru','list.ru','rambler.ru'
]);
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamail.net','sharklasers.com',
  'grr.la','yopmail.com','yopmail.fr','temp-mail.org','temp-mail.io',
  '10minutemail.com','10minutemail.net','throwawaymail.com','dispostable.com',
  'getnada.com','emailondeck.com','tempmail.com','tempail.com','fakeinbox.com',
  'maildrop.cc','mintemail.com','mohmal.com','burnermail.io','inboxkitten.com',
  'trashmail.com','trashmail.net','discard.email','spamgourmet.com','mailnesia.com',
  'tempr.email','tmpmail.org','tmpmail.net','emailfake.com','crazymailing.com',
  'harakirimail.com','mytemp.email','tempinbox.com','tmail.com','dropmail.me'
]);
function workEmailError(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1] || !parts[1].includes('.')) return 'Enter a valid work email address.';
  const domain = parts[1].replace(/\.$/, '');
  if (PERSONAL_EMAIL_DOMAINS.has(domain)) return 'Please use your company or business email. Personal email providers such as Gmail are not allowed.';
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return 'Temporary/disposable email addresses are not allowed. Please use your work email.';
  return null;
}

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
  const [authMessage, setAuthMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
    setAuthMessage('');
    const emailError = workEmailError(email);
    if (emailError) { setAuthMessage(emailError); return; }
    if (!businessName.trim() || !ownerName.trim() || !email.trim()) return;
    setMode('onboarding');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage('');
    const form = e.currentTarget as HTMLFormElement;
    const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement | null;
    const passwordInput = form.querySelector('input[type="password"]') as HTMLInputElement | null;
    if (!emailInput || !passwordInput) return;
    const emailError = workEmailError(emailInput.value);
    if (emailError) { setAuthMessage(emailError); return; }
    if (!supabase) { setAuthMessage('Authentication service is unavailable. Please try again later.'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailInput.value.trim(), password: passwordInput.value });
      if (error) {
        const message = error.message.toLowerCase();
        setAuthMessage(message.includes('email not confirmed') || message.includes('not confirmed')
          ? 'Your email is not verified yet. Check your inbox for the confirmation link, or use Resend confirmation email below.'
          : 'Sign-in failed. Check your work email and password. If you just signed up, confirm your email first.');
        return;
      }
      if (data.user) {
        const { data: existingBusinesses, error: lookupError } = await supabase
          .from('businesses').select('id,name').eq('owner_id', data.user.id).limit(1);
        if (lookupError) { alert(lookupError.message); return; }
        const pendingRaw = localStorage.getItem('queueturn_pending_onboarding');
        if ((!existingBusinesses || existingBusinesses.length === 0) && pendingRaw) {
          try {
            const draft = JSON.parse(pendingRaw) as {
              businessName:string; ownerName:string; businessType:BusinessType; queueName:string;
              prefixFormat:'A'|'B'|''; startNumber:number; avgServiceMinutes:number; allowEstimatedWait:boolean;
            };
            const { data: biz, error: bizError } = await supabase.from('businesses')
              .insert({ owner_id:data.user.id, name:draft.businessName }).select('id,name').single();
            if (bizError) throw bizError;
            const businessSlugValue = draft.businessName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'business';
            const queueNameSlug = draft.queueName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'general-service';
            const queueSlugValue = `${businessSlugValue}-${queueNameSlug}`;
            const { data: q, error: qError } = await supabase.from('queues').insert({
              business_id:biz.id, name:draft.queueName, slug:queueSlugValue, prefix:draft.prefixFormat,
              next_number:draft.startNumber, estimated_minutes_per_person:draft.avgServiceMinutes
            }).select('id,slug').single();
            if (qError) throw qError;
            setBusinessName(draft.businessName);
            setOwnerName(draft.ownerName);
            setBusinessType(draft.businessType);
            setQueueName(draft.queueName);
            setPrefixFormat(draft.prefixFormat);
            setStartNumber(draft.startNumber);
            setAvgServiceMinutes(draft.avgServiceMinutes);
            setAllowEstimatedWait(draft.allowEstimatedWait);
            setCreatedBizId(biz.id);
            setCreatedBizSlug(draft.businessName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'business');
            setCreatedQueueSlug(q.slug);
            localStorage.removeItem('queueturn_pending_onboarding');
            setMode('success');
            return;
          } catch (setupError) {
            console.error(setupError);
            alert(setupError instanceof Error ? setupError.message : 'Signed in, but business setup could not finish. Please retry.');
            return;
          }
        }
        localStorage.removeItem('queueturn_pending_onboarding');
      }
      onSuccess();
      onClose();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResendConfirmation = async () => {
    const form = document.querySelector('form') as HTMLFormElement | null;
    const emailInput = form?.querySelector('input[type="email"]') as HTMLInputElement | null;
    const address = emailInput?.value.trim() || email.trim();
    if (!address) { setAuthMessage('Enter your work email first.'); return; }
    const emailError = workEmailError(address);
    if (emailError) { setAuthMessage(emailError); return; }
    if (!supabase) { setAuthMessage('Authentication service is unavailable.'); return; }
    setBusy(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: 'https://queueturn.com/' } });
      if (error) throw error;
      setAuthMessage('If this account needs confirmation, a new verification email has been requested. Check your inbox and spam folder.');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Could not resend the confirmation email. Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { name: ownerName, business_name: businessName }, emailRedirectTo: 'https://queueturn.com/' } });
        if (error) throw error;
        if (!data.user) throw new Error('Account creation failed.');
        if (!data.session) {
          localStorage.setItem('queueturn_pending_onboarding', JSON.stringify({
            businessName, ownerName, businessType, queueName, prefixFormat, startNumber,
            avgServiceMinutes, allowEstimatedWait
          }));
          setAuthMessage('Account created. Verification is required before sign-in. Check your inbox and spam folder for the QueueTurn confirmation email. After confirming, sign in with the same work email and password.');
          setMode('login');
          return;
        }

        const bizSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'business';
        const { data: biz, error: bizError } = await supabase.from('businesses').insert({
          owner_id: data.user.id, name: businessName
        }).select('id,name').single();
        if (bizError) throw bizError;

        const queueNameSlug = queueName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'general-service';
        const queueSlugValue = `${bizSlug}-${queueNameSlug}`;
        const { data: q, error: qError } = await supabase.from('queues').insert({
          business_id: biz.id, name: queueName, slug: queueSlugValue,
          prefix: prefixFormat, next_number: startNumber,
          estimated_minutes_per_person: avgServiceMinutes
        }).select('id,slug').single();
        if (qError) throw qError;

        setCreatedBizId(biz.id);
        setCreatedBizSlug(bizSlug);
        setCreatedQueueSlug(q.slug);
        localStorage.removeItem('queueturn_pending_onboarding');
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
      setAuthMessage(error instanceof Error ? error.message : 'Unable to create account. Please try again.');
    }
  };

  // Always print customer QR codes with the canonical custom domain, even if staff opened a Vercel preview URL.
  const publicUrl = `https://queueturn.com/?view=customer&q=${createdBizSlug}/${createdQueueSlug}`;

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
                  Start serving walk-in customers digitally in under 2 minutes. Use a company email; personal and disposable addresses are not accepted.
                </p>
                {authMessage && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{authMessage}</div>}
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
                {authMessage && <div role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{authMessage}</div>}
              </div>

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
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
                    
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition"
                >
                  {busy ? 'Please wait…' : 'Sign In to Dashboard'}
                </button>
                <button type="button" disabled={busy} onClick={handleResendConfirmation} className="w-full py-2 text-indigo-700 hover:underline disabled:opacity-60 text-xs font-semibold">
                  Resend confirmation email
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
                {authMessage && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{authMessage}</div>}
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
