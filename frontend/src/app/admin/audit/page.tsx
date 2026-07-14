'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/axios';
import { format } from 'date-fns';
import { ShieldCheck, Database, Terminal } from 'lucide-react';

export default function AuditLogsPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['auditLogsList'],
    queryFn: async () => {
      const res = await api.get('/settings/audit-logs');
      return res.data;
    }
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="h-60 rounded-2xl bg-muted animate-pulse" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 text-xs">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">System Audit Logs</h1>
            <p className="text-xs text-muted-foreground mt-1 font-normal">Security logging and operational records.</p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold bg-destructive/10 text-destructive px-3.5 py-1.5 rounded-full border border-destructive/20">
            <ShieldCheck className="h-4.5 w-4.5" />
            <span>Compliance Mode</span>
          </div>
        </div>

        {/* Logs Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/10 font-bold uppercase tracking-wider text-muted-foreground flex items-center">
            <Terminal className="mr-2 h-4 w-4 text-primary" />
            <span>Activity Trail (Last 100 entries)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                  <th className="p-4 font-semibold uppercase tracking-wider text-[10px]">Timestamp</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-[10px]">User Email</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-[10px]">Action</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-[10px]">Details</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-[10px]">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">No audit entries logged yet.</td>
                  </tr>
                ) : (
                  logs?.map((log: any) => (
                    <tr key={log._id} className="hover:bg-muted/10 font-mono text-[11px]">
                      <td className="p-4 text-muted-foreground">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="p-4 font-bold text-foreground">
                        {log.user ? log.user.email : 'SYSTEM'}
                      </td>
                      <td className="p-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-secondary border border-border text-[9px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground font-sans text-xs">
                        {log.details}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
