import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';
import {
  Plus,
  X,
  ClipboardList,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  FolderSync,
  Trash2,
  ListPlus,
  Send,
  AlertCircle
} from 'lucide-react';

export default function Requisitions() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [isLoading, setIsLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [airports, setAirports] = useState<any[]>([]);

  // Modals state
  const [activeModal, setActiveModal] = useState<'create' | 'detail' | null>(null);
  const [selectedReq, setSelectedReq] = useState<any>(null);

  // Form states
  const [reqForm, setReqForm] = useState({
    requestingDepartment: 'CNS',
    airportId: '',
    items: [] as Array<{ itemId: string; quantityRequested: number }>
  });

  const [approvalForm, setApprovalForm] = useState({
    comments: ''
  });

  const fetchMetadata = async () => {
    try {
      const [itemsRes, airRes] = await Promise.all([
        api.get('/items?limit=100'),
        api.get('/airports')
      ]);
      setItems(itemsRes.data.data);
      setAirports(airRes.data.data);
    } catch (err) {
      console.error('Failed to load requisition metadata');
    }
  };

  const fetchRequisitions = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/requisitions');
      setRequisitions(response.data.data);
    } catch (err) {
      addToast('Failed to load requisitions list.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
    fetchMetadata();
  }, []);

  const handleCreateOpen = () => {
    setReqForm({
      requestingDepartment: 'CNS',
      airportId: user?.airportId || airports[0]?.id || '',
      items: [{ itemId: items[0]?.id || '', quantityRequested: 5 }]
    });
    setActiveModal('create');
  };

  const addLineItem = () => {
    setReqForm(prev => ({
      ...prev,
      items: [...prev.items, { itemId: items[0]?.id || '', quantityRequested: 5 }]
    }));
  };

  const removeLineItem = (index: number) => {
    setReqForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateLineItem = (index: number, key: 'itemId' | 'quantityRequested', value: any) => {
    setReqForm(prev => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        [key]: value
      };
      return { ...prev, items: updated };
    });
  };

  const handleReqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqForm.items.length === 0) {
      addToast('Requisition must contain at least one requested item.', 'warning');
      return;
    }

    try {
      await api.post('/requisitions', {
        requestingDepartment: reqForm.requestingDepartment,
        airportId: reqForm.airportId,
        items: reqForm.items.map(x => ({
          itemId: x.itemId,
          quantityRequested: Number(x.quantityRequested)
        }))
      });

      addToast('Internal requisition submitted successfully.', 'success');
      setActiveModal(null);
      fetchRequisitions();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to submit requisition.', 'error');
    }
  };

  const handleApprovalSubmit = async (status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.patch(`/requisitions/${selectedReq.id}/approve`, {
        status,
        comments: approvalForm.comments
      });

      addToast(`Requisition was ${status.toLowerCase()} successfully.`, 'success');
      setActiveModal(null);
      fetchRequisitions();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update requisition status.', 'error');
    }
  };

  const handleFulfillReq = async (id: string) => {
    try {
      await api.post(`/requisitions/${id}/fulfill`);
      addToast('Requisition items checked out and dispatched.', 'success');
      setActiveModal(null);
      fetchRequisitions();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Fulfillment error.', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-50 border-aai-accent/20 text-aai-accent';
      case 'APPROVED': return 'bg-aai-blue/5 border-aai-blue/20 text-aai-blue';
      case 'REJECTED': return 'bg-red-950/20 border-red-500/20 text-aai-error';
      case 'FULFILLED': return 'bg-green-50 border-aai-success/20 text-aai-success';
      default: return 'bg-aai-surface text-aai-muted';
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-xs">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="gov-page-title">Internal Requisitions</h1>
          <p className="gov-page-subtitle">Request spare parts or gear for local airport operations.</p>
        </div>
        {user?.role === 'SUPER_ADMIN' || user?.role === 'REQUESTER' ? (
          <button
            onClick={handleCreateOpen}
            className="flex items-center gap-2 px-4 py-2.5 gov-btn-primary rounded font-bold  transition-all text-xs"
          >
            <Plus className="h-4 w-4" />
            New Requisition Request
          </button>
        ) : null}
      </div>

      {/* Requisitions List Table */}
      <div className="bg-aai-card border border-aai-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-aai-border bg-aai-surface text-[10px] uppercase font-bold tracking-wide text-aai-muted">
                <th className="px-5 py-4">Requisition No</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Airport</th>
                <th className="px-5 py-4">Requester</th>
                <th className="px-5 py-4">Submission Date</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aai-border text-aai-light">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="opacity-40">
                    <td colSpan={7} className="px-5 py-4 bg-aai-dark/20 h-12" />
                  </tr>
                ))
              ) : requisitions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-aai-muted font-semibold">
                    No requisitions recorded.
                  </td>
                </tr>
              ) : (
                requisitions.map((req) => (
                  <tr key={req.id} className="hover:bg-aai-navy/15 transition-all">
                    <td className="px-5 py-3.5 font-bold font-mono text-[11px] text-aai-blue tracking-wide">{req.reqNumber}</td>
                    <td className="px-5 py-3.5 font-medium text-aai-foreground">{req.requestingDepartment}</td>
                    <td className="px-5 py-3.5 text-aai-muted">{req.airport.name} ({req.airport.code})</td>
                    <td className="px-5 py-3.5 text-aai-muted">{req.requestedByUser.name}</td>
                    <td className="px-5 py-3.5 text-aai-muted">{new Date(req.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full border uppercase ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedReq(req); setApprovalForm({ comments: req.comments || '' }); setActiveModal('detail'); }}
                          className="gov-btn-secondary text-xs px-2.5 py-1.5 font-semibold rounded-lg transition-all"
                        >
                          View Details
                        </button>
                        {req.status === 'APPROVED' && (user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF' || user?.role === 'AIRPORT_MGR') ? (
                          <button
                            onClick={() => handleFulfillReq(req.id)}
                            className="px-2.5 py-1.5 bg-aai-success hover:bg-aai-success/90 text-aai-foreground font-semibold rounded-lg transition-all"
                          >
                            Dispatch
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. CREATE REQUISITION MODAL */}
      {/* ============================================================== */}
      {activeModal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-2xl overflow-hidden shadow-gov text-xs max-h-[90vh] flex flex-col font-sans">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <h3 className="text-sm font-semibold text-aai-foreground flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-aai-blue" /> Submit Internal Requisition Request
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleReqSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Requesting Department</label>
                  <select
                    value={reqForm.requestingDepartment}
                    onChange={(e) => setReqForm({ ...reqForm, requestingDepartment: e.target.value })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  >
                    <option value="CNS">CNS (Comms & Navigation)</option>
                    <option value="Operations">Operations / Airside</option>
                    <option value="Fire Services">Fire & Safety Services</option>
                    <option value="IT">Central IT & Networks</option>
                    <option value="Electrical">Airfield Lighting & Electrical</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Assigned Airport</label>
                  <select
                    disabled={user?.role !== 'SUPER_ADMIN'}
                    value={reqForm.airportId}
                    onChange={(e) => setReqForm({ ...reqForm, airportId: e.target.value })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs disabled:opacity-60"
                  >
                    {airports.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-aai-foreground text-xs">Requested Catalog Items</span>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-1 text-[10px] font-bold text-aai-blue hover:text-aai-blueHover"
                  >
                    <ListPlus className="h-3.5 w-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {reqForm.items.map((line, index) => (
                    <div key={index} className="flex gap-2 items-center bg-aai-surface/60 border border-aai-border p-2.5 rounded">
                      <select
                        value={line.itemId}
                        onChange={(e) => updateLineItem(index, 'itemId', e.target.value)}
                        className="flex-1 gov-input text-xs py-1.5 focus:outline-none"
                      >
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>{i.skuCode} - {i.name}</option>
                        ))}
                      </select>
                      <div className="w-24">
                        <input
                          type="number"
                          min={1}
                          required
                          value={line.quantityRequested}
                          onChange={(e) => updateLineItem(index, 'quantityRequested', Number(e.target.value))}
                          placeholder="Qty"
                          className="w-full gov-input text-xs py-1.5 text-center focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-1.5 text-aai-error hover:text-red-300"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  ))}
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
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. REQUISITION DETAILS MODAL */}
      {/* ============================================================== */}
      {activeModal === 'detail' && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-xl overflow-hidden shadow-gov text-xs font-sans">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <div>
                <span className="text-[10px] text-aai-blue font-extrabold uppercase tracking-wide">{selectedReq.reqNumber}</span>
                <h3 className="text-base font-semibold text-aai-foreground mt-1">Requisition Approval Workspace</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Meta details */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-aai-surface/60 border border-aai-border p-4 rounded">
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Department</span>
                  <p className="font-semibold text-aai-foreground mt-0.5">{selectedReq.requestingDepartment}</p>
                </div>
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Origin Airport</span>
                  <p className="font-semibold text-aai-foreground mt-0.5">{selectedReq.airport.code}</p>
                </div>
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Requester</span>
                  <p className="font-semibold text-aai-foreground mt-0.5">{selectedReq.requestedByUser.name}</p>
                </div>
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Submission Date</span>
                  <p className="font-semibold text-aai-foreground mt-0.5">{new Date(selectedReq.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Status</span>
                  <p className="mt-1">
                    <span className={`px-2.5 py-0.5 text-[9px] font-bold border rounded-full uppercase ${getStatusBadge(selectedReq.status)}`}>
                      {selectedReq.status}
                    </span>
                  </p>
                </div>
                {selectedReq.approvedByUser && (
                  <div>
                    <span className="text-[10px] text-aai-muted uppercase font-semibold">Approved By</span>
                    <p className="font-semibold text-aai-foreground mt-0.5">{selectedReq.approvedByUser.name}</p>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-sm text-aai-foreground mb-2.5">Requested Line Items</h4>
                <div className="border border-aai-border rounded overflow-hidden divide-y divide-aai-border">
                  {selectedReq.items.map((i: any) => (
                    <div key={i.id} className="p-3 bg-aai-dark/10 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-aai-foreground">{i.item.name}</span>
                        <span className="text-[9px] font-mono text-aai-blue block mt-0.5">{i.item.skuCode}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-aai-foreground text-sm block">Qty: {i.quantityRequested}</span>
                        <span className="text-[9px] text-aai-success">Fulfilled: {i.quantityFulfilled}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manager comments block */}
              {(selectedReq.status === 'PENDING' && (user?.role === 'SUPER_ADMIN' || user?.role === 'AIRPORT_MGR')) ? (
                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Approver Comments</label>
                  <textarea
                    rows={2}
                    value={approvalForm.comments}
                    onChange={(e) => setApprovalForm({ comments: e.target.value })}
                    placeholder="Enter approval conditions or rejection notes..."
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2 text-xs gov-input text-xs focus:border-aai-blue/50"
                  />
                </div>
              ) : selectedReq.comments ? (
                <div className="p-3 bg-aai-navy/20 border border-aai-border rounded text-[11px] leading-relaxed">
                  <span className="font-bold text-aai-foreground block mb-1">Management Comment Note:</span>
                  {selectedReq.comments}
                </div>
              ) : null}
            </div>

            {/* Actions footer */}
            <div className="p-4 bg-aai-surface border-t border-aai-border flex justify-end gap-2.5">
              {/* Approval gating */}
              {selectedReq.status === 'PENDING' && (user?.role === 'SUPER_ADMIN' || user?.role === 'AIRPORT_MGR') && (
                <>
                  <button
                    onClick={() => handleApprovalSubmit('REJECTED')}
                    className="px-3.5 py-2 bg-red-900/60 hover:bg-red-800 text-red-100 font-bold rounded-lg transition-all"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprovalSubmit('APPROVED')}
                    className="px-3.5 py-2 bg-aai-success hover:bg-aai-success/90 text-aai-foreground font-semibold rounded-lg transition-all"
                  >
                    Approve Request
                  </button>
                </>
              )}

              {/* Dispatch / Fulfillment gating */}
              {selectedReq.status === 'APPROVED' && (user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF' || user?.role === 'AIRPORT_MGR') && (
                <button
                  onClick={() => handleFulfillReq(selectedReq.id)}
                  className="px-3.5 py-2 bg-aai-success hover:bg-aai-success/90 text-aai-foreground font-semibold rounded-lg transition-all flex items-center gap-1"
                >
                  <Send className="h-3.5 w-3.5" /> Dispatch Materials
                </button>
              )}

              <button onClick={() => setActiveModal(null)} className="px-3.5 py-2 gov-btn-secondary font-bold rounded-lg transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
