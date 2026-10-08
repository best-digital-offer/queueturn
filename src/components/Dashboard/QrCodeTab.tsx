import React, { useState } from 'react';
import { 
  QrCode, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  ExternalLink, 
  Smartphone, 
  Tv, 
  Share2,
  Sparkles
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { QrCodeCanvas } from '../Common/QrCodeCanvas';

interface QrCodeTabProps {
  onOpenCustomerView: () => void;
  onOpenDisplayView: () => void;
}

export const QrCodeTab: React.FC<QrCodeTabProps> = ({ 
  onOpenCustomerView, 
  onOpenDisplayView 
}) => {
  const { currentBusiness, activeQueue } = useQueue();
  const [copied, setCopied] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>('');

  if (!currentBusiness || !activeQueue) return null;

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?view=customer&q=${currentBusiness.slug}/${activeQueue.slug}`
    : `https://queueturn.com/q/${currentBusiness.slug}/${activeQueue.slug}`;

  const displayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?view=display&q=${activeQueue.slug}`
    : `https://queueturn.com/display/${activeQueue.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `queueturn_${currentBusiness.slug}_qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">QR Code & Queue Links</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Print this QR code to place at your front desk, waiting area, or entrance window.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: QR Code Card & Actions (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col items-center shadow-xs">
              <QrCodeCanvas 
                url={publicUrl} 
                size={220} 
                onGenerated={(url) => setDataUrl(url)} 
              />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                Scan with Phone Camera
              </span>
            </div>

            <div className="space-y-3 text-center sm:text-left flex-1">
              <div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Direct Customer Join
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  {currentBusiness.name}
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {activeQueue.name} Queue
                </p>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                When visitors scan this with their smartphone camera, they instantly get a queue number without downloading an app or signing in.
              </p>

              <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  onClick={handleDownloadPng}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </button>

                <button
                  onClick={handlePrint}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Sign
                </button>
              </div>
            </div>
          </div>

          {/* Shareable Link Box */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Shareable Queue URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 select-all"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Quick Open Buttons */}
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={onOpenCustomerView}
              className="flex-1 py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              Open Customer Phone View
            </button>
            <button
              onClick={onOpenDisplayView}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              <Tv className="w-4 h-4" />
              Open TV Display Screen
            </button>
          </div>
        </div>

        {/* Right: Printable Poster Preview (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
            Printable Poster Preview (8.5 × 11")
          </span>

          {/* Printable Container */}
          <div 
            id="printable-qr" 
            className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-4 bg-slate-50/50"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl mx-auto">
              {currentBusiness.name.charAt(0)}
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {currentBusiness.name}
              </h2>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mt-0.5">
                Digital Waiting Line
              </p>
            </div>

            <div className="py-2 flex justify-center">
              <QrCodeCanvas url={publicUrl} size={180} />
            </div>

            <div className="space-y-1">
              <p className="text-base font-extrabold text-slate-900">
                Scan with your phone to join
              </p>
              <p className="text-xs text-slate-500">
                1. Open Camera • 2. Scan QR • 3. Wait comfortably anywhere
              </p>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-200 font-medium">
              Powered by Queue Turn (queueturn.com) • No app download required
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
