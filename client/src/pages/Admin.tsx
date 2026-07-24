import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';
import {
  Users,
  UserPlus,
  Edit,
  History,
  X,
  UserCheck,
  Shield,
  MapPin,
  Mail,
  Lock,
  ArrowRight
} from 'lucide-react';

export default function Admin() {
  const { user: currentUser } = useAuthStore();
  const { addToast } = useToastStore();

  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [airports, setAirports] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Tab control
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

  // Modals state
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'inspect' | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Form states
  const [userForm, setUserForm] = useState({
    employeeId: '',
    name: '',
    email: '',
    password: '',
    role: 'REQUESTER',
    airportId: ''
  });

  const fetchMetadata = async () => {
    try {
      const response = await api.get('/airports');
      setAirports(response.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.data);
    } catch (err) {
      addToast('Failed to load user list.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/audit-log');
      setAuditLogs(response.data.data);
    } catch (err) {
      addToast('Failed to load audit logs.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const openCreateModal = () => {
    setUserForm({
      employeeId: `EMP${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      email: '',
      password: '',
      role: 'REQUESTER',
      airportId: airports[0]?.id || ''
    });
    setActiveModal('create');
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setUserForm({
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      password: '', // Leave blank to not change password
      role: user.role,
      airportId: user.airportId || ''
    });
    setActiveModal('edit');
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...userForm,
        airportId: ['SUPER_ADMIN', 'AUDITOR'].includes(userForm.role) ? null : userForm.airportId
      };

      if (activeModal === 'create') {
        await api.post('/admin/users', payload);
        addToast('New user account provisioned.', 'success');
      } else {
        await api.put(`/admin/users/${selectedUser.id}`, payload);
        addToast('User settings updated successfully.', 'success');
      }

      setActiveModal(null);
      fetchUsers();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to submit user form.', 'error');
    }
  };

  const inspectAuditDetails = (log: any) => {
    setSelectedLog(log);
    setActiveModal('inspect');
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-xs">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="gov-page-title">Administration Hub</h1>
          <p className="gov-page-subtitle">Manage user provisioning and review action audit logs.</p>
        </div>
        {activeTab === 'users' && currentUser?.role === 'SUPER_ADMIN' && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 gov-btn-primary rounded font-bold  transition-all text-xs"
          >
            <UserPlus className="h-4 w-4" />
            Provision New User
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-aai-border gap-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3 font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'users' ? 'border-aai-blue text-aai-blue' : 'border-transparent text-aai-muted hover:text-aai-foreground'
          }`}
        >
          <Users className="h-4 w-4" /> User Management
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-3 font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'audit' ? 'border-aai-blue text-aai-blue' : 'border-transparent text-aai-muted hover:text-aai-foreground'
          }`}
        >
          <History className="h-4 w-4" /> Security Audit Log
        </button>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className="bg-aai-card border border-aai-border rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-aai-border bg-aai-surface text-[10px] uppercase font-bold tracking-wide text-aai-muted">
                  <th className="px-5 py-4">Employee ID</th>
                  <th className="px-5 py-4">Full Name</th>
                  <th className="px-5 py-4">Work Email</th>
                  <th className="px-5 py-4">Role Permission</th>
                  <th className="px-5 py-4">Scope Assignment</th>
                  {currentUser?.role === 'SUPER_ADMIN' && <th className="px-5 py-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-aai-border text-aai-light">
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="opacity-40">
                      <td colSpan={6} className="px-5 py-4 bg-aai-dark/20 h-12" />
                    </tr>
                  ))
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-aai-navy/10 transition-all">
                      <td className="px-5 py-3.5 font-bold font-mono text-[11px] text-aai-blue">{u.employeeId}</td>
                      <td className="px-5 py-3.5 font-semibold text-aai-foreground">{u.name}</td>
                      <td className="px-5 py-3.5 text-aai-muted">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-aai-blue/15 text-aai-blue border border-aai-blue/20">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-aai-muted">
                        {u.airport ? `${u.airport.name} (${u.airport.code})` : 'Global Headquarters'}
                      </td>
                      {currentUser?.role === 'SUPER_ADMIN' && (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 bg-aai-surface hover:bg-aai-blue/10 text-aai-foreground border border-aai-border rounded-lg transition-all"
                            title="Edit User Profile"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="bg-aai-card border border-aai-border rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-aai-border bg-aai-surface text-[10px] uppercase font-bold tracking-wide text-aai-muted">
                  <th className="px-5 py-4">Timestamp</th>
                  <th className="px-5 py-4">Operator</th>
                  <th className="px-5 py-4">Action Event</th>
                  <th className="px-5 py-4">Entity Targeted</th>
                  <th className="px-5 py-4">Entity ID</th>
                  <th className="px-5 py-4 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aai-border text-aai-light">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="opacity-40">
                      <td colSpan={6} className="px-5 py-4 bg-aai-dark/20 h-12" />
                    </tr>
                  ))
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-aai-muted font-semibold">
                      No system logs recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-aai-navy/10 transition-all">
                      <td className="px-5 py-3 text-aai-muted font-mono text-[10px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-semibold text-aai-foreground">
                        {log.user.name} ({log.user.employeeId})
                      </td>
                      <td className="px-5 py-3 font-semibold text-aai-success">{log.action}</td>
                      <td className="px-5 py-3 text-aai-muted">{log.entityName}</td>
                      <td className="px-5 py-3 font-mono text-[10px] text-aai-muted truncate max-w-[120px]">{log.entityId}</td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => inspectAuditDetails(log)}
                          className="gov-btn-primary text-xs px-2 py-1 rounded font-bold transition-all text-[10px]"
                        >
                          Diff
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. ADD / EDIT USER ACCOUNT PROVISIONING MODAL */}
      {/* ============================================================== */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-md overflow-hidden shadow-gov text-xs font-sans">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <h3 className="text-sm font-semibold text-aai-foreground flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-aai-blue" />
                {activeModal === 'create' ? 'Provision User Account' : 'Edit User Settings'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Employee ID</label>
                <input
                  type="text"
                  required
                  value={userForm.employeeId}
                  onChange={(e) => setUserForm({ ...userForm, employeeId: e.target.value })}
                  placeholder="e.g. EMP005"
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="e.g. Amit Sharma"
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Work Email Address</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="e.g. amit@aerostock.aai.aero"
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">
                  {activeModal === 'create' ? 'Security Password' : 'Reset Password (optional)'}
                </label>
                <input
                  type="password"
                  required={activeModal === 'create'}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Role Permission</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  >
                    <option value="REQUESTER">Requester (Department staff)</option>
                    <option value="STAFF">Warehouse Staff</option>
                    <option value="AIRPORT_MGR">Airport Manager</option>
                    <option value="AUDITOR">Auditor (Read Only Global)</option>
                    <option value="SUPER_ADMIN">Super Admin (Central)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Airport Scope</label>
                  <select
                    disabled={['SUPER_ADMIN', 'AUDITOR'].includes(userForm.role)}
                    value={userForm.airportId}
                    onChange={(e) => setUserForm({ ...userForm, airportId: e.target.value })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs disabled:opacity-50"
                  >
                    {airports.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.city}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-aai-border">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-2 gov-btn-secondary font-bold rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 gov-btn-primary rounded-lg transition-all"
                >
                  Confirm Provisioning
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. INSPECT AUDIT DIFF STATE DETAILS MODAL */}
      {/* ============================================================== */}
      {activeModal === 'inspect' && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-xl overflow-hidden shadow-gov text-xs font-sans">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <h3 className="text-sm font-semibold text-aai-foreground">Inspect Audit Log: {selectedLog.action}</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-aai-muted block font-bold">Operator:</span>
                  <span className="text-aai-foreground font-semibold">{selectedLog.user.name} ({selectedLog.user.employeeId})</span>
                </div>
                <div>
                  <span className="text-aai-muted block font-bold">Timestamp:</span>
                  <span className="text-aai-foreground font-mono">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <span className="text-xs font-bold text-aai-error block mb-2">Before State Log</span>
                  <pre className="p-3 bg-red-950/20 border border-red-500/15 rounded font-mono text-[9px] overflow-x-auto text-red-200">
                    {selectedLog.beforeState
                      ? JSON.stringify(JSON.parse(selectedLog.beforeState), null, 2)
                      : 'None (CREATE Event)'}
                  </pre>
                </div>
                <div>
                  <span className="text-xs font-bold text-aai-success block mb-2">After State Log</span>
                  <pre className="p-3 bg-green-50 border border-aai-success/20 rounded font-mono text-xs overflow-x-auto text-aai-foreground">
                    {selectedLog.afterState
                      ? JSON.stringify(JSON.parse(selectedLog.afterState), null, 2)
                      : 'None (DELETE Event)'}
                  </pre>
                </div>
              </div>
            </div>
            <div className="p-4 bg-aai-surface border-t border-aai-border flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 gov-btn-secondary font-bold rounded-lg transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
