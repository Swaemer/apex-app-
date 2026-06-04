import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../utils/supabase/supabase';
import { getEmployees } from '../services/leadsService';
import type { Profile } from '../services/leadsService';

interface Permission {
  key: keyof Pick<Profile, 'can_edit_lab' | 'can_submit_leave' | 'can_view_all_appointments'>;
  label: string;
  description: string;
  color: string;
}

const PERMISSIONS: Permission[] = [
  {
    key: 'can_edit_lab',
    label: 'تعديل المعمل',
    description: 'إضافة وتعديل حالات المعمل',
    color: 'bg-blue-500',
  },
  {
    key: 'can_submit_leave',
    label: 'طلبات الإجازة',
    description: 'رفع طلبات إجازة المرضى',
    color: 'bg-purple-500',
  },
  {
    key: 'can_view_all_appointments',
    label: 'كل الحجوزات',
    description: 'عرض تقويم جميع الحجوزات',
    color: 'bg-green-500',
  },
];

export const PermissionsPage = () => {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getEmployees()
      .then(setEmployees)
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (emp: Profile, key: Permission['key']) => {
    const savingKey = `${emp.id}-${key}`;
    setSaving(savingKey);
    try {
      const newVal = !emp[key];
      const { error } = await supabase
        .from('profiles')
        .update({ [key]: newVal })
        .eq('id', emp.id);
      if (error) throw error;
      setEmployees((prev) =>
        prev.map((e) => e.id === emp.id ? { ...e, [key]: newVal } : e)
      );
      toast.success('تم التحديث');
    } catch {
      toast.error('خطأ في التحديث');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-1">الصلاحيات</h1>
          <p className="text-gray-500">تحكم بصلاحيات كل موظف</p>
        </div>

        {employees.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
            <p className="text-gray-400">لا يوجد موظفون مسجّلون</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الموظف</th>
                  {PERMISSIONS.map((p) => (
                    <th key={p.key} className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      <span className={`inline-block w-2 h-2 rounded-full ${p.color} ml-1.5`} />
                      {p.label}
                      <p className="text-xs font-normal text-gray-400 mt-0.5">{p.description}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{emp.name}</span>
                      </div>
                    </td>
                    {PERMISSIONS.map((p) => {
                      const isOn = emp[p.key];
                      const isSaving = saving === `${emp.id}-${p.key}`;
                      return (
                        <td key={p.key} className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggle(emp, p.key)}
                            disabled={!!saving}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                              isOn ? p.color : 'bg-gray-200'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              isOn ? '-translate-x-6' : '-translate-x-1'
                            } ${isSaving ? 'animate-pulse' : ''}`} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ملخص */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex gap-6">
                {PERMISSIONS.map((p) => {
                  const count = employees.filter((e) => e[p.key]).length;
                  return (
                    <div key={p.key} className="flex items-center gap-2 text-sm text-gray-500">
                      <span className={`w-2 h-2 rounded-full ${p.color}`} />
                      {p.label}: <span className="font-bold text-gray-700">{count}/{employees.length}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
