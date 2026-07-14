'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/axios';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, isWeekend, getDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Gift, Calendar, Sun, Landmark } from 'lucide-react';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch all leaves in organization
  const { data: leaves } = useQuery({
    queryKey: ['orgLeaves'],
    queryFn: async () => {
      const res = await api.get('/leaves/history');
      return res.data;
    }
  });

  // Fetch holidays
  const { data: holidays } = useQuery({
    queryKey: ['holidaysList'],
    queryFn: async () => {
      const res = await api.get('/settings/holidays');
      return res.data;
    }
  });

  // Fetch employees (for simulated birthdays - e.g. mock birthdays based on joiningDate or email)
  const { data: employees } = useQuery({
    queryKey: ['calendarEmployees'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data;
    }
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Calendar dates generation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add padding days at start
  const startDayOfWeek = getDay(monthStart); // 0 = Sun, 1 = Mon...
  const padDays = Array(startDayOfWeek).fill(null);

  const gridDays = [...padDays, ...daysInMonth];

  // Lookup helpers
  const getHolidaysForDay = (date: Date) => {
    if (!holidays) return [];
    return holidays.filter((h: any) => isSameDay(new Date(h.date), date));
  };

  const getLeavesForDay = (date: Date) => {
    if (!leaves) return [];
    return leaves.filter((l: any) => {
      if (l.status !== 'Approved') return false;
      return l.datesApplied.some((dStr: string) => isSameDay(new Date(dStr), date));
    });
  };

  const getBirthdaysForDay = (date: Date) => {
    if (!employees) return [];
    // Mock birthday checking: we check if user joiningDate match (day and month)
    return employees.filter((emp: any) => {
      const bDate = new Date(emp.joiningDate || new Date());
      return bDate.getDate() === date.getDate() && bDate.getMonth() === date.getMonth();
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        
        {/* Header and navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Organizational Calendar</h1>
            <p className="text-xs text-muted-foreground mt-1">Cross-team leaves, national holidays, and anniversaries.</p>
          </div>
          
          <div className="flex items-center space-x-3.5 bg-card border border-border p-2 rounded-2xl shadow-sm">
            <button
              onClick={prevMonth}
              className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs font-bold w-36 text-center select-none uppercase tracking-wider">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={nextMonth}
              className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider border-b border-border/40 pb-4">
          <div className="flex items-center space-x-2">
            <div className="h-3 w-6 rounded bg-primary/20 border border-primary/40" />
            <span>Colleague Leave</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-3 w-6 rounded bg-success/20 border border-success/40" />
            <span>Company Holiday</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-3 w-6 rounded bg-pink-500/20 border border-pink-500/40" />
            <span>Birthday Anniversary</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center font-bold text-[10px] py-3 text-muted-foreground uppercase tracking-widest">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
            {gridDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-32 bg-muted/10" />;
              }

              const date = new Date(day);
              const isWeekendDay = isWeekend(date);
              const dayHolidays = getHolidaysForDay(date);
              const dayLeaves = getLeavesForDay(date);
              const dayBirthdays = getBirthdaysForDay(date);

              return (
                <div
                  key={day.toString()}
                  className={`h-32 p-2.5 flex flex-col justify-between hover:bg-muted/10 transition ${
                    isWeekendDay ? 'bg-muted/20 text-muted-foreground' : 'bg-transparent'
                  }`}
                >
                  {/* Day number */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold">{format(date, 'd')}</span>
                  </div>

                  {/* List items */}
                  <div className="flex-1 mt-1.5 space-y-1.5 overflow-y-auto select-none">
                    {/* Holiday */}
                    {dayHolidays.map((h: any) => (
                      <div
                        key={h._id}
                        className="flex items-center space-x-1 p-1 rounded bg-success/15 border border-success/30 text-[9px] font-bold text-success truncate"
                        title={h.name}
                      >
                        <Landmark className="h-3 w-3 shrink-0" />
                        <span>{h.name}</span>
                      </div>
                    ))}

                    {/* Leaves */}
                    {dayLeaves.map((l: any) => (
                      <div
                        key={l._id}
                        className="flex items-center space-x-1 p-1 rounded bg-primary/15 border border-primary/30 text-[9px] font-bold text-primary truncate"
                        title={`${l.employee.name} on ${l.leaveType.code}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span>{l.employee.name.split(' ')[0]}</span>
                      </div>
                    ))}

                    {/* Birthdays */}
                    {dayBirthdays.map((emp: any) => (
                      <div
                        key={emp._id}
                        className="flex items-center space-x-1 p-1 rounded bg-pink-500/15 border border-pink-500/30 text-[9px] font-bold text-pink-600 truncate"
                        title={`${emp.name}'s Work Anniversary`}
                      >
                        <Gift className="h-3 w-3 shrink-0 text-pink-500" />
                        <span>{emp.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
