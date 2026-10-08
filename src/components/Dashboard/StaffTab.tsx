import React, { useState } from 'react';
import { Users, UserPlus, Shield, Mail, Check, Trash2, Key } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { UserProfile } from '../../types/queue';

export const StaffTab: React.FC = () => {
  const { state, currentBusiness } = useQueue();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [invitedSuccess, setInvitedSuccess] = useState(false);

  const businessStaff = state.profiles.filter((p) => p.businessId === currentBusiness?.id);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    // Simulate staff addition
    state.profiles.push({
      id: 'usr_' + Date.now(),
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      businessId: currentBusiness?.id || 'demo-biz-1',
      role: inviteRole,
      createdAt: new Date().toISOString(),
    });

    setInviteName('');
    setInviteEmail('');
    setShowInviteModal(false);
    setInvitedSuccess(true);
    setTimeout(() => setInvitedSuccess(false), 3000);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700">Owner</span>;
      case 'manager':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">Manager</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Staff</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Staff & Permissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Grant receptionists, physicians, stylists, and technicians access to manage queues.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Invite Team Member
        </button>
      </div>

      {invitedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          Invitation sent successfully! Staff member has been added.
        </div>
      )}

      {/* Staff List Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-400 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Access Level</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {businessStaff.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50/60 transition">
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                    {member.name.charAt(0)}
                  </div>
                  <span>{member.name}</span>
                </td>
                <td className="py-3.5 px-4 text-slate-500 font-medium">
                  {member.email}
                </td>
                <td className="py-3.5 px-4">{getRoleBadge(member.role)}</td>
                <td className="py-3.5 px-4 text-slate-500">
                  {member.role === 'owner' ? 'Full Access' : member.role === 'manager' ? 'Queues + Analytics' : 'Queue Calls Only'}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center text-emerald-600 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                    Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-1">
          <span className="text-xs font-bold text-indigo-600 block">Owner</span>
          <p className="text-xs text-slate-500">
            Has complete control over subscription billing, queue creation, team invites, and business profile.
          </p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-1">
          <span className="text-xs font-bold text-amber-600 block">Manager</span>
          <p className="text-xs text-slate-500">
            Can operate all queues, inspect analytics, add counters, and assist walk-in arrivals.
          </p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-1">
          <span className="text-xs font-bold text-slate-700 block">Staff</span>
          <p className="text-xs text-slate-500">
            Can call the next customer, mark completed, and skip tickets from their assigned counter.
          </p>
        </div>
      </div>

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Invite Team Member</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Send an email invite to allow your staff to log into the queue dashboard.
            </p>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="alex@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'manager' | 'staff')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="staff">Staff (Queue Management Only)</option>
                  <option value="manager">Manager (Queues + Analytics + Counters)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
