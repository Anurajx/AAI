import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';
import {
  Plus,
  X,
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  PackageCheck,
  AlertCircle,
  Trash2,
  ListPlus,
  Layers,
  ChevronDown
} from 'lucide-react';

export default function PurchaseOrders() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Page modes
  const [activeModal, setActiveModal] = useState<'create' | 'detail' | 'receive' | null>(null);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  // Form states
  const [poForm, setPoForm] = useState({
    supplierId: '',
    expectedDeliveryDate: '',
    items: [] as Array<{ itemId: string; quantityOrdered: number; unitCost: number }>
  });

  const [receiveForm, setReceiveForm] = useState({
    warehouseId: '',
    items: [] as Array<{
      itemId: string;
      itemName: string;
      skuCode: string;
      quantityOrdered: number;
      quantityAlreadyRx: number;
      quantityReceived: number;
      maxAllowed: number;
    }>
  });

  const fetchMetadata = async () => {
    try {
      const [supRes, itemsRes, whRes, sugRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/items?limit=100'),
        api.get('/warehouses'),
        api.get('/purchase-orders/suggestions')
      ]);
      setSuppliers(supRes.data.data);
      setItems(itemsRes.data.data);
      setWarehouses(whRes.data.data);
      setSuggestions(sugRes.data.data);
    } catch (err) {
      console.error('Failed to load PO metadata');
    }
  };

  const fetchPOs = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/purchase-orders');
      setPos(response.data.data);
    } catch (err) {
      addToast('Failed to load Purchase Orders list.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPOs();
    fetchMetadata();
  }, []);

  // Handle prefill item from Dashboard
  useEffect(() => {
    if (location.state && (location.state as any).prefillItem && suppliers.length > 0) {
      const prefill = (location.state as any).prefillItem;
      // Trigger create modal and prefill supplier and item
      handleCreateOpen();
      setPoForm(prev => ({
        ...prev,
        supplierId: prefill.supplier.id,
        items: [{ itemId: prefill.itemId || prefill.id, quantityOrdered: prefill.suggestedOrderQty || 20, unitCost: prefill.unitCost }]
      }));
      // Clear state to prevent loop
      window.history.replaceState({}, document.title);
    }
  }, [location.state, suppliers]);

  const handleCreateOpen = () => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7); // Default expected delivery = +7 days
    setPoForm({
      supplierId: suppliers[0]?.id || '',
      expectedDeliveryDate: defaultDate.toISOString().slice(0, 16),
      items: []
    });
    setActiveModal('create');
  };

  const addLineItem = (itemId: string = '', qty: number = 10, cost: number = 0) => {
    const selectedItem = items.find(i => i.id === itemId);
    const unitCost = cost || selectedItem?.unitCost || 0;
    
    setPoForm(prev => ({
      ...prev,
      items: [...prev.items, { itemId: itemId || items[0]?.id || '', quantityOrdered: qty, unitCost }]
    }));
  };

  const removeLineItem = (index: number) => {
    setPoForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateLineItem = (index: number, key: 'itemId' | 'quantityOrdered' | 'unitCost', value: any) => {
    setPoForm(prev => {
      const updated = [...prev.items];
      if (key === 'itemId') {
        const itemInfo = items.find(i => i.id === value);
        updated[index] = {
          itemId: value,
          quantityOrdered: updated[index].quantityOrdered,
          unitCost: itemInfo?.unitCost || 0
        };
      } else {
        updated[index] = {
          ...updated[index],
          [key]: value
        };
      }
      return { ...prev, items: updated };
    });
  };

  const addSuggestedItem = (sug: any) => {
    // Check if supplier matches, if form is empty, set supplier
    if (poForm.items.length === 0) {
      setPoForm(prev => ({ ...prev, supplierId: sug.supplier.id }));
    } else if (poForm.supplierId !== sug.supplier.id) {
      addToast('Warning: Suggestion belongs to a different supplier than selected.', 'warning');
    }

    // Check if item is already added
    if (poForm.items.some(x => x.itemId === sug.itemId)) {
      addToast('Item already in PO draft.', 'info');
      return;
    }

    addLineItem(sug.itemId, sug.suggestedOrderQty, sug.unitCost);
    addToast(`Added low-stock SKU ${sug.skuCode} to draft.`, 'success');
  };

  const handlePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poForm.items.length === 0) {
      addToast('PO must contain at least one line item.', 'warning');
      return;
    }

    try {
      await api.post('/purchase-orders', {
        supplierId: poForm.supplierId,
        expectedDeliveryDate: new Date(poForm.expectedDeliveryDate).toISOString(),
        items: poForm.items
      });

      addToast('Purchase Order created as DRAFT.', 'success');
      setActiveModal(null);
      fetchPOs();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to create PO.', 'error');
    }
  };

  const handleApprovePO = async (id: string) => {
    try {
      await api.patch(`/purchase-orders/${id}/approve`);
      addToast('Procurement PO Approved.', 'success');
      setActiveModal(null);
      fetchPOs();
    } catch (err) {
      addToast('Failed to approve PO.', 'error');
    }
  };

  const handleOrderPO = async (id: string) => {
    try {
      await api.post(`/purchase-orders/${id}/order`);
      addToast('PO marked as TRANSMITTED / ORDERED.', 'success');
      setActiveModal(null);
      fetchPOs();
    } catch (err) {
      addToast('Failed to transmit PO.', 'error');
    }
  };

  const openReceiveModal = (po: any) => {
    setSelectedPO(po);
    const filterWh = warehouses.filter(w => user?.role === 'SUPER_ADMIN' || w.airportId === user?.airportId);
    setReceiveForm({
      warehouseId: filterWh[0]?.id || '',
      items: po.items.map((i: any) => ({
        itemId: i.itemId,
        itemName: i.item.name,
        skuCode: i.item.skuCode,
        quantityOrdered: i.quantityOrdered,
        quantityAlreadyRx: i.quantityReceived,
        quantityReceived: i.quantityOrdered - i.quantityReceived, // Default to remaining quantity
        maxAllowed: i.quantityOrdered - i.quantityReceived
      }))
    });
    setActiveModal('receive');
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveForm.warehouseId) {
      addToast('Select receiving warehouse.', 'warning');
      return;
    }

    try {
      await api.post(`/purchase-orders/${selectedPO.id}/receive`, {
        warehouseId: receiveForm.warehouseId,
        items: receiveForm.items.map(x => ({
          itemId: x.itemId,
          quantityReceived: Number(x.quantityReceived)
        }))
      });

      addToast('Goods receipt processed and stock adjusted.', 'success');
      setActiveModal(null);
      fetchPOs();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to process receipt.', 'error');
    }
  };

  const updateReceiveQty = (index: number, val: number) => {
    setReceiveForm(prev => {
      const items = [...prev.items];
      items[index].quantityReceived = Math.min(items[index].maxAllowed, Math.max(0, val));
      return { ...prev, items };
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-slate-900 border-slate-700 text-slate-300';
      case 'PENDING_APPROVAL': return 'bg-amber-50 border-aai-accent/20 text-aai-accent';
      case 'APPROVED': return 'bg-aai-blue/5 border-aai-blue/20 text-aai-blue';
      case 'ORDERED': return 'bg-aai-surface border-aai-border text-aai-muted';
      case 'PARTIALLY_RECEIVED': return 'bg-amber-50 border-aai-accent/20 text-aai-accent';
      case 'RECEIVED': return 'bg-green-50 border-aai-success/20 text-aai-success';
      default: return 'bg-aai-surface text-aai-muted';
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-xs">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="gov-page-title">Procurement Orders (POs)</h1>
          <p className="gov-page-subtitle">Acquire stock from external registered suppliers.</p>
        </div>
        {user?.role === 'SUPER_ADMIN' || user?.role === 'AIRPORT_MGR' ? (
          <button
            onClick={handleCreateOpen}
            className="flex items-center gap-2 px-4 py-2.5 gov-btn-primary rounded font-bold  transition-all text-xs"
          >
            <Plus className="h-4 w-4" />
            Create Purchase Order
          </button>
        ) : null}
      </div>

      {/* PO List Table */}
      <div className="bg-aai-card border border-aai-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-aai-border bg-aai-surface text-[10px] uppercase font-bold tracking-wide text-aai-muted">
                <th className="px-5 py-4">PO Number</th>
                <th className="px-5 py-4">Supplier</th>
                <th className="px-5 py-4">Requested Delivery</th>
                <th className="px-5 py-4 text-right">Total Cost</th>
                <th className="px-5 py-4 text-center">Creator</th>
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
              ) : pos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-aai-muted font-semibold">
                    No purchase orders recorded.
                  </td>
                </tr>
              ) : (
                pos.map((po) => (
                  <tr key={po.id} className="hover:bg-aai-navy/15 transition-all">
                    <td className="px-5 py-3.5 font-bold font-mono text-[11px] text-aai-blue tracking-wide">{po.poNumber}</td>
                    <td className="px-5 py-3.5 font-medium text-aai-foreground">{po.supplier.name}</td>
                    <td className="px-5 py-3.5 text-aai-muted">{new Date(po.expectedDeliveryDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-aai-foreground">₹{po.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-5 py-3.5 text-center text-aai-muted">{po.createdByUser.name}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full border uppercase ${getStatusBadge(po.status)}`}>
                        {po.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedPO(po); setActiveModal('detail'); }}
                          className="gov-btn-secondary text-xs px-2.5 py-1.5 font-semibold rounded-lg transition-all"
                        >
                          Details
                        </button>
                        {po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED' ? (
                          <button
                            onClick={() => openReceiveModal(po)}
                            className="px-2.5 py-1.5 bg-aai-success hover:bg-aai-success/90 text-aai-foreground font-semibold rounded-lg transition-all"
                          >
                            Receive
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
      {/* 1. CREATE PURCHASE ORDER MODAL */}
      {/* ============================================================== */}
      {activeModal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-4xl overflow-hidden shadow-gov text-xs max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <h3 className="text-sm font-semibold text-aai-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-aai-blue" /> Draft New Purchase Order (PO)
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left Column: Form details */}
              <form onSubmit={handlePOSubmit} className="flex-1 p-6 overflow-y-auto space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Supplier / Vendor</label>
                    <select
                      value={poForm.supplierId}
                      onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                      className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} (Rating: {s.rating}★)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Expected Delivery Date</label>
                    <input
                      type="datetime-local"
                      required
                      value={poForm.expectedDeliveryDate}
                      onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })}
                      className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                    />
                  </div>
                </div>

                {/* Line Items block */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-aai-foreground text-xs">Ordered Line Items</span>
                    <button
                      type="button"
                      onClick={() => addLineItem()}
                      className="flex items-center gap-1 text-[10px] font-bold text-aai-blue hover:text-aai-blueHover"
                    >
                      <ListPlus className="h-3.5 w-3.5" /> Add Row
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {poForm.items.length === 0 ? (
                      <div className="p-6 text-center text-aai-muted border border-dashed border-aai-border rounded">
                        No items added to PO draft yet. Use the Suggestions panel or add rows.
                      </div>
                    ) : (
                      poForm.items.map((formItem, index) => (
                        <div key={index} className="flex gap-2 items-center bg-aai-surface/60 border border-aai-border p-2 rounded">
                          <select
                            value={formItem.itemId}
                            onChange={(e) => updateLineItem(index, 'itemId', e.target.value)}
                            className="flex-1 gov-input text-xs py-1.5 focus:outline-none"
                          >
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>{i.skuCode} - {i.name}</option>
                            ))}
                          </select>
                          <div className="w-20">
                            <input
                              type="number"
                              min={1}
                              required
                              value={formItem.quantityOrdered}
                              onChange={(e) => updateLineItem(index, 'quantityOrdered', Number(e.target.value))}
                              placeholder="Qty"
                              className="w-full gov-input text-xs py-1.5 text-center focus:outline-none"
                            />
                          </div>
                          <div className="w-24">
                            <input
                              type="number"
                              min={1}
                              required
                              value={formItem.unitCost}
                              onChange={(e) => updateLineItem(index, 'unitCost', Number(e.target.value))}
                              placeholder="Cost"
                              className="w-full bg-aai-dark border border-aai-border rounded-lg px-2 py-1.5 text-xs text-aai-foreground text-right focus:outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="p-1.5 text-aai-error hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
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
                    className="px-3.5 py-2 gov-btn-primary rounded-lg transition-all "
                  >
                    Submit Draft PO
                  </button>
                </div>
              </form>

              {/* Right Column: Reorder Suggestions Panel */}
              <div className="w-full lg:w-80 bg-aai-surface/60 border-t lg:border-t-0 lg:border-l border-aai-border p-5 flex flex-col overflow-hidden max-h-[300px] lg:max-h-none">
                <h4 className="font-semibold text-aai-foreground mb-2.5 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-aai-accent" /> Reorder Suggestions
                </h4>
                <p className="text-[10px] text-aai-muted mb-4 leading-relaxed">
                  Items below their safety threshold. Click to add directly to PO.
                </p>
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {suggestions.length === 0 ? (
                    <div className="p-4 text-center text-[10px] text-aai-muted border border-dashed border-aai-border rounded">
                      No stock levels require reordering.
                    </div>
                  ) : (
                    suggestions.map((sug) => (
                      <div
                        key={sug.itemId}
                        onClick={() => addSuggestedItem(sug)}
                        className="p-3 bg-aai-dark hover:bg-aai-navy/50 border border-aai-border hover:border-aai-blue/50 rounded cursor-pointer transition-all flex justify-between items-center gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-aai-foreground block truncate">{sug.name}</span>
                          <span className="text-[9px] font-mono text-aai-blue block mt-0.5">{sug.skuCode}</span>
                          <span className="text-[9px] text-aai-error font-bold block mt-1.5">
                            Stock: {sug.currentStock} / Threshold: {sug.reorderThreshold}
                          </span>
                        </div>
                        <Plus className="h-4 w-4 text-aai-muted flex-shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. PURCHASE ORDER DETAILS MODAL */}
      {/* ============================================================== */}
      {activeModal === 'detail' && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-2xl overflow-hidden shadow-gov text-xs">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <div>
                <span className="text-[10px] text-aai-blue font-extrabold uppercase tracking-wide">{selectedPO.poNumber}</span>
                <h3 className="text-base font-semibold text-aai-foreground mt-1">PO Details & Activity Log</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Meta details */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-aai-surface/60 border border-aai-border p-4 rounded">
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Vendor</span>
                  <p className="font-semibold text-aai-foreground mt-0.5">{selectedPO.supplier.name}</p>
                </div>
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Estimated Delivery</span>
                  <p className="font-semibold text-aai-foreground mt-0.5">{new Date(selectedPO.expectedDeliveryDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Creator</span>
                  <p className="font-semibold text-aai-foreground mt-0.5">{selectedPO.createdByUser.name}</p>
                </div>
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Procurement Cost</span>
                  <p className="font-bold text-aai-success mt-0.5 font-mono text-sm">₹{selectedPO.totalCost.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-aai-muted uppercase font-semibold">Status</span>
                  <p className="mt-1">
                    <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-full uppercase ${getStatusBadge(selectedPO.status)}`}>
                      {selectedPO.status.replace('_', ' ')}
                    </span>
                  </p>
                </div>
                {selectedPO.approvedByUser && (
                  <div>
                    <span className="text-[10px] text-aai-muted uppercase font-semibold">Approved By</span>
                    <p className="font-semibold text-aai-foreground mt-0.5">{selectedPO.approvedByUser.name}</p>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-sm text-aai-foreground mb-2.5">Line Items Requested</h4>
                <div className="border border-aai-border rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-aai-surface border-b border-aai-border text-[9px] uppercase font-bold tracking-wide text-aai-muted">
                        <th className="px-4 py-2.5">SKU</th>
                        <th className="px-4 py-2.5">Item Name</th>
                        <th className="px-4 py-2.5 text-center">Ordered</th>
                        <th className="px-4 py-2.5 text-center">Received</th>
                        <th className="px-4 py-2.5 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aai-border text-aai-light">
                      {selectedPO.items.map((i: any) => (
                        <tr key={i.id} className="bg-aai-dark/10">
                          <td className="px-4 py-2.5 font-mono text-aai-blue font-semibold">{i.item.skuCode}</td>
                          <td className="px-4 py-2.5 font-bold">{i.item.name}</td>
                          <td className="px-4 py-2.5 text-center font-bold">{i.quantityOrdered}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-aai-success">{i.quantityReceived}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">₹{i.unitCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Actions footer */}
            <div className="p-4 bg-aai-surface border-t border-aai-border flex justify-end gap-2.5">
              {/* Approval gating */}
              {user?.role === 'SUPER_ADMIN' && selectedPO.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={() => handleApprovePO(selectedPO.id)}
                  className="px-3.5 py-2 bg-aai-success hover:bg-aai-success/90 text-aai-foreground font-semibold rounded-lg transition-all"
                >
                  Approve PO
                </button>
              )}

              {/* Order transmission gating */}
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'AIRPORT_MGR') && selectedPO.status === 'APPROVED' && (
                <button
                  onClick={() => handleOrderPO(selectedPO.id)}
                  className="px-3.5 py-2 gov-btn-primary rounded-lg transition-all"
                >
                  Mark as Ordered / Transmit
                </button>
              )}

              {/* Receiving goods gating */}
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'AIRPORT_MGR' || user?.role === 'STAFF') &&
                ['ORDERED', 'PARTIALLY_RECEIVED'].includes(selectedPO.status) && (
                  <button
                    onClick={() => openReceiveModal(selectedPO)}
                    className="px-3.5 py-2 bg-aai-success hover:bg-aai-success/90 text-aai-foreground font-semibold rounded-lg transition-all"
                  >
                    Process Goods Receipt
                  </button>
                )}

              <button onClick={() => setActiveModal(null)} className="px-3.5 py-2 gov-btn-secondary font-bold rounded-lg transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. PROCESS GOODS RECEIPT MODAL */}
      {/* ============================================================== */}
      {activeModal === 'receive' && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-xl overflow-hidden shadow-gov text-xs">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <h3 className="text-sm font-semibold text-aai-foreground flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-aai-success" /> Process Goods Receipt: {selectedPO.poNumber}
              </h3>
              <button onClick={() => setActiveModal('detail')} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleReceiveSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Receiving Store / Warehouse</label>
                <select
                  required
                  value={receiveForm.warehouseId}
                  onChange={(e) => setReceiveForm({ ...receiveForm, warehouseId: e.target.value })}
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                >
                  <option value="">Select storage warehouse...</option>
                  {warehouses
                    .filter(w => user?.role === 'SUPER_ADMIN' || w.airportId === user?.airportId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.airport.code})</option>
                    ))}
                </select>
              </div>

              {/* Quantities entry grid */}
              <div className="space-y-3.5">
                <span className="font-semibold text-aai-foreground text-xs block">Shipment Quantity Received</span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {receiveForm.items.map((item, idx) => (
                    <div key={item.itemId} className="p-3 bg-aai-surface/60 border border-aai-border rounded flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-aai-foreground block max-w-[200px] truncate">{item.itemName}</span>
                        <span className="text-[9px] font-mono text-aai-blue block mt-0.5">{item.skuCode}</span>
                        <span className="text-[9px] text-aai-muted block mt-1">
                          Ordered: {item.quantityOrdered} | Remaining: {item.maxAllowed}
                        </span>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min={0}
                          max={item.maxAllowed}
                          required
                          value={item.quantityReceived}
                          onChange={(e) => updateReceiveQty(idx, Number(e.target.value))}
                          className="w-full gov-input text-xs text-center font-semibold"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-aai-border">
                <button
                  type="button"
                  onClick={() => setActiveModal('detail')}
                  className="px-3.5 py-2 gov-btn-secondary font-bold rounded-lg transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-aai-success hover:bg-aai-success/90 text-aai-foreground font-semibold rounded-lg transition-all"
                >
                  Confirm Goods Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
