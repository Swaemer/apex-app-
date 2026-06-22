import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete } from 'react-icons/md';
import { supabase } from '../utils/supabase/supabase';
import {
  getLabCases, addLabCase, updateLabCase, deleteLabCase,
} from '../services/labService';
import type { LabCase } from '../services/labService';
import { getMyLabPermission } from '../services/leadsService';
import { getDoctors } from '../services/doctorService';
import type { Doctor } from '../services/doctorService';
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
  const [canEdit, setCanEdit] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [cases, setCases] = useState<LabCase[]>([]);
  const [filterDoctor, setFilterDoctor] = useState('الكل');
  const [filterLab, setFilterLab] = useState('الكل');
  const [showForm, setShowForm] = useState(false);
  const [newCase, setNewCase] = useState({ patient_name: '', file_number: '', doctor_name: '', case_type: '', teeth_count: '', lab_name: 'معمل سكاكا', sent_date: '' });
  const [pending, setPending] = useState<Record<number, Partial<LabCase>>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('الكل');
  const PAGE_SIZE = 10;

  const load = async () => {
    try { setCases(await getLabCases()); }
    catch { toast.error('خطأ في تحميل البيانات'); }
  };

  useEffect(() => {
    if (user && !isAdmin) {
      getMyLabPermission(user.id).then(setCanEdit);
    }
    getDoctors().then(setDoctors).catch(() => {});
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
    if (!newCase.file_number.trim()) { toast.error('أدخل رقم الملف'); return; }
    if (!newCase.doctor_name) { toast.error('اختر الدكتور'); return; }
    if (!newCase.case_type.trim()) { toast.error('أدخل نوع الحالة'); return; }
    if (!newCase.teeth_count) { toast.error('أدخل عدد الأسنان'); return; }
    try {
      await addLabCase({
        patient_name: newCase.patient_name.trim(),
        file_number: newCase.file_number.trim(),
        doctor_name: newCase.doctor_name,
        case_type: newCase.case_type.trim(),
        teeth_count: parseInt(newCase.teeth_count),
        lab_name: newCase.lab_name,
        ...(isAdmin && newCase.sent_date ? { sent_date: newCase.sent_date } : {}),
      });
      toast.success('تم إضافة الحالة');
      setNewCase({ patient_name: '', file_number: '', doctor_name: '', case_type: '', teeth_count: '', lab_name: 'معمل سكاكا', sent_date: '' });
      setShowForm(false);
    } catch { toast.error('خطأ في الإضافة'); }
  };

  const handleChange = (id: number, field: keyof LabCase, value: string) => {
    setPending((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value || null } }));
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value || null } : c));
  };

  const handleCancelEdit = (id: number) => {
    setEditingId(null);
    setPending((prev) => { const n = { ...prev }; delete n[id]; return n; });
    load(); // أعد تحميل البيانات الأصلية
  };

  const handleSave = async (id: number) => {
    const changes = pending[id];
    if (!changes) return;
    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
      await updateLabCase(id, changes);
      setPending((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setEditingId(null);
      toast.success('تم الحفظ');
    } catch {
      toast.error('خطأ في الحفظ');
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLabCase(id);
      toast.success('تم الحذف');
    } catch { toast.error('خطأ في الحذف'); }
  };

  const filtered = cases.filter((c) => {
    if (filterDoctor !== 'الكل' && c.doctor_name !== filterDoctor) return false;
    if (filterLab !== 'الكل' && c.lab_name !== filterLab) return false;
    if (filterStatus !== 'الكل' && c.status !== filterStatus) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCases = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeDoctors = [...new Set(cases.map((c) => c.doctor_name).filter(Boolean))] as string[];

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const getRowColor = (status: string) => {
    const colors: Record<string, string> = {
      'في المعمل':   'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/10 dark:hover:bg-yellow-900/20',
      'تم الاستلام': 'bg-green-50 hover:bg-green-100 dark:bg-green-900/10 dark:hover:bg-green-900/20',
      'أعيد للمعمل': 'bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20',
    };
    return colors[status] || 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700';
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">استقبال المعمل</h1>
          {(isAdmin || canEdit) && (
            <div className="flex justify-start">
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-all"
              >
                <MdAdd className="w-5 h-5" />
                حالة جديدة
              </button>
            </div>
          )}
        </div>

        {/* Modal إضافة حالة جديدة */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowForm(false); setNewCase({ patient_name: '', file_number: '', doctor_name: '', case_type: '', teeth_count: '', lab_name: 'معمل سكاكا', sent_date: '' }); }}
          >
            <div
              dir="rtl"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* هيدر */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => { setShowForm(false); setNewCase({ patient_name: '', file_number: '', doctor_name: '', case_type: '', teeth_count: '', lab_name: 'معمل سكاكا', sent_date: '' }); }}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold"
                >✕</button>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">حالة جديدة</h2>
              </div>

              {/* حقول */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم المريض <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={newCase.patient_name}
                    onChange={(e) => setNewCase((p) => ({ ...p, patient_name: e.target.value }))}
                    placeholder="أدخل اسم المريض"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-indigo-300 transition-colors text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">رقم الملف <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={newCase.file_number}
                      onChange={(e) => setNewCase((p) => ({ ...p, file_number: e.target.value }))}
                      placeholder="مثال: 1042"
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-indigo-300 transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">عدد الأسنان <span className="text-red-400">*</span></label>
                    <input
                      type="number"
                      value={newCase.teeth_count}
                      onChange={(e) => setNewCase((p) => ({ ...p, teeth_count: e.target.value }))}
                      placeholder="مثال: 4"
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-indigo-300 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم الدكتور <span className="text-red-400">*</span></label>
                  <select
                    value={newCase.doctor_name}
                    onChange={(e) => setNewCase((p) => ({ ...p, doctor_name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-indigo-300 transition-colors text-sm"
                  >
                    <option value="">-- اختر الدكتور --</option>
                    {doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">نوع الحالة <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={newCase.case_type}
                    onChange={(e) => setNewCase((p) => ({ ...p, case_type: e.target.value }))}
                    placeholder="مثال: تركيب، جسر، تاج..."
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-indigo-300 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">المعمل</label>
                  <select
                    value={newCase.lab_name}
                    onChange={(e) => setNewCase((p) => ({ ...p, lab_name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-indigo-300 transition-colors text-sm"
                  >
                    <option value="معمل سكاكا">معمل سكاكا</option>
                    <option value="معمل بريدة">معمل بريدة</option>
                  </select>
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      تاريخ الإرسال
                      <span className="text-xs text-gray-400 font-normal mr-1">(اتركه فارغاً للتاريخ الحالي)</span>
                    </label>
                    <input
                      type="date"
                      value={newCase.sent_date}
                      onChange={(e) => setNewCase((p) => ({ ...p, sent_date: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-indigo-300 transition-colors text-sm"
                    />
                  </div>
                )}
              </div>

              {/* أزرار */}
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  إضافة الحالة
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewCase({ patient_name: '', file_number: '', doctor_name: '', case_type: '', teeth_count: '', lab_name: 'معمل سكاكا', sent_date: '' }); }}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* الفلاتر */}
        <div className="flex flex-wrap gap-6 mb-6">
          {/* فلتر الحالة */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">الحالة</p>
            <div className="flex gap-2 flex-wrap">
              {['الكل', ...STATUSES].map((s) => (
                <button key={s} onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                  className={`px-5 py-2 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
                    filterStatus === s
                      ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* فلتر الطبيب */}
          {activeDoctors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">الطبيب</p>
              <div className="flex gap-2 flex-wrap">
                {['الكل', ...activeDoctors].map((d) => (
                  <button key={d} onClick={() => { setFilterDoctor(d); setCurrentPage(1); }}
                    className={`px-5 py-2 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
                      filterDoctor === d
                        ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* فلتر المعمل */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">المعمل</p>
            <div className="flex gap-2 flex-wrap">
              {['الكل', 'معمل سكاكا', 'معمل بريدة'].map((l) => (
                <button key={l} onClick={() => { setFilterLab(l); setCurrentPage(1); }}
                  className={`px-5 py-2 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
                    filterLab === l
                      ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">إجمالي الحالات: {filtered.length}</p>

        {/* الجدول */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">المريض</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">رقم الملف</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">الدكتور</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">نوع الحالة</th>
                  <th className="px-5 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">الأسنان</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">المعمل</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">الحالة</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">تاريخ الخروج</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">الاستلام</th>
                  {isAdmin && <th className="px-5 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">حذف</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? pagedCases.map((c) => (
                  <tr key={c.id} onClick={() => (isAdmin || canEdit) && setEditingId(c.id)}
                    className={`border-b border-gray-100 dark:border-gray-700 transition-colors ${(isAdmin || canEdit) ? 'cursor-pointer' : ''} ${getRowColor(c.status)}`}>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.patient_name}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{c.file_number ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{c.doctor_name ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{c.case_type ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-center font-bold text-gray-900 dark:text-white">{c.teeth_count ?? '—'}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-700">{c.lab_name}</span>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusColors[c.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(c.sent_date)}</td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{c.received_date ? formatDate(c.received_date) : '—'}</td>
                    {isAdmin && (
                      <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 transition-colors">
                          <MdDelete className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 9} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                      {filtered.length === 0 ? 'لا توجد حالات' : 'جاري التحميل...'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ترقيم الصفحات */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all"
            >
              السابق
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              صفحة {safePage} من {totalPages}
              <span className="text-gray-400 dark:text-gray-500 mx-2">·</span>
              {filtered.length} حالة
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all"
            >
              التالي
            </button>
          </div>
        )}

        {/* مودال التعديل */}
        {editingId !== null && (() => {
          const c = cases.find((x) => x.id === editingId);
          if (!c) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => handleCancelEdit(editingId)}>
              <div dir="rtl" className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                  <button onClick={() => handleCancelEdit(editingId)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">تعديل الحالة</h2>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">اسم المريض</label>
                    <input type="text" value={c.patient_name} onChange={(e) => handleChange(c.id, 'patient_name', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">رقم الملف</label>
                      <input type="text" value={c.file_number ?? ''} onChange={(e) => handleChange(c.id, 'file_number', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">عدد الأسنان</label>
                      <input type="number" value={c.teeth_count ?? ''} onChange={(e) => handleChange(c.id, 'teeth_count', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">الدكتور</label>
                    <select value={c.doctor_name ?? ''} onChange={(e) => handleChange(c.id, 'doctor_name', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors">
                      <option value="">— اختر الدكتور —</option>
                      {doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">نوع الحالة</label>
                    <input type="text" value={c.case_type ?? ''} onChange={(e) => handleChange(c.id, 'case_type', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">المعمل</label>
                      <select value={c.lab_name} onChange={(e) => handleChange(c.id, 'lab_name', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors">
                        <option value="معمل سكاكا">معمل سكاكا</option>
                        <option value="معمل بريدة">معمل بريدة</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">الحالة</label>
                      <select value={c.status} onChange={(e) => handleChange(c.id, 'status', e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer ${statusColors[c.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">تاريخ الخروج</label>
                      <input type="date" value={c.sent_date ? c.sent_date.split('T')[0] : ''} onChange={(e) => handleChange(c.id, 'sent_date', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">تاريخ الاستلام</label>
                      <input type="date" value={c.received_date ?? ''} onChange={(e) => handleChange(c.id, 'received_date', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">تاريخ الإعادة</label>
                      <input type="date" value={c.return_date ?? ''} onChange={(e) => handleChange(c.id, 'return_date', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:border-gray-300 transition-colors" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                  <button onClick={() => handleSave(c.id)} disabled={saving[c.id]}
                    className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors">
                    {saving[c.id] ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </button>
                  <button onClick={() => handleCancelEdit(editingId)}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
};
