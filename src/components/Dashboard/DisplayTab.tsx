import React, { useState } from 'react';
import { Tv, ExternalLink, Maximize, Volume2, Sparkles, Check, Settings2, Copy, CheckCheck } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { soundService } from '../../services/sound';

interface DisplayTabProps {
  onOpenDisplayView: () => void;
}

export const DisplayTab: React.FC<DisplayTabProps> = ({ onOpenDisplayView }) => {
  const { activeQueue, currentBusiness } = useQueue();
  const [enableSound, setEnableSound] = useState(soundService.isSoundEnabled());
  const [enableVoice, setEnableVoice] = useState(soundService.isVoiceEnabled());
  const [linkCopied, setLinkCopied] = useState(false);

  if (!activeQueue || !currentBusiness) return null;

  const displayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?view=display&q=${activeQueue.slug}`
    : `https://queueturn.com/display/${activeQueue.slug}`;

  const handleSoundToggle = (enabled: boolean) => {
    setEnableSound(enabled);
    soundService.setSoundEnabled(enabled);
    if (enabled) {
      soundService.playChime();
    }
  };

  const handleVoiceToggle = (enabled: boolean) => {
    setEnableVoice(enabled);
    soundService.setVoiceEnabled(enabled);
    if (enabled) {
      soundService.announceTurn('A23', 'Counter 1');
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Public TV Display</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure and launch the full-screen lobby display for smart TVs, tablets, or wall monitors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Display Launcher Card (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="bg-slate-950 text-white rounded-2xl p-6 relative overflow-hidden shadow-lg border border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs">
              <span className="font-bold uppercase tracking-wider text-indigo-400">TV Monitor Mode</span>
              <span className="text-slate-400 font-mono">1920 × 1080</span>
            </div>

            <div className="py-8 text-center space-y-2">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">NOW SERVING</span>
              <div className="text-6xl font-black font-mono-numbers text-white tracking-tight">
                {activeQueue.prefix ? `${activeQueue.prefix}23` : '23'}
              </div>
              <p className="text-xs text-emerald-400 font-semibold pt-1">
                Please proceed to Counter 1
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Up Next: {activeQueue.prefix ? `${activeQueue.prefix}24, ${activeQueue.prefix}25` : '24, 25'}</span>
              <span className="text-emerald-400">● Live Auto-Sync</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">TV Display Link</label>
            <div className="flex gap-2">
              <input readOnly value={displayUrl} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-700" aria-label="TV display URL" />
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(displayUrl); setLinkCopied(true); window.setTimeout(()=>setLinkCopied(false),1800); }
                  catch { window.prompt('Copy this TV display link:', displayUrl); }
                }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                {linkCopied ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {linkCopied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Open this link on the TV browser or send it to the device connected to your TV.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onOpenDisplayView}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Maximize className="w-4 h-4" />
              Launch Display in this Window
            </button>

            <button
              onClick={() => window.open(displayUrl, '_blank')}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
              title="Open on another monitor or browser tab"
            >
              <ExternalLink className="w-4 h-4" />
              Open in New Window / TV Tab
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">How to set up a waiting room display:</p>
            <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-500">
              <li>Open the display link on any Smart TV browser, iPad, Android tablet, or laptop.</li>
              <li>Press the Fullscreen icon in the top right.</li>
              <li>When your front desk clicks "Next Customer", the screen updates instantly.</li>
            </ol>
          </div>
        </div>

        {/* Right: Audio & Settings (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Settings2 className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Display Preferences</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Chime Audio Sound
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Play pleasant airport chime when next customer is called.
                </p>
              </div>
              <input
                type="checkbox"
                checked={enableSound}
                onChange={(e) => handleSoundToggle(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 mt-1"
              />
            </div>

            <div className="flex items-start justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Voice Speech Announcement
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Reads aloud e.g. "Now serving A23 at Counter 1".
                </p>
              </div>
              <input
                type="checkbox"
                checked={enableVoice}
                onChange={(e) => handleVoiceToggle(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 mt-1"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={() => soundService.announceTurn('A23', 'Counter 1')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Test Audio Announcement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
