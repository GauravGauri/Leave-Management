'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Lock, Mail, Shield, Users, RefreshCw } from 'lucide-react';

const loginSchema = zod.object({
  email: zod.string().email('Please enter a valid email address'),
  password: zod.string().min(5, 'Password must be at least 5 characters'),
});

type LoginFormValues = zod.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: string) => {
    switch (role) {
      case 'admin':
        setValue('email', 'admin@company.com');
        setValue('password', 'Admin@123');
        break;
      case 'hr':
        setValue('email', 'hr@company.com');
        setValue('password', 'Hr@123');
        break;
      case 'manager':
        setValue('email', 'manager@company.com');
        setValue('password', 'Manager@123');
        break;
      case 'employee':
        setValue('email', 'employee@company.com');
        setValue('password', 'Employee@123');
        break;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-slate-900 via-slate-950 to-black px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-teal-500 shadow-lg shadow-primary/30">
            <Shield className="h-6 w-6 text-white animate-pulse" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            KekaHR Portal
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Enterprise Leave & Attendance Suite
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive-foreground border border-destructive/20">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="name@company.com"
                  className="w-full rounded-xl bg-slate-900/60 border border-slate-800 py-2.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-destructive-foreground">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-slate-900/60 border border-slate-800 py-2.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive-foreground">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-indigo-600 py-2.5 font-semibold text-white shadow-lg hover:from-primary/95 hover:to-indigo-600/95 transition duration-200 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                'Sign In to Workspace'
              )}
            </button>
          </form>

          {/* Quick Sandbox Login Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-800/60">
            <span className="flex justify-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Demo Credentials Sandbox
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 py-1.5 text-xs text-slate-300 hover:bg-slate-850 hover:border-slate-700 transition"
              >
                <Shield className="mr-1.5 h-3.5 w-3.5 text-teal-400" />
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('hr')}
                className="flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 py-1.5 text-xs text-slate-300 hover:bg-slate-850 hover:border-slate-700 transition"
              >
                <Users className="mr-1.5 h-3.5 w-3.5 text-pink-400" />
                HR Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager')}
                className="flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 py-1.5 text-xs text-slate-300 hover:bg-slate-850 hover:border-slate-700 transition"
              >
                <Users className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                Manager
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('employee')}
                className="flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 py-1.5 text-xs text-slate-300 hover:bg-slate-850 hover:border-slate-700 transition"
              >
                <Users className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
                Employee
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
