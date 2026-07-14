'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/axios';
import { format } from 'date-fns';
import { Calendar, AlertCircle, FileText, CheckCircle, HelpCircle, XCircle } from 'lucide-react';

export default function LeavesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Form states
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState('Morning');
  const [reason, setReason] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [delegatedWorkTo, setDelegatedWorkTo] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Live validation feedback
  const [valMessage, setValMessage] = useState<{ isValid: boolean; message: string; duration?: number } | null>(null);
  const [valLoading, setValLoading] = useState(false);

  // Queries
  const { data: balances } = useQuery({
    queryKey: ['myBalances'],
    queryFn: async () => {
      const res = await api.get('/leaves/balance');
      return res.data;
    }
  });

  const { data: leaves } = useQuery({
    queryKey: ['myLeaves'],
    queryFn: async () => {
      const res = await api.get('/leaves/history');
      return res.data;
    }
  });

  const { data: employees } = useQuery({
    queryKey: ['employeeDirectoryList'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data.filter((e: any) => e._id !== session?.user?.id); // Exclude self
    }
  });

  // Run live validation whenever critical parameters change
  useEffect(() => {
    if (!leaveTypeId || !startDate || !endDate) {
      setValMessage(null);
      return;
    }

    const timer = setTimeout(async () => {
      setValLoading(true);
      try {
        // Find if policy requires a document and if it exceeds minimum days
        const activeBalance = balances?.find((b: any) => b.leaveType._id === leaveTypeId);
        const code = activeBalance?.leaveType?.code || '';

        // Formulate query params
        const params = new URLSearchParams({
          type: 'utilization', // placeholder
          departmentId: '', // placeholder
        });

        // We will call a custom dry-run validation endpoint or mock/simulate policy rule alerts.
        // Actually, our backend has validateLeaveApplication, which is run during leave submission.
        // We can create a quick mock check or use local date evaluations to help the employee.
        // Let's do a simulation based on active balances for instant feedback.
        const s = new Date(startDate);
        const e = new Date(endDate);
        const days = isHalfDay ? 0.5 : Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        if (isNaN(days) || days <= 0) {
          setValMessage({ isValid: false, message: 'Invalid date range selected' });
          return;
        }

        const remaining = activeBalance?.remaining || 0;

        if (code !== 'LOP' && remaining < days) {
          setValMessage({
            isValid: false,
            message: `Insufficient balance! You request ${days} days but only have ${remaining} available.`
          });
        } else {
          setValMessage({
            isValid: true,
            message: `Leave is valid. Requested: ${days} day(s).`,
            duration: days
          });
        }
      } catch (err) {
        setValMessage(null);
      } finally {
        setValLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [leaveTypeId, startDate, endDate, isHalfDay, balances]);

  // Submit Mutation (handles multipart for file upload)
  const applyMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return api.post('/leaves', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBalances'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      // Reset form
      setLeaveTypeId('');
      setStartDate('');
      setEndDate('');
      setIsHalfDay(false);
      setReason('');
      setEmergencyContact('');
      setDelegatedWorkTo('');
      setSelectedFile(null);
      setValMessage({ isValid: true, message: 'Applied successfully!' });
    },
    onError: (err: any) => {
      setValMessage({
        isValid: false,
        message: err.response?.data?.message || 'Error submitting leave application.'
      });
    }
  });

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveTypeId || !startDate || !endDate || !reason) {
      alert('Please fill in all required fields.');
      return;
    }

    const formData = new FormData();
    formData.append('leaveType', leaveTypeId);
    formData.append('startDate', startDate);
    formData.append('endDate', endDate);
    formData.append('isHalfDay', String(isHalfDay));
    formData.append('halfDaySession', isHalfDay ? halfDaySession : 'None');
    formData.append('reason', reason);
    formData.append('emergencyContact', emergencyContact);
    formData.append('delegatedWorkTo', delegatedWorkTo);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    applyMutation.mutate(formData);
  };

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/leaves/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBalances'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Leaves & Absences</h1>
          <p className="text-xs text-muted-foreground mt-1">Submit time-off requests and track balance histories.</p>
        </div>

        {/* Leave Balances Header Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {balances?.map((b: any) => (
            <div key={b._id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">
                {b.leaveType.code}
              </span>
              <h4 className="text-xs font-bold text-muted-foreground mt-2 truncate">{b.leaveType.name}</h4>
              <div className="mt-3 flex justify-between items-baseline">
                <span className="text-2xl font-black text-foreground">{b.remaining}</span>
                <span className="text-[10px] text-muted-foreground">/ {b.available} Available</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Apply Form Panel */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <h3 className="text-sm font-bold tracking-wide uppercase mb-6 flex items-center">
              <Calendar className="mr-2 h-5 w-5 text-primary animate-pulse" /> Apply for Leave
            </h3>
            
            <form onSubmit={handleApplySubmit} className="space-y-5 text-xs">
              
              {/* Row 1: Leave Type */}
              <div>
                <label className="block font-bold text-muted-foreground mb-2">Leave Type *</label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  required
                  className="w-full rounded-xl bg-muted border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a Leave Type</option>
                  {balances?.map((b: any) => (
                    <option key={b.leaveType._id} value={b.leaveType._id}>
                      {b.leaveType.name} (CL: {b.remaining})
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2: Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-muted-foreground mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full rounded-xl bg-muted border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-muted-foreground mb-2">End Date *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full rounded-xl bg-muted border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Half Day Check */}
              <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-xl border border-border/40">
                <input
                  type="checkbox"
                  id="isHalfDay"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isHalfDay" className="font-bold text-muted-foreground">Apply as Half Day</label>

                {isHalfDay && (
                  <select
                    value={halfDaySession}
                    onChange={(e) => setHalfDaySession(e.target.value)}
                    className="ml-auto rounded-lg bg-background border border-border p-1 text-[10px]"
                  >
                    <option value="Morning">Morning Session</option>
                    <option value="Afternoon">Afternoon Session</option>
                  </select>
                )}
              </div>

              {/* Delegate and Emergency Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-muted-foreground mb-2">Delegate Work To</label>
                  <select
                    value={delegatedWorkTo}
                    onChange={(e) => setDelegatedWorkTo(e.target.value)}
                    className="w-full rounded-xl bg-muted border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select Colleague</option>
                    {employees?.map((emp: any) => (
                      <option key={emp._id} value={emp._id}>{emp.name} ({emp.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-muted-foreground mb-2">Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="Phone number / Name"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full rounded-xl bg-muted border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Medical certificate upload */}
              <div>
                <label className="block font-bold text-muted-foreground mb-2">Upload Supporting Document (If Required)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-border border-dashed rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                      <FileText className="w-6 h-6 text-muted-foreground mb-1.5" />
                      <p className="text-[10px] text-muted-foreground">
                        {selectedFile ? selectedFile.name : 'Select Medical Certificate / Documents (PDF, JPG, PNG up to 5MB)'}
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-muted-foreground mb-2">Reason for Leave *</label>
                <textarea
                  rows={3}
                  placeholder="Provide details about your leave..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="w-full rounded-xl bg-muted border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Validation alert banner */}
              {valLoading && (
                <div className="text-xs text-muted-foreground animate-pulse">Checking policy rules...</div>
              )}

              {valMessage && (
                <div className={`p-3.5 rounded-xl border flex items-start space-x-2 ${
                  valMessage.isValid 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}>
                  {valMessage.isValid ? <CheckCircle className="h-4.5 w-4.5 shrink-0" /> : <AlertCircle className="h-4.5 w-4.5 shrink-0" />}
                  <span>{valMessage.message}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={applyMutation.isPending}
                className="w-full rounded-xl bg-primary py-2.5 font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 transition duration-150"
              >
                {applyMutation.isPending ? 'Submitting Leave Request...' : 'Submit Application'}
              </button>

            </form>
          </div>

          {/* History Panel */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold tracking-wide uppercase mb-6">Leave History</h3>
            <div className="flex-1 space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {leaves?.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No leave applications found.</p>
              ) : (
                leaves?.map((app: any) => (
                  <div key={app._id} className="border-b border-border/40 pb-4 last:border-b-0 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold">{app.leaveType.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(app.startDate), 'MMM dd, yyyy')} - {format(new Date(app.endDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        app.status === 'Approved' ? 'bg-success/15 text-success' :
                        app.status === 'Rejected' ? 'bg-destructive/15 text-destructive' :
                        app.status === 'Cancelled' ? 'bg-slate-500/15 text-muted-foreground' :
                        'bg-amber-500/15 text-amber-500'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                    
                    <div className="mt-2.5 flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-muted-foreground">{app.duration} day(s)</span>
                      
                      {/* Cancel action */}
                      {app.status === 'Pending' || app.status === 'Approved' ? (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to cancel this leave application?')) {
                              cancelMutation.mutate(app._id);
                            }
                          }}
                          className="text-[10px] font-bold text-destructive hover:underline"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
