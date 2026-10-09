import React, { useState } from 'react';
import { 
  Building2, 
  Clock, 
  Layers, 
  Plus, 
  Trash2, 
  Check, 
  MapPin, 
  Phone, 
  Mail,
  Palette,
  ShieldCheck
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { BusinessType } from '../../types/queue';

export const SettingsTab: React.FC = () => {
  const { 
    currentBusiness, 
    activeQueue, 
    counters, 
    updateBusinessSettings, 
    updateQueueSettings, 
    addCounter, 
    removeCounter 
  } = useQueue();

  const [bizName, setBizName] = useState(currentBusiness?.name || '');
  const [bizType, setBizType] = useState<BusinessType>(currentBusiness?.businessType || 'clinic');
  const [bizAddress, setBizAddress] = useState(currentBusiness?.address || '');
  const [bizPhone, setBizPhone] = useState(currentBusiness?.phone || '');
  const [brandColor, setBrandColor] = useState(currentBusiness?.brandColor || '#2563eb');

  const [queueName, setQueueName] = useState(activeQueue?.name || '');
  const [queuePrefix, setQueuePrefix] = useState(activeQueue?.prefix || "A");
  const [announcementTemplate, setAnnouncementTemplate] = useState(activeQueue?.announcementTemplate || "Now serving, number {number}, at {counter}.");
  const [avgServiceMinutes, setAvgServiceMinutes] = useState(activeQueue?.averageServiceMinutes || 8);
  const [allowEstimatedWait, setAllowEstimatedWait] = useState(activeQueue?.allowEstimatedWait ?? true);

  const [newCounterName, setNewCounterName] = useState('');
  const [savedMessage, setSavedMessage] = useState(false);

  if (!currentBusiness || !activeQueue) return null;

  const handleSaveBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusinessSettings(currentBusiness.id, {
      name: bizName,
      businessType: bizType,
      address: bizAddress,
      phone: bizPhone,
      brandColor,
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handleSaveQueue = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueueSettings(activeQueue.id, {
      name: queueName,
      prefix: queuePrefix.trim().toUpperCase(),
      announcementTemplate: announcementTemplate.trim(),
      averageServiceMinutes: Number(avgServiceMinutes),
      allowEstimatedWait,
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handleAddCounter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCounterName.trim()) return;
    addCounter(activeQueue.id, newCounterName.trim());
    setNewCounterName('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure business profile, queue timings, and service counters.
          </p>
        </div>

        {savedMessage && (
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            Settings saved successfully!
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Business Settings */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Business Profile</h2>
          </div>

          <form onSubmit={handleSaveBusiness} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Category
              </label>
              <select
                value={bizType}
                onChange={(e) => setBizType(e.target.value as BusinessType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="clinic">Clinic / Medical Practice</option>
                <option value="dental">Dental Office</option>
                <option value="salon">Salon & Spa</option>
                <option value="barbershop">Barbershop</option>
                <option value="auto_repair">Auto Repair & Garage</option>
                <option value="service_center">Customer Service Center</option>
                <option value="government">Government / Public Agency</option>
                <option value="restaurant">Restaurant / Walk-in Bar</option>
                <option value="retail">Retail Counter</option>
                <option value="other">Other Local Business</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Physical Address
              </label>
              <input
                type="text"
                placeholder="123 Main St, City, ST"
                value={bizAddress}
                onChange={(e) => setBizAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                placeholder="(555) 000-0000"
                value={bizPhone}
                onChange={(e) => setBizPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Save Business Profile
              </button>
            </div>
          </form>
        </div>

        {/* Queue Rules & Counters */}
        <div className="space-y-6">
          {/* Active Queue Config */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Queue Configuration ({activeQueue.name})</h2>
            </div>

            <form onSubmit={handleSaveQueue} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Queue Name
                  </label>
                  <input
                    type="text"
                    value={queueName}
                    onChange={(e) => setQueueName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ticket Prefix
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={queuePrefix}
                    onChange={(e) => setQueuePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Spoken Announcement
                </label>
                <textarea
                  value={announcementTemplate}
                  onChange={(e) => setAnnouncementTemplate(e.target.value)}
                  maxLength={180}
                  rows={3}
                  placeholder="Now serving, number {number}, at {counter}."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Use {`{number}`} for the ticket, {`{counter}`} for the counter, and {`{business}`} for your business name.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                <p className="text-[11px] text-slate-400 mt-1">
                  Used for estimating customer wait time: (People ahead × {avgServiceMinutes} min)
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="showWaitToggle"
                  checked={allowEstimatedWait}
                  onChange={(e) => setAllowEstimatedWait(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <label htmlFor="showWaitToggle" className="text-xs font-medium text-slate-700">
                  Display estimated wait times on customer phone tickets
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Save Queue Rules
                </button>
              </div>
            </form>
          </div>

          {/* Multiple Counters Section */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Service Counters</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">{counters.length} Active</span>
            </div>

            <div className="space-y-2">
              {counters.map((counter) => (
                <div
                  key={counter.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{counter.name}</span>
                    <span className="text-[10px] text-slate-500">
                      Status: <strong className="text-emerald-600">{counter.status}</strong>
                    </span>
                  </div>
                  {counters.length > 1 && (
                    <button
                      onClick={() => removeCounter(counter.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Remove Counter"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCounter} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="e.g. Counter 3 (Checkout)"
                value={newCounterName}
                onChange={(e) => setNewCounterName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition shrink-0"
              >
                Add Counter
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
