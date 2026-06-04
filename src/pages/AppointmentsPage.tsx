import { useState, useEffect } from 'react';
import { getLeads } from '../services/leadsService';
import { supabase } from '../utils/supabase/supabase';
import { useAuth } from '../context/AuthContext';
import { AppointmentsCalendar } from '../components/AppointmentsCalendar';
import type { Lead } from '../services/leadsService';

export const AppointmentsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [canViewAll, setCanViewAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      let viewAll = isAdmin;

      if (!isAdmin) {
        const { data } = await supabase
          .from('profiles')
          .select('can_view_all_appointments')
          .eq('id', user.id)
          .single();
        viewAll = data?.can_view_all_appointments ?? false;
      }

      setCanViewAll(viewAll);
      const all = await getLeads();
      setLeads(viewAll ? all : all.filter((l) => l.assigned_to === user.name));
      setLoading(false);
    };

    init();
  }, [user, isAdmin]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-1">حجوزات المرضى</h1>
          <p className="text-gray-500">
            {canViewAll ? 'جميع الحجوزات' : `حجوزاتي — ${user?.name}`}
          </p>
        </div>
        <AppointmentsCalendar leads={leads} />
      </div>
    </div>
  );
};
