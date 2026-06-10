import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MdAdd, MdRefresh, MdDelete } from 'react-icons/md';
import { supabase } from '../utils/supabase/supabase';
import { addLeaveRequest, getLeaveRequests, deleteLeaveRequest, updateLeaveStatus } from '../services/leaveService';
import type { LeaveRequest } from '../services/leaveService';
import { getDoctors } from '../services/doctorService';
import type { Doctor } from '../services/doctorService';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['جديد', 'موافق عليه', 'مرفوض'];

const statusColors: Record<string, string> = {
  'جديد':        'bg-blue-50 text-blue-700 border-blue-200',
  'موافق عليه':  'bg-green-50 text-green-700 border-green-200',
  'مرفوض':       'bg-red-50 text-red-700 border-red-200',
};

const emptyForm = {
  patient_name: '', phone: '', birth_day: '', birth_month: '', birth_year: '', id_number: '',
  days_count: '', doctor_name: '', same_day: false,
};

export const LeavePage = () => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [canSubmit, setCanSubmit] = useState(false);

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState('الكل');

  const load = async () => {
    setLoading(true);
    try { setRequests(await getLeaveRequests()); }
    catch { toast.error('خطأ في تحميل البيانات'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isAdmin) {
      setCanSubmit(true);
    } else if (user) {
      supabase.from('profiles').select('can_submit_leave').eq('id', user.id).single()
        .then(({ data }) => setCanSubmit(data?.can_submit_leave ?? false));
    }
    load();
    getDoctors().then(setDoctors).catch(() => {});

    const channel = supabase
      .channel('leave-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, (payload) => {
        if (payload.eventType === 'INSERT')
          setRequests((prev) => [payload.new as LeaveRequest, ...prev]);
        else if (payload.eventType === 'UPDATE')
          setRequests((prev) => prev.map((r) => r.id === (payload.new as LeaveRequest).id ? payload.new as LeaveRequest : r));
        else if (payload.eventType === 'DELETE')
          setRequests((prev) => prev.filter((r) => r.id !== (payload.old as LeaveRequest).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async () => {
    if (!form.patient_name.trim()) { toast.error('أدخل اسم المريض'); return; }
    if (!form.days_count) { toast.error('أدخل عدد الأيام'); return; }
    if (!form.doctor_name) { toast.error('اختر الطبيب المعالج'); return; }
    try {
      const birth_date = (form.birth_day && form.birth_month && form.birth_year)
        ? `${form.birth_year.padStart(4, '0')}-${form.birth_month.padStart(2, '0')}-${form.birth_day.padStart(2, '0')}`
        : null;
      await addLeaveRequest({
        patient_name: form.patient_name.trim(),
        phone: form.phone.trim() || null,
        birth_date,
        id_number: form.id_number.trim() || null,
        days_count: parseInt(form.days_count),
        doctor_name: form.doctor_name,
        same_day: form.same_day,
      });
      toast.success('تم إرسال الطلب');
      setForm(emptyForm);
      setShowForm(false);
    } catch { toast.error('خطأ في إرسال الطلب'); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateLeaveStatus(id, status);
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      toast.success('تم تحديث الحالة');
    } catch { toast.error('خطأ في التحديث'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLeaveRequest(id);
      toast.success('تم الحذف');
    } catch { toast.error('خطأ في الحذف'); }
  };

  const filtered = filter === 'الكل' ? requests : requests.filter((r) => r.status === filter);

  const inputClass = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-gray-300 dark:focus:border-gray-500 transition-colors';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-1">طلبات الإجازة</h1>
            <p className="text-gray-500 dark:text-gray-400">إجمالي الطلبات: {filtered.length}</p>
          </div>
          <div className="flex gap-3">
            {canSubmit && (
              <button onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all">
                <MdAdd className="w-5 h-5" />
                طلب جديد
              </button>
            )}
            <button onClick={load} disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50">
              <MdRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>

        {/* رسالة غير مخوّل */}
        {!canSubmit && !isAdmin && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl p-5 mb-6 text-right">
            <p className="text-yellow-800 dark:text-yellow-300 font-medium">ليس لديك صلاحية إضافة طلبات — تواصل مع المدير لتفعيل الصلاحية.</p>
          </div>
        )}

        {/* نموذج الطلب */}
        {showForm && canSubmit && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">طلب إجازة مرضية جديد</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم المريض *</label>
                <input type="text" value={form.patient_name} onChange={(e) => setForm((p) => ({ ...p, patient_name: e.target.value }))}
                  placeholder="الاسم الكامل" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">رقم الجوال</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="05xxxxxxxx" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">رقم الهوية</label>
                <input type="text" value={form.id_number} onChange={(e) => setForm((p) => ({ ...p, id_number: e.target.value }))}
                  placeholder="1xxxxxxxxx" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">تاريخ الميلاد</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" min="1" max="31" value={form.birth_day}
                    onChange={(e) => setForm((p) => ({ ...p, birth_day: e.target.value }))}
                    placeholder="اليوم" className={inputClass} />
                  <input type="number" min="1" max="12" value={form.birth_month}
                    onChange={(e) => setForm((p) => ({ ...p, birth_month: e.target.value }))}
                    placeholder="الشهر" className={inputClass} />
                  <input type="number" min="1900" max="2100" value={form.birth_year}
                    onChange={(e) => setForm((p) => ({ ...p, birth_year: e.target.value }))}
                    placeholder="السنة" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">عدد الأيام المطلوبة *</label>
                <input type="number" min="1" value={form.days_count} onChange={(e) => setForm((p) => ({ ...p, days_count: e.target.value }))}
                  placeholder="مثال: 3" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الطبيب المعالج *</label>
                <select value={form.doctor_name} onChange={(e) => setForm((p) => ({ ...p, doctor_name: e.target.value }))}
                  className={inputClass}>
                  <option value="">-- اختر الطبيب --</option>
                  {doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={form.same_day}
                onChange={(e) => setForm((p) => ({ ...p, same_day: e.target.checked }))}
                className="w-5 h-5 accent-purple-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">الإجازة بنفس اليوم</span>
            </label>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSubmit}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:shadow-md transition-all">
                إرسال الطلب
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm); }}
                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* فلاتر */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {['الكل', ...STATUSES].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                filter === s
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* الجدول */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">اسم المريض</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">رقم الهوية</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">الجوال</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">تاريخ الميلاد</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">عدد الأيام</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">الطبيب</th>
                  <th className="px-5 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">نفس اليوم</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">الحالة</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">التاريخ</th>
                  {isAdmin && <th className="px-5 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">حذف</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{r.patient_name}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{r.id_number ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{r.phone ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {r.birth_date ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-center font-bold text-gray-900 dark:text-white">{r.days_count}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{r.doctor_name}</td>
                    <td className="px-5 py-4 text-center">
                      {r.same_day ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-bold">✓</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {isAdmin ? (
                        <select value={r.status} onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${statusColors[r.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusColors[r.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {r.status}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4 text-center">
                        <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 transition-colors">
                          <MdDelete className="w-5 h-5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 9} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                      {loading ? 'جاري التحميل...' : 'لا توجد طلبات'}
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
