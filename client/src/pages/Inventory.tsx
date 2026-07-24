import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';
import {
  Search,
  Filter,
  Plus,
  ArrowRightLeft,
  SlidersHorizontal,
  Info,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  AlertTriangle,
  History,
  QrCode,
  Edit2
} from 'lucide-react';

export default function Inventory() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [activeModal, setActiveModal] = useState<'detail' | 'adjust' | 'transfer' | 'add' | 'edit' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Modal forms state
  const [adjustForm, setAdjustForm] = useState({
    warehouseId: '',
    quantity: 1,
    transactionType: 'ADJUSTMENT',
    reason: ''
  });

  const [transferForm, setTransferForm] = useState({
    sourceWarehouseId: '',
    targetWarehouseId: '',
    quantity: 1
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    skuCode: '',
    categoryId: '',
    unitOfMeasure: 'PCS',
    reorderThreshold: 10,
    reorderQuantity: 20,
    unitCost: 100,
    supplierId: '',
    barcodeValue: ''
  });

  const fetchFilters = async () => {
    try {
      const [catsRes, whRes, supRes] = await Promise.all([
        api.get('/categories'),
        api.get('/warehouses'),
        api.get('/suppliers')
      ]);
      setCategories(catsRes.data.data);
      setWarehouses(whRes.data.data);
      setSuppliers(supRes.data.data);
    } catch (err) {
      console.error('Failed to load filter metadata');
    }
  };

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page,
        limit: 10,
        search: search || undefined,
        categoryId: selectedCategory || undefined,
        status: selectedStatus || undefined,
        warehouseId: selectedWarehouse || undefined
      };

      const response = await api.get('/items', { params });
      setItems(response.data.data);
      setTotalPages(response.data.meta.totalPages);
    } catch (err) {
      addToast('Failed to load inventory ledger.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [search, selectedCategory, selectedStatus, selectedWarehouse, page]);

  const openDetailModal = async (item: any) => {
    try {
      const response = await api.get(`/items/${item.id}`);
      setSelectedItem(response.data.data);
      setActiveModal('detail');
    } catch (err) {
      addToast('Failed to load item stock details.', 'error');
    }
  };

  // Adjust Stock Submit
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.warehouseId || !adjustForm.reason) {
      addToast('Please complete all adjustment details.', 'warning');
      return;
    }

    try {
      await api.post('/stock/adjust', {
        itemId: selectedItem.id,
        warehouseId: adjustForm.warehouseId,
        quantity: Number(adjustForm.quantity),
        transactionType: adjustForm.transactionType,
        reason: adjustForm.reason
      });

      addToast('Stock level adjusted successfully.', 'success');
      setActiveModal(null);
      fetchItems();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to adjust stock level.', 'error');
    }
  };

  // Transfer Stock Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.sourceWarehouseId || !transferForm.targetWarehouseId) {
      addToast('Select source and destination stores.', 'warning');
      return;
    }

    try {
      await api.post('/stock/transfer', {
        itemId: selectedItem.id,
        sourceWarehouseId: transferForm.sourceWarehouseId,
        targetWarehouseId: transferForm.targetWarehouseId,
        quantity: Number(transferForm.quantity)
      });

      addToast('Inter-store stock transfer completed.', 'success');
      setActiveModal(null);
      fetchItems();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to complete transfer.', 'error');
    }
  };

  // Add / Edit Item Submit
  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...itemForm,
        reorderThreshold: Number(itemForm.reorderThreshold),
        reorderQuantity: Number(itemForm.reorderQuantity),
        unitCost: Number(itemForm.unitCost)
      };

      if (activeModal === 'add') {
        await api.post('/items', payload);
        addToast('New item catalog created successfully.', 'success');
      } else {
        await api.put(`/items/${selectedItem.id}`, payload);
        addToast('Item catalog updated successfully.', 'success');
      }

      setActiveModal(null);
      fetchItems();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update catalog details.', 'error');
    }
  };

  const openAddModal = () => {
    setItemForm({
      name: '',
      skuCode: '',
      categoryId: categories[0]?.id || '',
      unitOfMeasure: 'PCS',
      reorderThreshold: 10,
      reorderQuantity: 20,
      unitCost: 100,
      supplierId: suppliers[0]?.id || '',
      barcodeValue: Math.floor(1000000000000 + Math.random() * 900000000000).toString()
    });
    setActiveModal('add');
  };

  const openEditModal = (item: any) => {
    setSelectedItem(item);
    setItemForm({
      name: item.name,
      skuCode: item.skuCode,
      categoryId: item.categoryId,
      unitOfMeasure: item.unitOfMeasure,
      reorderThreshold: item.reorderThreshold,
      reorderQuantity: item.reorderQuantity,
      unitCost: item.unitCost,
      supplierId: item.supplierId,
      barcodeValue: item.barcodeValue
    });
    setActiveModal('edit');
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="gov-page-title">Inventory Ledger</h1>
          <p className="gov-page-subtitle">Audit, register, adjust, and transfer stock balances.</p>
        </div>
        {user?.role === 'SUPER_ADMIN' || user?.role === 'AIRPORT_MGR' ? (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 gov-btn-primary rounded text-xs font-bold  transition-all"
          >
            <Plus className="h-4 w-4" />
            Register New SKU
          </button>
        ) : null}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-aai-card border border-aai-border p-4 rounded grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Search Catalog</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-aai-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, SKU or barcode..."
              className="w-full bg-aai-surface border border-aai-border rounded pl-9 pr-4 py-2.5 text-xs gov-input text-xs placeholder-aai-textMuted/60"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Warehouse */}
        <div>
          <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Storage Store</label>
          <select
            value={selectedWarehouse}
            onChange={(e) => { setSelectedWarehouse(e.target.value); setPage(1); }}
            className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
          >
            <option value="">All Stores</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.airport.code})</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5 pl-0.5">Availability Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
          >
            <option value="">All Statuses</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-aai-card border border-aai-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-aai-border bg-aai-surface text-[10px] uppercase font-bold tracking-wide text-aai-muted">
                <th className="px-5 py-4">SKU / Code</th>
                <th className="px-5 py-4">Item Catalog Name</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4 text-right">Unit Value</th>
                <th className="px-5 py-4 text-center">Threshold</th>
                <th className="px-5 py-4 text-center">Available Qty</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aai-border text-xs text-aai-light">
              {isLoading ? (
                [...Array(5)].map((_, idx) => (
                  <tr key={idx} className="opacity-40">
                    <td colSpan={8} className="px-5 py-4 bg-aai-dark/20 h-12" />
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-aai-muted font-semibold">
                    No matching items found in AAI catalog.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-aai-navy/15 transition-all">
                    <td className="px-5 py-3.5 font-mono text-[11px] font-bold text-aai-blue tracking-wide">{item.skuCode}</td>
                    <td className="px-5 py-3.5 font-semibold text-aai-foreground">{item.name}</td>
                    <td className="px-5 py-3.5 text-aai-muted font-semibold">{item.category.name}</td>
                    <td className="px-5 py-3.5 text-right font-semibold">₹{item.unitCost.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-aai-muted">{item.reorderThreshold} {item.unitOfMeasure}</td>
                    <td className="px-5 py-3.5 text-center font-semibold text-aai-foreground">{item.totalQuantity}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        item.stockStatus === 'IN_STOCK' ? 'bg-green-50 text-aai-success border-aai-success/20' :
                        item.stockStatus === 'LOW_STOCK' ? 'bg-amber-950/20 text-aai-accent border-aai-accent/20' :
                        'bg-red-50 text-aai-error border-red-500/20'
                      }`}>
                        {item.stockStatus === 'IN_STOCK' ? 'In Stock' : item.stockStatus === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDetailModal(item)}
                          className="p-1.5 bg-aai-surface hover:bg-aai-blue/10 text-aai-blue border border-aai-border rounded-lg transition-all"
                          title="Detailed Stock Audit"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                        {user?.role === 'SUPER_ADMIN' || user?.role === 'AIRPORT_MGR' ? (
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 bg-aai-surface hover:bg-aai-blue/10 text-aai-foreground border border-aai-border rounded-lg transition-all"
                            title="Edit Catalog Details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
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

        {/* Paginated Footer */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 bg-aai-surface border-t border-aai-border flex justify-between items-center text-xs">
            <span className="text-aai-muted font-semibold">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 gov-btn-secondary disabled:opacity-40 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 gov-btn-secondary disabled:opacity-40 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 1. DETAIL / OPERATION DRAWER MODAL */}
      {/* ============================================================== */}
      {activeModal === 'detail' && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-3xl overflow-hidden shadow-gov text-xs max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <div>
                <span className="text-[10px] text-aai-blue font-extrabold uppercase tracking-wide">{selectedItem.skuCode}</span>
                <h3 className="text-base font-semibold text-aai-foreground mt-1">{selectedItem.name}</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Stats overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-aai-surface/60 border border-aai-border rounded">
                  <span className="text-[9px] text-aai-muted font-bold uppercase tracking-wide block">Global Balance</span>
                  <span className="text-xl font-semibold text-aai-foreground mt-1 block">{selectedItem.totalQuantity} {selectedItem.unitOfMeasure}</span>
                </div>
                <div className="p-4 bg-aai-surface/60 border border-aai-border rounded">
                  <span className="text-[9px] text-aai-muted font-bold uppercase tracking-wide block">Stock Valuation</span>
                  <span className="text-xl font-semibold text-aai-success mt-1 block">₹{(selectedItem.totalQuantity * selectedItem.unitCost).toLocaleString()}</span>
                </div>
                <div className="p-4 bg-aai-surface/60 border border-aai-border rounded">
                  <span className="text-[9px] text-aai-muted font-bold uppercase tracking-wide block">Supplier</span>
                  <span className="font-semibold text-aai-foreground mt-1 block truncate" title={selectedItem.supplier.name}>{selectedItem.supplier.name}</span>
                </div>
                <div className="p-4 bg-aai-surface/60 border border-aai-border rounded flex flex-col justify-center items-center">
                  <QrCode className="h-7 w-7 text-aai-blue" />
                  <span className="text-[9px] text-aai-muted font-bold block mt-1 font-mono">{selectedItem.barcodeValue}</span>
                </div>
              </div>

              {/* Warehouse Breakdown */}
              <div>
                <h4 className="font-bold text-sm text-aai-foreground mb-2.5">Stock Level Breakdown by Store</h4>
                <div className="border border-aai-border rounded overflow-hidden divide-y divide-aai-border">
                  {selectedItem.stockLevels.length === 0 ? (
                    <div className="p-4 text-center text-aai-muted">No store allocations initialized.</div>
                  ) : (
                    selectedItem.stockLevels.map((sl: any) => (
                      <div key={sl.id} className="p-3.5 flex justify-between items-center bg-aai-surface/40">
                        <div>
                          <span className="font-semibold text-aai-foreground">{sl.warehouse.name}</span>
                          <span className="text-[10px] text-aai-muted block mt-0.5">{sl.warehouse.airport.name} ({sl.warehouse.airport.code})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-aai-foreground text-sm block">{sl.quantity} {selectedItem.unitOfMeasure}</span>
                          <span className="text-[10px] text-aai-muted">Reserved: {sl.reservedQuantity} | Avail: {sl.availableQuantity}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Actions / Transactions */}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <h4 className="font-bold text-sm text-aai-foreground flex items-center gap-1.5">
                    <History className="h-4 w-4" /> Recent Movements Ledger
                  </h4>
                </div>
                <div className="border border-aai-border rounded overflow-hidden divide-y divide-aai-border text-[11px]">
                  {selectedItem.transactions.length === 0 ? (
                    <div className="p-4 text-center text-aai-muted">No recent transaction logs.</div>
                  ) : (
                    selectedItem.transactions.map((tx: any) => (
                      <div key={tx.id} className="p-3 bg-aai-dark/10 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded border uppercase ${
                              tx.transactionType === 'IN' ? 'bg-green-50 text-aai-success border-aai-success/20' :
                              tx.transactionType === 'OUT' ? 'bg-red-50 text-aai-error border-red-500/20' :
                              'bg-aai-blue/5 text-aai-blue border-blue-500/20'
                            }`}>
                              {tx.transactionType}
                            </span>
                            <span className="text-aai-foreground font-semibold">{tx.warehouse.name}</span>
                            {tx.targetWarehouse && (
                              <span className="text-aai-muted flex items-center gap-1">
                                <ChevronRight className="h-3 w-3" /> {tx.targetWarehouse.name}
                              </span>
                            )}
                          </div>
                          <p className="text-aai-muted mt-1 leading-relaxed">{tx.reason || 'Manual ledger balance audit adjustment.'}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-aai-foreground block">
                            {tx.transactionType === 'OUT' || tx.transactionType === 'DAMAGED' ? '-' : '+'}{tx.quantity}
                          </span>
                          <span className="text-[9px] text-aai-muted/70 block mt-0.5">{new Date(tx.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Actions footer */}
            <div className="p-4 bg-aai-surface border-t border-aai-border flex justify-end gap-2.5">
              {user?.role !== 'AUDITOR' && user?.role !== 'REQUESTER' && (
                <>
                  <button
                    onClick={() => {
                      setAdjustForm({ warehouseId: selectedItem.stockLevels[0]?.warehouseId || '', quantity: 1, transactionType: 'ADJUSTMENT', reason: '' });
                      setActiveModal('adjust');
                    }}
                    className="gov-btn-primary text-xs px-3.5 py-2 font-bold rounded-lg transition-all"
                  >
                    Adjust Balance
                  </button>
                  <button
                    onClick={() => {
                      setTransferForm({ sourceWarehouseId: selectedItem.stockLevels[0]?.warehouseId || '', targetWarehouseId: '', quantity: 1 });
                      setActiveModal('transfer');
                    }}
                    className="px-3.5 py-2 gov-btn-primary rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer Stock
                  </button>
                </>
              )}
              <button onClick={() => setActiveModal(null)} className="px-3.5 py-2 gov-btn-secondary font-bold rounded-lg transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. ADJUST STOCK LEVEL MODAL */}
      {/* ============================================================== */}
      {activeModal === 'adjust' && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-md overflow-hidden shadow-gov text-xs">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <h3 className="text-sm font-semibold text-aai-foreground">Adjust Stock: {selectedItem.name}</h3>
              <button onClick={() => setActiveModal('detail')} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Select Store / Warehouse</label>
                <select
                  required
                  value={adjustForm.warehouseId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, warehouseId: e.target.value })}
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                >
                  <option value="">Choose warehouse...</option>
                  {selectedItem.stockLevels.map((sl: any) => (
                    <option key={sl.id} value={sl.warehouseId}>{sl.warehouse.name} (Current: {sl.quantity})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Adjustment Type</label>
                  <select
                    value={adjustForm.transactionType}
                    onChange={(e) => setAdjustForm({ ...adjustForm, transactionType: e.target.value })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  >
                    <option value="ADJUSTMENT">General Recount</option>
                    <option value="DAMAGED">Damaged / Scrap</option>
                    <option value="RETURNED">Return Item Inward</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Quantity Changed</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Reason Code / Explanation</label>
                <textarea
                  required
                  rows={3}
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="Describe details e.g., 'Found during Q2 stock audit physical count verification'"
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('detail')}
                  className="px-3.5 py-2 gov-btn-secondary font-bold rounded-lg transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 gov-btn-primary rounded-lg transition-all"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. TRANSFER STOCK LEVEL MODAL */}
      {/* ============================================================== */}
      {activeModal === 'transfer' && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-md overflow-hidden shadow-gov text-xs">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <h3 className="text-sm font-semibold text-aai-foreground">Transfer Stock: {selectedItem.name}</h3>
              <button onClick={() => setActiveModal('detail')} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleTransferSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Source Store</label>
                <select
                  required
                  value={transferForm.sourceWarehouseId}
                  onChange={(e) => setTransferForm({ ...transferForm, sourceWarehouseId: e.target.value })}
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                >
                  <option value="">Select source warehouse...</option>
                  {selectedItem.stockLevels.map((sl: any) => (
                    <option key={sl.id} value={sl.warehouseId}>{sl.warehouse.name} (Avail: {sl.availableQuantity})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Destination Store</label>
                <select
                  required
                  value={transferForm.targetWarehouseId}
                  onChange={(e) => setTransferForm({ ...transferForm, targetWarehouseId: e.target.value })}
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                >
                  <option value="">Select target warehouse...</option>
                  {warehouses
                    .filter(w => w.id !== transferForm.sourceWarehouseId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.airport.code})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Quantity to Transfer</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                  className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('detail')}
                  className="px-3.5 py-2 gov-btn-secondary font-bold rounded-lg transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 gov-btn-primary rounded-lg transition-all"
                >
                  Dispatch Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. REGISTER / EDIT ITEM CATALOG MODAL */}
      {/* ============================================================== */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ">
          <div className="bg-aai-card border border-aai-border rounded w-full max-w-xl overflow-hidden shadow-gov text-xs max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-aai-border flex justify-between items-center bg-aai-surface">
              <h3 className="text-sm font-semibold text-aai-foreground">
                {activeModal === 'add' ? 'Register New SKU Catalog Item' : 'Modify Item Catalog Specifications'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-aai-muted hover:text-aai-foreground rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleItemSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Item Name</label>
                  <input
                    type="text"
                    required
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="e.g., Runway Edge Light LED 24V"
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">SKU Code</label>
                  <input
                    type="text"
                    required
                    disabled={activeModal === 'edit'}
                    value={itemForm.skuCode}
                    onChange={(e) => setItemForm({ ...itemForm, skuCode: e.target.value.toUpperCase() })}
                    placeholder="e.g., AAI-SP-RWY-001"
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Barcode / QR Value</label>
                  <input
                    type="text"
                    required
                    disabled={activeModal === 'edit'}
                    value={itemForm.barcodeValue}
                    onChange={(e) => setItemForm({ ...itemForm, barcodeValue: e.target.value })}
                    placeholder="e.g., 8901234000010"
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Inventory Category</label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Unit of Measure</label>
                  <select
                    value={itemForm.unitOfMeasure}
                    onChange={(e) => setItemForm({ ...itemForm, unitOfMeasure: e.target.value })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  >
                    <option value="PCS">Pieces (PCS)</option>
                    <option value="SETS">Sets (SETS)</option>
                    <option value="METERS">Meters (METERS)</option>
                    <option value="CANS">Cans (CANS)</option>
                    <option value="BARRELS">Barrels (BARRELS)</option>
                    <option value="PACKS">Packs (PACKS)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Unit Cost (INR)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemForm.unitCost}
                    onChange={(e) => setItemForm({ ...itemForm, unitCost: Number(e.target.value) })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Primary Supplier Vendor</label>
                  <select
                    value={itemForm.supplierId}
                    onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Reorder Warning Point</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={itemForm.reorderThreshold}
                    onChange={(e) => setItemForm({ ...itemForm, reorderThreshold: Number(e.target.value) })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-aai-muted uppercase tracking-wide block mb-1.5">Standard Order Quantity</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemForm.reorderQuantity}
                    onChange={(e) => setItemForm({ ...itemForm, reorderQuantity: Number(e.target.value) })}
                    className="w-full bg-aai-surface border border-aai-border rounded px-3 py-2.5 text-xs gov-input text-xs"
                  />
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
                  {activeModal === 'add' ? 'Add to Catalog' : 'Save Specifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
