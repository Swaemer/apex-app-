import { useState, useEffect } from 'react';
import { getLeads } from '../services/leadsService';
import { useAuth } from '../context/AuthContext';
import { AppointmentsCalendar } from '../components/AppointmentsCalendar';
import type { Lead } from '../services/leadsService';

export const AppointmentsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeads()
      .then((all) => {
        // الموظف يشوف بس حجوزاته
        const filtered = isAdmin ? all : all.filter((l) => l.assigned_to === user?.name);
        setLeads(filtered);
      })
      .finally(() => setLoading(false));
  }, [user, isAdmin]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-1">حجوزات المرضى</h1>
          <p className="text-gray-500">
            {isAdmin ? 'جميع الحجوزات' : `حجوزاتي — ${user?.name}`}
          </p>
        </div>
        <AppointmentsCalendar leads={leads} />
      </div>
    </div>
  );
};
