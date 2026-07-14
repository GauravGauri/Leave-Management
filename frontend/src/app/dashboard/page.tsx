'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/axios';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  UserCheck, ShieldCheck, Clock, CalendarDays, ClipboardCheck, ArrowUpRight,
  TrendingUp, Award, BellRing, UserCircle
} from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'];

export default function DashboardPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const userRole = session?.user?.role || 'Employee';
  const isAdminOrHr = userRole === 'Super Admin' || userRole === 'HR Admin';

  // Fetch admin dashboard details
  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard/admin');
      return res.data;
    },
    enabled: isAdminOrHr,
  });

  // Fetch employee dashboard details
  const { data: employeeData, isLoading: employeeLoading } = useQuery({
    queryKey: ['employeeDashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard/employee');
      return res.data;
    },
    enabled: !isAdminOrHr,
  });

  // Approve Mutation for quick dashboard approvals
  const approvalMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      return api.post(`/leaves/${id}/approval`, { action, comment: `Processed via Quick Dashboard` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
    },
  });

  const handleApproval = (id: string, action: string) => {
    approvalMutation.mutate({ id, action });
  };

  const renderAdminDashboard = () => {
    if (adminLoading || !adminData) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 rounded-2xl bg-muted animate-pulse" />
            <div className="h-80 rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
      );
    }

    const { stats, charts, todayLeavesList, pendingList } = adminData;

    return (
      <div className="space-y-8">
        {/* Welcome Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Admin Overview</h1>
            <p className="text-xs text-muted-foreground mt-1">Real-time control center for organization leaves.</p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold bg-primary/10 text-primary px-3.5 py-1.5 rounded-full border border-primary/20">
            <ShieldCheck className="h-4.5 w-4.5" />
            <span>Operational Mode: {userRole}</span>
          </div>
        </div>

        {/* Numeric Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex items-center space-x-4">
            <div className="rounded-xl bg-blue-500/10 p-3.5 text-blue-500">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Employees</p>
              <h3 className="text-2xl font-extrabold mt-1">{stats.totalEmployees}</h3>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex items-center space-x-4">
            <div className="rounded-xl bg-emerald-500/10 p-3.5 text-emerald-500">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Out of Office Today</p>
              <h3 className="text-2xl font-extrabold mt-1">{stats.leavesToday}</h3>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex items-center space-x-4">
            <div className="rounded-xl bg-amber-500/10 p-3.5 text-amber-500 animate-pulse">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pending Approvals</p>
              <h3 className="text-2xl font-extrabold mt-1">{stats.pendingApprovals}</h3>
            </div>
          </div>
        </div>

        {/* Recharts Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar chart - Monthly leave counts */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold tracking-wide uppercase mb-6 flex items-center">
              <TrendingUp className="mr-2 h-4.5 w-4.5 text-primary" /> Monthly Leave Trend
            </h3>
            <div className="h-64 w-full text-xs">
              {charts.monthlyChart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">No approved leaves in the last 6 months.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="leaves" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Pie chart - Leave type distributions */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold tracking-wide uppercase mb-6 flex items-center">
              <Award className="mr-2 h-4.5 w-4.5 text-emerald-500" /> Leave Distribution
            </h3>
            <div className="h-64 w-full text-xs">
              {charts.leaveTypeChart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">No data distributions yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.leaveTypeChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {charts.leaveTypeChart.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Actions and Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quick Approvals (2/3 width) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2 flex flex-col">
            <h3 className="text-sm font-bold tracking-wide uppercase mb-5">Quick Approvals</h3>
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-1">
              {pendingList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No pending approval items.</p>
              ) : (
                pendingList.map((app: any) => (
                  <div key={app._id} className="flex items-center justify-between border-b border-border/40 pb-4 last:border-b-0">
                    <div>
                      <h4 className="font-bold text-xs">{app.employee.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {app.leaveType.name} ({app.leaveType.code}) • {format(new Date(app.startDate), 'MMM dd')} - {format(new Date(app.endDate), 'MMM dd')} ({app.duration} days)
                      </p>
                      <p className="text-[10px] italic text-muted-foreground/80 mt-1 max-w-[280px] truncate">"{app.reason}"</p>
                    </div>
                    <div className="flex space-x-2.5">
                      <button
                        onClick={() => handleApproval(app._id, 'Approve')}
                        className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500 hover:text-white transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval(app._id, 'Reject')}
                        className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-[10px] font-bold text-destructive hover:bg-destructive hover:text-white transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Out of Office list (1/3 width) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold tracking-wide uppercase mb-5">Out of Office today</h3>
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px]">
              {todayLeavesList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Everybody is at work today!</p>
              ) : (
                todayLeavesList.map((l: any) => (
                  <div key={l._id} className="flex items-center space-x-3 pb-3 border-b border-border/40 last:border-b-0">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground border">
                      {l.employee.name.substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">{l.employee.name}</h4>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase">
                        {l.leaveType.code}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    );
  };

  const renderEmployeeDashboard = () => {
    if (employeeLoading || !employeeData) {
      return (
        <div className="space-y-6">
          <div className="h-32 rounded-2xl bg-muted animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      );
    }

    const { balances, stats, recentApplications, upcomingHolidays, announcements } = employeeData;

    return (
      <div className="space-y-8">
        {/* Welcome Block */}
        <div className="rounded-2xl bg-gradient-to-r from-primary/90 to-indigo-700/90 p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12 shrink-0">
            <UserCircle className="h-72 w-72" />
          </div>
          <h1 className="text-2xl font-extrabold md:text-3xl tracking-tight">Welcome, {session?.user?.name || 'Employee'}!</h1>
          <p className="text-sm text-slate-200 mt-2 max-w-lg leading-relaxed">
            Manage your leaves, WFH schedules, check company calendar holidays, or ask your AI HR assistant for recommendations.
          </p>
        </div>

        {/* Leave Balances Grid */}
        <div>
          <h2 className="text-sm font-bold tracking-wide uppercase mb-4">Leave Balances</h2>
          {balances.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No leave balances found. Contact HR to link a leave policy.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {balances.map((b: any) => (
                <div key={b.code} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
                  <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold tracking-wider">
                    {b.code}
                  </span>
                  <h4 className="text-xs font-bold text-muted-foreground mt-2 truncate">{b.name}</h4>
                  
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-border/40 pt-3">
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Alloc</span>
                      <span className="text-xs font-extrabold">{b.available}</span>
                    </div>
                    <div className="border-x border-border/40">
                      <span className="block text-[10px] text-muted-foreground">Used</span>
                      <span className="text-xs font-extrabold text-muted-foreground">{b.used}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-primary">Avail</span>
                      <span className="text-xs font-extrabold text-primary">{b.remaining}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Middle Section: Announcements & Holidays */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Announcements (2/3 width) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2 flex flex-col">
            <h3 className="text-xs font-bold tracking-wide uppercase mb-4 flex items-center">
              <BellRing className="mr-2 h-4 w-4 text-warning" /> Announcements
            </h3>
            <div className="flex-1 space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {announcements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No recent updates.</p>
              ) : (
                announcements.map((ann: any) => (
                  <div key={ann._id} className="border-b border-border/40 pb-4 last:border-b-0">
                    <h4 className="font-extrabold text-xs">{ann.title}</h4>
                    <p className="text-muted-foreground text-[10px] mt-1.5 leading-relaxed">{ann.content}</p>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground/80 mt-2.5">
                      <span>Posted by {ann.author.name} ({ann.author.role})</span>
                      <span>{format(new Date(ann.createdAt), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Holidays (1/3 width) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col">
            <h3 className="text-xs font-bold tracking-wide uppercase mb-4 flex items-center">
              <CalendarDays className="mr-2 h-4 w-4 text-primary" /> Upcoming Holidays
            </h3>
            <div className="flex-1 space-y-3.5 max-h-[300px] overflow-y-auto">
              {upcomingHolidays.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No holidays scheduled.</p>
              ) : (
                upcomingHolidays.map((h: any) => (
                  <div key={h._id} className="flex justify-between items-center border-b border-border/40 pb-2.5 last:border-b-0">
                    <div>
                      <h4 className="font-bold text-xs">{h.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(h.date), 'EEEE, MMM dd')}</p>
                    </div>
                    {h.isOptional && (
                      <span className="text-[8px] font-bold border border-warning/30 bg-warning/10 text-warning px-1.5 py-0.5 rounded">
                        Optional
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Bottom Section: Recent Applications list */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-xs font-bold tracking-wide uppercase mb-5 flex items-center">
            <ClipboardCheck className="mr-2 h-4 w-4 text-success" /> Recent Applications
          </h3>
          <div className="overflow-x-auto">
            {recentApplications.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">You have not applied for any leaves yet.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold">Leave Type</th>
                    <th className="pb-3 font-semibold">Dates</th>
                    <th className="pb-3 font-semibold">Duration</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentApplications.map((app: any) => (
                    <tr key={app._id} className="hover:bg-muted/30">
                      <td className="py-3 font-bold">{app.leaveType.name}</td>
                      <td className="py-3">
                        {format(new Date(app.startDate), 'yyyy-MM-dd')} to {format(new Date(app.endDate), 'yyyy-MM-dd')}
                      </td>
                      <td className="py-3 font-semibold">{app.duration} day(s)</td>
                      <td className="py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          app.status === 'Approved' ? 'bg-success/15 text-success' :
                          app.status === 'Rejected' ? 'bg-destructive/15 text-destructive' :
                          app.status === 'Cancelled' ? 'bg-slate-500/15 text-muted-foreground' :
                          'bg-amber-500/15 text-amber-500'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground italic truncate max-w-[200px]">"{app.reason}"</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    );
  };

  return (
    <DashboardLayout>
      {isAdminOrHr ? renderAdminDashboard() : renderEmployeeDashboard()}
    </DashboardLayout>
  );
}
