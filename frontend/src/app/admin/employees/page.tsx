'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/axios';
import { format } from 'date-fns';
import { Users, UserPlus, Upload, ShieldAlert, KeyRound, UserMinus } from 'lucide-react';

export default function EmployeesPage() {
  const queryClient = useQueryClient();

  // Form toggles
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);

  // Password reset state
  const [resettingUser, setResettingUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Employee');
  const [gender, setGender] = useState('Male');
  const [deptId, setDeptId] = useState('');
  const [desgId, setDesgId] = useState('');
  const [mgrId, setMgrId] = useState('');
  const [joiningDate, setJoiningDate] = useState('');

  // Excel import file state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Queries
  const { data: employees, isLoading } = useQuery({
    queryKey: ['adminEmployees'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data;
    }
  });

  const { data: departments } = useQuery({
    queryKey: ['deptsList'],
    queryFn: async () => {
      const res = await api.get('/settings/departments');
      return res.data;
    }
  });

  const { data: designations } = useQuery({
    queryKey: ['desgsList'],
    queryFn: async () => {
      const res = await api.get('/settings/designations');
      return res.data;
    }
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/employees', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
      setShowAddForm(false);
      setName('');
      setEmail('');
      setPassword('');
      setDeptId('');
      setDesgId('');
      setMgrId('');
      setJoiningDate('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error creating employee');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return api.put(`/employees/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/auth/reset-password', data);
    },
    onSuccess: () => {
      alert('Password reset successfully!');
      setResettingUser(null);
      setNewPassword('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error resetting password');
    }
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/employees/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: (res) => {
      setImportStatus(`Successfully imported ${res.data.importedEmails?.length || 0} employees.`);
      queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
      setExcelFile(null);
    },
    onError: (err: any) => {
      setImportStatus(err.response?.data?.message || 'Error processing Excel import.');
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name, email, password, role, gender,
      department: deptId || null,
      designation: desgId || null,
      manager: mgrId || null,
      joiningDate
    });
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;
    setImportStatus('Uploading and parsing template rows...');
    importMutation.mutate(excelFile);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPassword) return;
    resetPasswordMutation.mutate({ userId: resettingUser, newPassword });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="h-60 rounded-2xl bg-muted animate-pulse" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Employee Directory</h1>
            <p className="text-xs text-muted-foreground mt-1">Manage personnel files, roles, status, and credentials.</p>
          </div>
          
          <div className="flex space-x-3.5">
            <button
              onClick={() => { setShowAddForm(!showAddForm); setShowImportPanel(false); }}
              className="flex items-center space-x-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/95 transition"
            >
              <UserPlus className="h-4.5 w-4.5" />
              <span>Add Employee</span>
            </button>
            <button
              onClick={() => { setShowImportPanel(!showImportPanel); setShowAddForm(false); }}
              className="flex items-center space-x-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 px-4 py-2 text-xs font-bold transition"
            >
              <Upload className="h-4.5 w-4.5" />
              <span>Import Excel</span>
            </button>
          </div>
        </div>

        {/* Excel Import Card */}
        {showImportPanel && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm max-w-lg text-xs">
            <h3 className="font-bold text-sm mb-4">Import Personnel from Spreadsheet</h3>
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl bg-muted border border-border p-2"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Excel columns structure: A: Name, B: Email, C: Password, D: Role, E: Gender, F: Department, G: Designation, H: Manager Email, I: Joining Date (YYYY-MM-DD)
              </p>
              
              {importStatus && (
                <div className="p-3 bg-muted border border-border rounded-xl text-foreground font-semibold">
                  {importStatus}
                </div>
              )}

              <button
                type="submit"
                disabled={importMutation.isPending}
                className="w-full rounded-xl bg-primary py-2 text-white font-bold"
              >
                {importMutation.isPending ? 'Importing...' : 'Upload Template'}
              </button>
            </form>
          </div>
        )}

        {/* Add Employee Form */}
        {showAddForm && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm max-w-2xl text-xs">
            <h3 className="font-bold text-sm mb-5">Register New Profile</h3>
            <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="block font-semibold mb-1">Name *</label>
                <input
                  type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email *</label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Password *</label>
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select
                  value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
                >
                  <option value="Employee">Employee</option>
                  <option value="Manager">Manager</option>
                  <option value="HR Admin">HR Admin</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Gender</label>
                <select
                  value={gender} onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Department</label>
                <select
                  value={deptId} onChange={(e) => setDeptId(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
                >
                  <option value="">None</option>
                  {departments?.map((d: any) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Designation</label>
                <select
                  value={desgId} onChange={(e) => setDesgId(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
                >
                  <option value="">None</option>
                  {designations?.map((d: any) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Reporting Manager</label>
                <select
                  value={mgrId} onChange={(e) => setMgrId(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
                >
                  <option value="">None</option>
                  {employees?.filter((e: any) => e.role === 'Manager' || e.role === 'Super Admin').map((mgr: any) => (
                    <option key={mgr._id} value={mgr._id}>{mgr.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Joining Date</label>
                <input
                  type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 pt-2.5">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full rounded-xl bg-primary py-2.5 font-bold text-white shadow-md"
                >
                  {createMutation.isPending ? 'Registering...' : 'Confirm Registration'}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Password Reset Modal Panel */}
        {resettingUser && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm max-w-sm text-xs">
            <h3 className="font-bold text-sm mb-4">Reset Password Override</h3>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none"
                required
              />
              <div className="flex space-x-3">
                <button type="submit" className="flex-1 bg-primary py-2 rounded-xl text-white font-bold">Reset</button>
                <button type="button" onClick={() => setResettingUser(null)} className="flex-1 bg-muted py-2 rounded-xl border">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Directory Grid/Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                  <th className="p-4 font-semibold">Name</th>
                  <th className="p-4 font-semibold">Role</th>
                  <th className="p-4 font-semibold">Department</th>
                  <th className="p-4 font-semibold">Manager</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Joined Date</th>
                  <th className="p-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {employees?.map((emp: any) => (
                  <tr key={emp._id} className="hover:bg-muted/10">
                    <td className="p-4 font-bold">
                      <div>{emp.name}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{emp.email}</div>
                    </td>
                    <td className="p-4 font-semibold">{emp.role}</td>
                    <td className="p-4 text-muted-foreground">{emp.department?.name || 'N/A'}</td>
                    <td className="p-4 text-muted-foreground">{emp.manager?.name || 'CEO / Board'}</td>
                    <td className="p-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        emp.status === 'Active' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">{format(new Date(emp.joiningDate), 'yyyy-MM-dd')}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center space-x-3">
                        {/* Reset Password */}
                        <button
                          onClick={() => setResettingUser(emp._id)}
                          title="Reset Password"
                          className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-primary transition"
                        >
                          <KeyRound className="h-4.5 w-4.5" />
                        </button>
                        {/* Toggle Status (Deactivate / Reactivate) */}
                        <button
                          onClick={() => {
                            const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
                            if (confirm(`Change status for ${emp.name} to ${newStatus}?`)) {
                              updateStatusMutation.mutate({ id: emp._id, status: newStatus });
                            }
                          }}
                          title={emp.status === 'Active' ? 'Deactivate Account' : 'Reactivate Account'}
                          className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-warning transition"
                        >
                          <UserMinus className="h-4.5 w-4.5" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (confirm(`Permanently delete employee record and balances for ${emp.name}?`)) {
                              deleteMutation.mutate(emp._id);
                            }
                          }}
                          title="Hard Delete record"
                          className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-destructive transition"
                        >
                          <ShieldAlert className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
