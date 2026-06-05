import { useState, useEffect } from 'react';
import { getEmployees } from '../services/leadsService';
import { useAuth } from '../context/AuthContext';
import { LeadsManagement } from '../components/LeadsManagement';

const BASE_CONFIG = {
  sheetsUrl: '/api/sheets',
  columns: [
    { columnIndex: 0, label: 'الاسم', field: 'name' as const },
    { columnIndex: 1, label: 'الهاتف', field: 'phone' as const },
    { columnIndex: 2, label: 'الخدمة المطلوبة', field: 'service' as const },
    { columnIndex: 3, label: 'المدينة', field: 'city' as const },
  ],
  statuses: ['جديد', 'متابعة', 'تم حجز الموعد', 'عميل بالفعل', 'لا يرغب'],
  idColumnIndex: 5, // عمود F في الشيت (0-based)
};

export const LeadsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const userName = user?.name ?? '';
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    getEmployees()
      .then((profiles) => setEmployees(profiles.map((p, i) => ({ id: i + 1, name: p.name }))))
      .catch(() => {});
  }, []);

  if (authLoading) return null;

  const config = {
    ...BASE_CONFIG,
    distribution: {
      enabled: employees.length > 0,
      method: 'round-robin' as const,
      users: employees,
      distributeOnlyNewLeads: true,
    },
  };

  return (
    <LeadsManagement
      config={config}
      employeeName={isAdmin ? undefined : userName}
      isAdmin={isAdmin}
      employeesList={employees.map((e) => e.name)}
    />
  );
};
