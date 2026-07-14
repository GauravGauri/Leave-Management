'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/axios';
import { Settings, Plus, Check, Save, RotateCcw } from 'lucide-react';

export default function PoliciesPage() {
  const queryClient = useQueryClient();
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  // Form states
  const [policyName, setPolicyName] = useState('');
  const [policyDesc, setPolicyDesc] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [rules, setRules] = useState<any[]>([]);

  // Fetch policies
  const { data: policies, isLoading } = useQuery({
    queryKey: ['adminPolicies'],
    queryFn: async () => {
      const res = await api.get('/policies');
      return res.data;
    }
  });

  // Fetch leave types
  const { data: leaveTypes } = useQuery({
    queryKey: ['leaveTypesList'],
    queryFn: async () => {
      const res = await api.get('/policies/types');
      return res.data;
    }
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/policies', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPolicies'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return api.put(`/policies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPolicies'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/policies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPolicies'] });
    }
  });

  const resetForm = () => {
    setEditingPolicyId(null);
    setPolicyName('');
    setPolicyDesc('');
    setIsDefault(false);
    setRules([]);
  };

  const handleEditClick = (policy: any) => {
    setEditingPolicyId(policy._id);
    setPolicyName(policy.name);
    setPolicyDesc(policy.description || '');
    setIsDefault(policy.isDefault);
    // Align rules state
    const alignedRules = leaveTypes?.map((lt: any) => {
      const existingRule = policy.rules.find((r: any) => r.leaveType?._id === lt._id || r.leaveType === lt._id);
      return existingRule ? {
        ...existingRule,
        leaveType: lt._id,
        leaveTypeCode: lt.code,
        leaveTypeName: lt.name
      } : {
        leaveType: lt._id,
        leaveTypeCode: lt.code,
        leaveTypeName: lt.name,
        monthlyAllocation: 0,
        yearlyAllocation: 0,
        carryForward: false,
        maxCarryForward: 0,
        sandwichPolicy: false,
        weekendRules: 'Exclude',
        holidayRules: 'Exclude',
        requiresMedicalCertificate: false
      };
    }) || [];
    setRules(alignedRules);
  };

  const handleRuleChange = (index: number, field: string, value: any) => {
    setRules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: policyName,
      description: policyDesc,
      isDefault,
      rules: rules.map(r => ({
        leaveType: r.leaveType,
        monthlyAllocation: Number(r.monthlyAllocation),
        yearlyAllocation: Number(r.yearlyAllocation),
        carryForward: !!r.carryForward,
        maxCarryForward: Number(r.maxCarryForward),
        sandwichPolicy: !!r.sandwichPolicy,
        weekendRules: r.weekendRules,
        holidayRules: r.holidayRules,
        requiresMedicalCertificate: !!r.requiresMedicalCertificate
      }))
    };

    if (editingPolicyId) {
      updateMutation.mutate({ id: editingPolicyId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
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
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Leave Policy Builder</h1>
          <p className="text-xs text-muted-foreground mt-1">Configure credit parameters, sandwich rules, and balance resets.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Policy Roster (1/3 width) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col">
            <h3 className="text-xs font-bold tracking-wide uppercase mb-5">Active Policies</h3>
            <div className="flex-1 space-y-4">
              {policies?.map((pol: any) => (
                <div key={pol._id} className="border border-border/60 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs">{pol.name}</h4>
                      {pol.isDefault && (
                        <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-extrabold uppercase">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{pol.description || 'No description provided.'}</p>
                  </div>
                  <div className="flex justify-end space-x-2.5 mt-3.5 pt-3 border-t border-border/40">
                    <button
                      onClick={() => handleEditClick(pol)}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Edit Config
                    </button>
                    {!pol.isDefault && (
                      <button
                        onClick={() => {
                          if (confirm('Delete this policy? Employees will revert to default policy.')) {
                            deleteMutation.mutate(pol._id);
                          }
                        }}
                        className="text-[10px] font-bold text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configuration Form / Editor Panel (2/3 width) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold tracking-wide uppercase">
                {editingPolicyId ? 'Edit Configuration' : 'Create New Policy'}
              </h3>
              {editingPolicyId && (
                <button
                  onClick={resetForm}
                  className="flex items-center space-x-1 text-[10px] text-muted-foreground hover:text-foreground font-semibold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset / Create</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 text-xs">
              
              {/* Name & Desc */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-muted-foreground mb-1">Policy Name *</label>
                  <input
                    type="text" required value={policyName} onChange={(e) => setPolicyName(e.target.value)}
                    placeholder="e.g. Standard Developer Policy"
                    className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-muted-foreground mb-1">Description</label>
                  <input
                    type="text" value={policyDesc} onChange={(e) => setPolicyDesc(e.target.value)}
                    placeholder="Explain policy conditions..."
                    className="w-full rounded-xl bg-muted border border-border p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Default checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                <label htmlFor="isDefault" className="font-bold text-muted-foreground">Make this the default organization policy</label>
              </div>

              {/* Rules Grid */}
              <div className="space-y-4">
                <h4 className="font-bold border-b pb-2 mb-3">Custom Rules per Leave Type</h4>
                {rules.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Click "Edit Config" on a policy to override rules.</p>
                ) : (
                  <div className="space-y-6">
                    {rules.map((rule, idx) => (
                      <div key={rule.leaveType} className="border border-border/40 rounded-xl p-4 bg-muted/15 space-y-4">
                        
                        {/* Title header */}
                        <div className="flex justify-between items-center border-b border-border/40 pb-2">
                          <span className="font-extrabold text-xs text-primary uppercase">{rule.leaveTypeName} ({rule.leaveTypeCode})</span>
                        </div>

                        {/* Credit controls */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Monthly Credit</label>
                            <input
                              type="number"
                              value={rule.monthlyAllocation}
                              onChange={(e) => handleRuleChange(idx, 'monthlyAllocation', e.target.value)}
                              className="w-full rounded bg-muted border border-border p-1"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Yearly Capping</label>
                            <input
                              type="number"
                              value={rule.yearlyAllocation}
                              onChange={(e) => handleRuleChange(idx, 'yearlyAllocation', e.target.value)}
                              className="w-full rounded bg-muted border border-border p-1"
                            />
                          </div>
                          <div className="flex items-center space-x-1.5 pt-3.5">
                            <input
                              type="checkbox"
                              checked={rule.carryForward}
                              onChange={(e) => handleRuleChange(idx, 'carryForward', e.target.checked)}
                              className="h-3.5 w-3.5"
                            />
                            <label className="text-[10px] text-muted-foreground font-semibold">Carry Forward</label>
                          </div>
                          {rule.carryForward && (
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-0.5">Max Carry Cap</label>
                              <input
                                type="number"
                                value={rule.maxCarryForward}
                                onChange={(e) => handleRuleChange(idx, 'maxCarryForward', e.target.value)}
                                className="w-full rounded bg-muted border border-border p-1"
                              />
                            </div>
                          )}
                        </div>

                        {/* Weekend/Holiday configuration */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-border/20 pt-3.5">
                          <div className="flex items-center space-x-1.5 pt-1.5">
                            <input
                              type="checkbox"
                              checked={rule.sandwichPolicy}
                              onChange={(e) => handleRuleChange(idx, 'sandwichPolicy', e.target.checked)}
                              className="h-3.5 w-3.5"
                            />
                            <label className="text-[10px] text-muted-foreground font-semibold">Sandwich Policy</label>
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Weekend Rules</label>
                            <select
                              value={rule.weekendRules}
                              onChange={(e) => handleRuleChange(idx, 'weekendRules', e.target.value)}
                              className="w-full rounded bg-muted border border-border p-1 text-[10px]"
                            >
                              <option value="Exclude">Exclude Weekends</option>
                              <option value="Include">Include Weekends</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-0.5">Holiday Rules</label>
                            <select
                              value={rule.holidayRules}
                              onChange={(e) => handleRuleChange(idx, 'holidayRules', e.target.value)}
                              className="w-full rounded bg-muted border border-border p-1 text-[10px]"
                            >
                              <option value="Exclude">Exclude Holidays</option>
                              <option value="Include">Include Holidays</option>
                            </select>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full rounded-xl bg-primary py-2.5 font-bold text-white shadow-lg flex justify-center items-center space-x-1.5"
              >
                <Save className="h-4.5 w-4.5" />
                <span>{editingPolicyId ? 'Update Policy Configuration' : 'Create New Policy'}</span>
              </button>

            </form>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
