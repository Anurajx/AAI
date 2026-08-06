import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import { api } from "../lib/api";
import {
  FileText,
  Sheet,
  Download,
  Boxes,
  TrendingUp,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
  TrendingDown,
} from "lucide-react";

export default function Reports() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [isLoading, setIsLoading] = useState(true);
  const [valuationData, setValuationData] = useState<any>(null);
  const [velocityData, setVelocityData] = useState<any>(null);
  const [reorderData, setReorderData] = useState<any[]>([]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const [valRes, velRes, reoRes] = await Promise.all([
        api.get("/reports/valuation"),
        api.get("/reports/velocity"),
        api.get("/reports/reorder"),
      ]);

      setValuationData(valRes.data.data);
      setVelocityData(velRes.data.data);
      setReorderData(reoRes.data.data);
    } catch (err) {
      addToast("Failed to load reports dashboards.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const downloadExport = async (
    url: string,
    fileName: string,
    mimeType: string,
  ) => {
    try {
      addToast("Generating export... please wait.", "info");
      const response = await api.get(url, { responseType: "blob" });
      const blob = new Blob([response.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      addToast("Failed to generate export. Please try again.", "error");
    }
  };

  const handleExportPDF = () => {
    downloadExport(
      "/reports/export/pdf",
      "AeroStock_Valuation_Report.pdf",
      "application/pdf",
    );
  };

  const handleExportExcel = () => {
    downloadExport(
      "/reports/export/excel",
      "AeroStock_Valuation_Report.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 text-xs">
        <div className="h-10 w-48 bg-aai-card rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-aai-card rounded border border-aai-border" />
          <div className="h-48 bg-aai-card rounded border border-aai-border" />
        </div>
        <div className="h-64 bg-aai-card rounded border border-aai-border" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-xs">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="gov-page-title">Audit & Analytical Reports</h1>
          <p className="gov-page-subtitle">
            Export valuation sheets and audit system velocity metrics.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 border border-red-500/25 hover:border-red-500 hover:bg-red-900/10 text-red-200 rounded font-bold transition-all text-xs"
          >
            <Download className="h-4 w-4" /> Export Audit PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-aai-success/30 hover:border-aai-success text-aai-success rounded font-bold transition-all text-xs"
          >
            <Download className="h-4 w-4" /> Export Excel Sheet
          </button>
        </div>
      </div>

      {/* Breakdown grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <div className="bg-aai-card border border-aai-border p-5 rounded">
          <h3 className="font-bold text-sm text-aai-foreground mb-3 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-aai-blue" /> Valuation by
            Category
          </h3>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {valuationData?.categoryValuation.map((c: any, i: number) => (
              <div
                key={i}
                className="p-3 bg-aai-surface/60 border border-aai-border rounded flex justify-between items-center text-xs"
              >
                <div>
                  <span className="font-bold text-aai-foreground block">
                    {c.name}
                  </span>
                  <span className="text-[10px] text-aai-muted mt-0.5 block">
                    {c.count} items in stock
                  </span>
                </div>
                <span className="font-semibold text-aai-foreground">
                  ₹{c.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Warehouse Breakdown */}
        <div className="bg-aai-card border border-aai-border p-5 rounded">
          <h3 className="font-bold text-sm text-aai-foreground mb-3 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-aai-blue" /> Valuation by Store
          </h3>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {valuationData?.warehouseValuation.map((w: any, i: number) => (
              <div
                key={i}
                className="p-3 bg-aai-surface/60 border border-aai-border rounded flex justify-between items-center text-xs"
              >
                <div>
                  <span className="font-bold text-aai-foreground block">
                    {w.name}
                  </span>
                  <span className="text-[10px] text-aai-muted mt-0.5 block">
                    Airport: {w.airport}
                  </span>
                </div>
                <span className="font-semibold text-aai-foreground">
                  ₹{w.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Velocity Indexes summary */}
        <div className="bg-aai-card border border-aai-border p-5 rounded">
          <h3 className="font-bold text-sm text-aai-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-aai-accent" /> Asset Velocity
            Index
          </h3>
          <div className="grid grid-cols-2 gap-4 h-56">
            {/* Fast moving */}
            <div className="flex flex-col bg-aai-surface/40 border border-aai-border rounded p-3.5 overflow-hidden">
              <span className="text-[10px] font-bold text-aai-success uppercase tracking-wide flex items-center gap-1 mb-2">
                <TrendingUp className="h-3.5 w-3.5" /> High-Velocity
              </span>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[10px] leading-tight">
                {velocityData?.fastMoving.map((item: any) => (
                  <div
                    key={item.itemId}
                    className="p-1.5 bg-aai-surface/60 border border-aai-border/40 rounded flex justify-between gap-1.5"
                  >
                    <span className="font-semibold text-aai-foreground truncate">
                      {item.name}
                    </span>
                    <span className="text-aai-success font-extrabold flex-shrink-0">
                      +{item.totalIssued}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Slow moving */}
            <div className="flex flex-col bg-aai-surface/40 border border-aai-border rounded p-3.5 overflow-hidden">
              <span className="text-[10px] font-bold text-aai-error uppercase tracking-wide flex items-center gap-1 mb-2">
                <TrendingDown className="h-3.5 w-3.5" /> Slow/Dead Stock
              </span>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[10px] leading-tight">
                {velocityData?.slowMoving.map((item: any) => (
                  <div
                    key={item.itemId}
                    className="p-1.5 bg-aai-surface/60 border border-aai-border/40 rounded flex justify-between gap-1.5"
                  >
                    <span className="font-semibold text-aai-foreground truncate">
                      {item.name}
                    </span>
                    <span className="text-aai-error font-extrabold flex-shrink-0">
                      {item.totalIssued}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Valuation Detail Ledger Table */}
      <div className="bg-aai-card border border-aai-border rounded p-5">
        <h3 className="font-bold text-sm text-aai-foreground mb-4">
          Stock Valuation Ledger Breakdown
        </h3>
        <div className="overflow-x-auto border border-aai-border rounded">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-aai-surface border-b border-aai-border text-[9px] uppercase font-bold tracking-wide text-aai-muted">
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Warehouse Store</th>
                <th className="px-4 py-3 text-center">In Stock</th>
                <th className="px-4 py-3 text-right">Unit Value</th>
                <th className="px-4 py-3 text-right">Total Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aai-border text-aai-light">
              {valuationData?.stockLevels.map((sl: any, idx: number) => (
                <tr key={idx} className="hover:bg-aai-navy/10 transition-all">
                  <td className="px-4 py-2.5 font-mono font-bold text-aai-blue tracking-wide">
                    {sl.skuCode}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-aai-foreground">
                    {sl.itemName}
                  </td>
                  <td className="px-4 py-2.5 text-aai-muted font-semibold">
                    {sl.categoryName}
                  </td>
                  <td className="px-4 py-2.5 text-aai-muted">
                    {sl.warehouseName} ({sl.airportCode})
                  </td>
                  <td className="px-4 py-2.5 text-center font-extrabold">
                    {sl.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold">
                    ₹{sl.unitCost.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-aai-foreground">
                    ₹{sl.totalValue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
