import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';
import {
  AlertTriangle,
  FileCheck,
  Boxes,
  ArrowRight,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState({
    totalSkus: 0,
    totalValuation: 0,
    lowStockCount: 0,
    pendingPOs: 0,
    pendingRequisitions: 0,
  });

  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [airportData, setAirportData] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const valResponse = await api.get('/reports/valuation');
      const valData = valResponse.data.data;

      const reorderResponse = await api.get('/reports/reorder');
      const reorderData = reorderResponse.data.data;

      const posResponse = await api.get('/purchase-orders');
      const reqsResponse = await api.get('/requisitions');
      const txnsResponse = await api.get('/transactions');

      const pos = posResponse.data.data || [];
      const reqs = reqsResponse.data.data || [];
      const txns = txnsResponse.data.data || [];

      const pendingPOs = pos.filter(
        (po: any) => po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT'
      ).length;
      const pendingReqs = reqs.filter((req: any) => req.status === 'PENDING').length;

      const uniqueItems = new Set(valData.stockLevels.map((sl: any) => sl.skuCode));

      setKpis({
        totalSkus: uniqueItems.size,
        totalValuation: valData.totalValuation,
        lowStockCount: reorderData.length,
        pendingPOs,
        pendingRequisitions: pendingReqs,
      });

      setRecentTransactions(txns.slice(0, 5));
      setLowStockAlerts(reorderData.slice(0, 6));

      setCategoryData(valData.categoryValuation || []);

      const airMap: { [key: string]: number } = {};
      valData.stockLevels.forEach((sl: any) => {
        airMap[sl.airportCode] = (airMap[sl.airportCode] || 0) + sl.totalValue;
      });
      setAirportData(
        Object.keys(airMap)
          .map((key) => ({ code: key, value: airMap[key] }))
          .sort((a, b) => b.value - a.value)
      );
    } catch (err) {
      console.error(err);
      addToast('Failed to load dashboard data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleQuickPO = (item: any) => {
    navigate('/purchase-orders', { state: { prefillItem: item } });
  };

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="h-8 w-56 bg-aai-surface rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 gov-card" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 gov-card" />
          <div className="h-64 gov-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="gov-page-title">Operations Dashboard</h1>
          <p className="gov-page-subtitle">
            Inventory status overview for{' '}
            {user?.airport ? `${user.airport.name} (${user.airport.code})` : 'all airports'}.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchDashboardData}
          className="gov-btn-secondary self-start"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* KPI summary */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Key performance indicators
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="gov-kpi">
            <dt className="gov-kpi-label flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
              Active SKUs
            </dt>
            <dd className="gov-kpi-value">{kpis.totalSkus}</dd>
          </div>
          <div className="gov-kpi">
            <dt className="gov-kpi-label">Total Stock Valuation</dt>
            <dd className="gov-kpi-value">{formatCurrency(kpis.totalValuation)}</dd>
          </div>
          <div className="gov-kpi">
            <dt className="gov-kpi-label flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Low Stock Items
            </dt>
            <dd
              className={`gov-kpi-value ${kpis.lowStockCount > 0 ? 'text-aai-accent' : ''}`}
            >
              {kpis.lowStockCount}
            </dd>
          </div>
          <div className="gov-kpi">
            <dt className="gov-kpi-label flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Pending POs
            </dt>
            <dd className="gov-kpi-value">{kpis.pendingPOs}</dd>
          </div>
          <div className="gov-kpi">
            <dt className="gov-kpi-label flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
              Pending Requisitions
            </dt>
            <dd className="gov-kpi-value">{kpis.pendingRequisitions}</dd>
          </div>
        </dl>
      </section>

      {/* Data tables — no charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="gov-card overflow-hidden" aria-labelledby="category-heading">
          <div className="p-4 border-b border-aai-border bg-aai-surface">
            <h2 id="category-heading" className="font-semibold text-sm text-aai-foreground">
              Stock Value by Category
            </h2>
          </div>
          {categoryData.length === 0 ? (
            <p className="p-6 text-sm text-aai-muted text-center">No category data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="gov-table">
                <caption className="sr-only">Stock valuation broken down by inventory category</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" className="text-right">
                      Value (₹)
                    </th>
                    <th scope="col" className="text-right">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map((cat: any) => {
                    const share =
                      kpis.totalValuation > 0
                        ? ((cat.value / kpis.totalValuation) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr key={cat.name}>
                        <td className="font-medium">{cat.name}</td>
                        <td className="text-right tabular-nums">{formatCurrency(cat.value)}</td>
                        <td className="text-right tabular-nums text-aai-muted">{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="gov-card overflow-hidden" aria-labelledby="airport-heading">
          <div className="p-4 border-b border-aai-border bg-aai-surface">
            <h2 id="airport-heading" className="font-semibold text-sm text-aai-foreground">
              Stock Value by Airport
            </h2>
          </div>
          {airportData.length === 0 ? (
            <p className="p-6 text-sm text-aai-muted text-center">No airport data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="gov-table">
                <caption className="sr-only">Stock valuation broken down by airport code</caption>
                <thead>
                  <tr>
                    <th scope="col">Airport</th>
                    <th scope="col" className="text-right">
                      Value (₹)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {airportData.map((airport) => (
                    <tr key={airport.code}>
                      <td className="font-medium">{airport.code}</td>
                      <td className="text-right tabular-nums">{formatCurrency(airport.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Alerts and activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="gov-card p-4" aria-labelledby="alerts-heading">
          <div className="flex justify-between items-center mb-4">
            <h2 id="alerts-heading" className="font-semibold text-sm text-aai-foreground">
              Low Stock Alerts
            </h2>
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="text-xs text-aai-blue hover:underline font-semibold inline-flex items-center gap-1"
            >
              View inventory
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {lowStockAlerts.length === 0 ? (
            <p className="p-4 text-sm text-aai-muted text-center border border-dashed border-aai-border rounded">
              All inventory items are above reorder thresholds.
            </p>
          ) : (
            <ul className="space-y-2" role="list">
              {lowStockAlerts.map((alert) => (
                <li
                  key={alert.itemId}
                  className="p-3 bg-aai-surface/60 border border-aai-border rounded flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-aai-foreground block truncate">{alert.name}</span>
                    <span className="text-xs text-aai-muted font-mono">{alert.skuCode}</span>
                    <span className="text-xs text-aai-error font-medium block mt-1">
                      Stock: {alert.currentStock} / Threshold: {alert.reorderThreshold}
                    </span>
                  </div>
                  {(user?.role === 'SUPER_ADMIN' || user?.role === 'AIRPORT_MGR') && (
                    <button
                      type="button"
                      onClick={() => handleQuickPO(alert)}
                      className="gov-btn-primary text-xs px-3 py-1.5 flex-shrink-0"
                    >
                      Reorder
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="gov-card p-4" aria-labelledby="activity-heading">
          <div className="flex justify-between items-center mb-4">
            <h2 id="activity-heading" className="font-semibold text-sm text-aai-foreground">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="text-xs text-aai-blue hover:underline font-semibold inline-flex items-center gap-1"
            >
              View ledger
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="p-4 text-sm text-aai-muted text-center border border-dashed border-aai-border rounded">
              No recent stock transactions recorded.
            </p>
          ) : (
            <ul className="space-y-2" role="list">
              {recentTransactions.map((tx) => (
                <li
                  key={tx.id}
                  className="p-3 border border-aai-border rounded flex items-start justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`gov-badge ${
                          tx.transactionType === 'IN'
                            ? 'bg-green-50 text-aai-success border border-aai-success/20'
                            : tx.transactionType === 'OUT'
                              ? 'bg-red-50 text-aai-error border border-aai-error/20'
                              : 'bg-aai-surface text-aai-blue border border-aai-blue/20'
                        }`}
                      >
                        {tx.transactionType}
                      </span>
                      <span className="font-medium text-aai-foreground truncate">{tx.item.name}</span>
                    </div>
                    <p className="text-xs text-aai-muted mt-1">
                      {tx.reason || 'No description recorded.'}
                    </p>
                    <span className="text-xs text-aai-muted block mt-1">
                      {tx.performedByUser.name} — {tx.warehouse.airport.code}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums flex-shrink-0">
                    {tx.transactionType === 'OUT' || tx.transactionType === 'DAMAGED' ? '−' : '+'}
                    {tx.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
