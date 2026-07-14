'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/axios';
import { format } from 'date-fns';
import { CheckSquare, MessageSquare, AlertCircle, FileText, CheckCircle, XCircle } from 'lucide-react';

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});

  const userRole = session?.user?.role || 'Employee';

  // Fetch leave applications (the backend controller handles filters for manager/hr/admin)
  const { data: leaves, isLoading } = useQuery({
    queryKey: ['workflowLeaves'],
    queryFn: async () => {
      const res = await api.get('/leaves/history');
      return res.data;
    }
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ id, action, comment }: { id: string; action: string; comment: string }) => {
      return api.post(`/leaves/${id}/approval`, { action, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowLeaves'] });
      setCommentText({});
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error processing approval.');
    }
  });

  const handleAction = (id: string, action: string) => {
    const comment = commentText[id] || `${action}d via Portal`;
    approvalMutation.mutate({ id, action, comment });
  };

  const handleCommentChange = (id: string, text: string) => {
    setCommentText(prev => ({ ...prev, [id]: text }));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="h-60 rounded-2xl bg-muted animate-pulse" />
      </DashboardLayout>
    );
  }

  const pendingLeaves = leaves?.filter((l: any) => l.status === 'Pending') || [];
  const historicalLeaves = leaves?.filter((l: any) => l.status !== 'Pending') || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Approvals & Workflow</h1>
          <p className="text-xs text-muted-foreground mt-1">Review leave applications, add remarks, or override limits.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 pr-6 border-b-2 transition ${
              activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            Pending Requests ({pendingLeaves.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 pr-6 border-b-2 transition ${
              activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            Past Action Logs ({historicalLeaves.length})
          </button>
        </div>

        {/* List Content */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm text-xs">
          
          {activeTab === 'pending' ? (
            pendingLeaves.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle className="mx-auto h-8 w-8 text-emerald-500 mb-3" />
                <p className="font-bold">All caught up!</p>
                <p className="text-[10px] mt-1">No pending leave applications require your review.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {pendingLeaves.map((l: any) => (
                  <div key={l._id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-muted/10 transition">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-foreground">{l.employee.name}</h4>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase">
                          {l.leaveType.code}
                        </span>
                      </div>
                      
                      <div className="text-muted-foreground space-y-0.5">
                        <p>Dates: <span className="font-semibold text-foreground">{format(new Date(l.startDate), 'yyyy-MM-dd')} to {format(new Date(l.endDate), 'yyyy-MM-dd')}</span></p>
                        <p>Duration: <span className="font-semibold text-foreground">{l.duration} day(s)</span></p>
                        <p>Reason: <span className="italic text-foreground">"{l.reason}"</span></p>
                        {l.medicalCertificateUrl && (
                          <p className="text-primary hover:underline font-bold mt-1.5 flex items-center">
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            <a href={l.medicalCertificateUrl} target="_blank" rel="noreferrer">View Medical Document</a>
                          </p>
                        )}
                      </div>

                      {/* Comment Input */}
                      <div className="relative mt-3 max-w-sm">
                        <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Add approval comment/remarks..."
                          value={commentText[l._id] || ''}
                          onChange={(e) => handleCommentChange(l._id, e.target.value)}
                          className="w-full rounded-xl bg-muted border border-border py-2 pl-9 pr-4 focus:outline-none focus:ring-1 focus:ring-primary text-[11px]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-3.5 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleAction(l._id, 'Approve')}
                        disabled={approvalMutation.isPending}
                        className="rounded-xl bg-emerald-500 text-white px-5 py-2 font-bold hover:bg-emerald-600 transition shadow-sm shadow-emerald-500/10"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(l._id, 'Reject')}
                        disabled={approvalMutation.isPending}
                        className="rounded-xl bg-destructive text-white px-5 py-2 font-bold hover:bg-destructive/90 transition shadow-sm shadow-destructive/10"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Historical leaves
            historicalLeaves.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">No historical approval actions found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                      <th className="p-4 font-semibold">Employee</th>
                      <th className="p-4 font-semibold">Leave Type</th>
                      <th className="p-4 font-semibold">Dates</th>
                      <th className="p-4 font-semibold">Duration</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Manager Remark</th>
                      <th className="p-4 font-semibold">HR Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {historicalLeaves.map((l: any) => (
                      <tr key={l._id} className="hover:bg-muted/10">
                        <td className="p-4 font-bold">{l.employee.name}</td>
                        <td className="p-4 font-semibold text-primary">{l.leaveType.code}</td>
                        <td className="p-4">
                          {format(new Date(l.startDate), 'yyyy-MM-dd')} to {format(new Date(l.endDate), 'yyyy-MM-dd')}
                        </td>
                        <td className="p-4 font-semibold">{l.duration} day(s)</td>
                        <td className="p-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            l.status === 'Approved' ? 'bg-success/15 text-success' :
                            l.status === 'Rejected' ? 'bg-destructive/15 text-destructive' :
                            'bg-slate-500/15 text-muted-foreground'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground truncate max-w-[150px]">{l.managerApproval?.comment || 'N/A'}</td>
                        <td className="p-4 text-muted-foreground truncate max-w-[150px]">{l.hrApproval?.comment || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

        </div>

      </div>
    </DashboardLayout>
  );
}
