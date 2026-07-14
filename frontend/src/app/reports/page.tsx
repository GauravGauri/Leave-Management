'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/axios';
import { FileSpreadsheet, FileDown, Eye, Filter } from 'lucide-react';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('utilization');
  const [departmentId, setDepartmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  // Fetch departments for dropdown
  const { data: departments } = useQuery({
    queryKey: ['reportsDepts'],
    queryFn: async () => {
      const res = await api.get('/settings/departments');
      return res.data;
    }
  });

  // Query to fetch report data for inline table preview
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['reportGrid', reportType, departmentId, startDate, endDate],
    queryFn: async () => {
      const params: any = { type: reportType };
      if (departmentId) params.departmentId = departmentId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const res = await api.get('/reports', { params });
      return res.data;
    }
  });

  // Download logic using Axios Blobs (preserves Bearer headers)
  const triggerDownload = async (format: 'excel' | 'pdf') => {
    setDownloadingFormat(format);
    try {
      const params: any = { type: reportType };
      if (departmentId) params.departmentId = departmentId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const endpoint = format === 'excel' ? '/reports/export/excel' : '/reports/export/pdf';
      const res = await api.get(endpoint, {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hrms_report_${reportType}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download error:', err);
      alert('Error downloading report. Please verify connection credentials.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const getTableHeaders = () => {
    if (!reportData || reportData.length === 0) return [];
    return Object.keys(reportData[0]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 text-xs">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Analytics & Reports</h1>
          <p className="text-xs text-muted-foreground mt-1 font-normal">Audit leave patterns, utilization rates, and balance registers.</p>
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 font-bold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">
            <Filter className="h-4 w-4" />
            <span>Filter Parameters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Report Type */}
            <div>
              <label className="block font-bold text-muted-foreground mb-1.5">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="utilization">Leave Utilization Rate</option>
                <option value="balance">Leave Balance Grid</option>
                <option value="wfh">Work From Home Report</option>
                <option value="transaction">General Transaction Log</option>
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="block font-bold text-muted-foreground mb-1.5">Department Filter</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Departments</option>
                {departments?.map((d: any) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block font-bold text-muted-foreground mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block font-bold text-muted-foreground mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
              />
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex justify-end space-x-3 pt-3.5 border-t border-border/40">
            <button
              onClick={() => triggerDownload('excel')}
              disabled={downloadingFormat !== null || isLoading}
              className="flex items-center space-x-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm transition"
            >
              <FileSpreadsheet className="h-4.5 w-4.5" />
              <span>{downloadingFormat === 'excel' ? 'Exporting...' : 'Export Excel'}</span>
            </button>
            
            <button
              onClick={() => triggerDownload('pdf')}
              disabled={downloadingFormat !== null || isLoading}
              className="flex items-center space-x-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2 font-bold text-white shadow-sm transition"
            >
              <FileDown className="h-4.5 w-4.5" />
              <span>{downloadingFormat === 'pdf' ? 'Exporting...' : 'Export PDF'}</span>
            </button>
          </div>
        </div>

        {/* Report Preview Grid */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/10 font-bold uppercase tracking-wider text-muted-foreground flex items-center">
            <Eye className="mr-2 h-4 w-4" />
            <span>Inline Data Preview ({reportData?.length || 0} rows)</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Calculating statistics...</div>
          ) : !reportData || reportData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No records match the current filter criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                    {getTableHeaders().map((head) => (
                      <th key={head} className="p-4 font-semibold uppercase tracking-wider text-[10px]">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {reportData.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/10">
                      {getTableHeaders().map((col) => (
                        <td key={col} className="p-4 text-foreground font-medium">
                          {String(row[col] !== undefined && row[col] !== null ? row[col] : 'N/A')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
