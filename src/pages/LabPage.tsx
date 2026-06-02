import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MdRefresh, MdAdd, MdDelete } from 'react-icons/md';
import { supabase } from '../utils/supabase/supabase';
import {
  getLabCases, addLabCase, updateLabCase, deleteLabCase,
} from '../services/labService';
import type { LabCase } from '../services/labService';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['في المعمل', 'تم الاستلام', 'أعيد للمعمل'];

const statusColors: Record<string, string> = {
  'في المعمل':    'bg-yellow-50 text-yellow-700 border-yellow-200',
  'تم الاستلام':  'bg-green-50 text-green-700 border-green-200',
  'أعيد للمعمل':  'bg-red-50 text-red-700 border-red-200',
};

export const LabPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const [cases, setCases] = useState<LabCase[]>([]);
  const [filter, setFilter] = useState('الكل');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newCase, setNewCase] = useState({ patient_name: '', file_number: '', teeth_count: '', lab_name: 'معمل سكاكا' });

  const load = async () => {
    setLoading(true);
    try { setCases(await getLabCases()); }
    catch { toast.error('خطأ في تحميل البيانات'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('lab-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_cases' }, (payload) => {
        if (payload.eventType === 'INSERT')
          setCases((prev) => [payload.new as LabCase, ...prev]);
        else if (payload.eventType === 'UPDATE')
          setCases((prev) => prev.map((c) => c.id === (payload.new as LabCase).id ? payload.new as LabCase : c));
        else if (payload.eventType === 'DELETE')
          setCases((prev) => prev.filter((c) => c.id !== (payload.old as LabCase).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAdd = async () => {
    if (!newCase.patient_name.trim()) { toast.error('أدخل اسم المريض'); return; }
    try {
      await addLabCase({
        patient_name: newCase.patient_name.trim(),
        file_number: newCase.file_number.trim() || null,
        teeth_count: newCase.teeth_count ? parseInt(newCase.teeth_count) : null,
        lab_name: newCase.lab_name,
      });
      toast.success('تم إضافة الحالة');
      setNewCase({ patient_name: '', file_number: '', teeth_count: '', lab_name: 'معمل سكاكا' });
      setShowForm(false);
    } catch { toast.error('خطأ في الإضافة'); }
  };

  const handleUpdate = async (id: number, field: keyof LabCase, value: string) => {
    try {
      await updateLabCase(id, { [field]: value || null });
      setCases((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value || null } : c));
    } catch { toast.error('خطأ في التحديث'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLabCase(id);
      toast.success('تم الحذف');
    } catch { toast.error('خطأ في الحذف'); }
  };

  const filtered = filter === 'الكل' ? cases : cases.filter((c) => c.status === filter);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">استقبال المعمل</h1>
            <p className="text-gray-500">إجمالي الحالات: {filtered.length}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all"
            >
              <MdAdd className="w-5 h-5" />
              حالة جديدة
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
            >
              <MdRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>

        {/* نموذج إضافة حالة جديدة */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">إضافة حالة جديدة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المريض *</label>
                <input
                  type="text"
                  value={newCase.patient_name}
                  onChange={(e) => setNewCase((p) => ({ ...p, patient_name: e.target.value }))}
                  placeholder="أدخل اسم المريض"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">رقم الملف</label>
                <input
                  type="text"
                  value={newCase.file_number}
                  onChange={(e) => setNewCase((p) => ({ ...p, file_number: e.target.value }))}
                  placeholder="مثال: 1042"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">عدد الأسنان</label>
                <input
                  type="number"
                  value={newCase.teeth_count}
                  onChange={(e) => setNewCase((p) => ({ ...p, teeth_count: e.target.value }))}
                  placeholder="مثال: 4"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المعمل</label>
                <select
                  value={newCase.lab_name}
                  onChange={(e) => setNewCase((p) => ({ ...p, lab_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-300 transition-colors"
                >
                  <option value="معمل سكاكا">معمل سكاكا</option>
                  <option value="معمل بريدة">معمل بريدة</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:shadow-md transition-all">
                إضافة
              </button>
              <button onClick={() => { setShowForm(false); setNewCase({ patient_name: '', file_number: '', teeth_count: '', lab_name: 'معمل سكاكا' }); }} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* فلاتر الحالة */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {['الكل', ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                filter === s
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* الجدول */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">اسم المريض</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">رقم الملف</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">المعمل</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">عدد الأسنان</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">تاريخ الخروج</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">الحالة</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">تاريخ الاستلام</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">تاريخ الإعادة</th>
                  {isAdmin && <th className="px-5 py-4 text-center text-sm font-semibold text-gray-700">حذف</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">{c.patient_name}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">{c.file_number ?? '—'}</td>
                    <td className="px-5 py-4 text-sm font-medium text-blue-700">{c.lab_name}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">{c.teeth_count ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(c.sent_date)}</td>
                    <td className="px-5 py-4 text-sm">
                      <select
                        value={c.status}
                        onChange={(e) => handleUpdate(c.id, 'status', e.target.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${statusColors[c.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <input
                        type="date"
                        value={c.received_date ?? ''}
                        onChange={(e) => handleUpdate(c.id, 'received_date', e.target.value)}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:border-gray-400 bg-gray-50"
                      />
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <input
                        type="date"
                        value={c.return_date ?? ''}
                        onChange={(e) => handleUpdate(c.id, 'return_date', e.target.value)}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:border-gray-400 bg-gray-50"
                      />
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4 text-center">
                        <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700 transition-colors">
                          <MdDelete className="w-5 h-5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} className="px-6 py-12 text-center text-gray-400">
                      {loading ? 'جاري التحميل...' : 'لا توجد حالات — اضغط "حالة جديدة" للإضافة'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
