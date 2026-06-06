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
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

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
    try {
      await addLabCase({
        patient_name: newCase.patient_name.trim(),
        file_number: newCase.file_number.trim() || null,
        doctor_name: newCase.doctor_name || null,
        case_type: newCase.case_type.trim() || null,
        teeth_count: newCase.teeth_count ? parseInt(newCase.teeth_count) : null,
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

  const handleDragDrop = async (newStatus: string, caseId: number) => {
    const c = cases.find((x) => x.id === caseId);
    if (!c || c.status === newStatus) return;

    const today = new Date().toISOString().split('T')[0];
    const update: Partial<LabCase> = { status: newStatus };
    if (newStatus === 'تم الاستلام') update.received_date = today;
    else if (newStatus === 'أعيد للمعمل') update.return_date = today;

    setCases((prev) => prev.map((x) => x.id === caseId ? { ...x, ...update } : x));
    try {
      await updateLabCase(caseId, update);
      toast.success('تم تغيير الحالة');
    } catch {
      toast.error('خطأ في تحديث الحالة');
      load();
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
    return true;
  });

  const activeDoctors = [...new Set(cases.map((c) => c.doctor_name).filter(Boolean))] as string[];

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            {(isAdmin || canEdit) && (
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-all"
              >
                <MdAdd className="w-5 h-5" />
                حالة جديدة
              </button>
            )}
          </div>
          <h1 className="text-4xl font-bold text-gray-900 text-center flex-1">استقبال المعمل</h1>
          <div className="opacity-0 pointer-events-none">
            <button className="px-6 py-3">placeholder</button>
          </div>
        </div>

        {/* Modal إضافة حالة جديدة */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowForm(false); setNewCase({ patient_name: '', file_number: '', doctor_name: '', case_type: '', teeth_count: '', lab_name: 'معمل سكاكا', sent_date: '' }); }}
          >
            <div
              dir="rtl"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* هيدر */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <button
                  onClick={() => { setShowForm(false); setNewCase({ patient_name: '', file_number: '', doctor_name: '', case_type: '', teeth_count: '', lab_name: 'معمل سكاكا', sent_date: '' }); }}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >✕</button>
                <h2 className="text-lg font-bold text-gray-900">حالة جديدة</h2>
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
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-indigo-300 transition-colors text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">رقم الملف</label>
                    <input
                      type="text"
                      value={newCase.file_number}
                      onChange={(e) => setNewCase((p) => ({ ...p, file_number: e.target.value }))}
                      placeholder="مثال: 1042"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-indigo-300 transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">عدد الأسنان</label>
                    <input
                      type="number"
                      value={newCase.teeth_count}
                      onChange={(e) => setNewCase((p) => ({ ...p, teeth_count: e.target.value }))}
                      placeholder="مثال: 4"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-indigo-300 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم الدكتور</label>
                  <select
                    value={newCase.doctor_name}
                    onChange={(e) => setNewCase((p) => ({ ...p, doctor_name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-indigo-300 transition-colors text-sm"
                  >
                    <option value="">-- اختر الدكتور --</option>
                    {doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">نوع الحالة</label>
                  <input
                    type="text"
                    value={newCase.case_type}
                    onChange={(e) => setNewCase((p) => ({ ...p, case_type: e.target.value }))}
                    placeholder="مثال: تركيب، جسر، تاج..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-indigo-300 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">المعمل</label>
                  <select
                    value={newCase.lab_name}
                    onChange={(e) => setNewCase((p) => ({ ...p, lab_name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-indigo-300 transition-colors text-sm"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-indigo-300 transition-colors text-sm"
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
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* الفلاتر */}
        <div className="flex flex-wrap gap-6 mb-6">
          {/* فلتر الطبيب */}
          {activeDoctors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">الطبيب</p>
              <div className="flex gap-2 flex-wrap">
                {['الكل', ...activeDoctors].map((d) => (
                  <button key={d} onClick={() => setFilterDoctor(d)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                      filterDoctor === d
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* فلتر المعمل */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">المعمل</p>
            <div className="flex gap-2 flex-wrap">
              {['الكل', 'معمل سكاكا', 'معمل بريدة'].map((l) => (
                <button key={l} onClick={() => setFilterLab(l)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    filterLab === l
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-gray-500 text-sm mb-4">إجمالي الحالات: {filtered.length}</p>

        {/* Kanban */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STATUSES.map((status) => {
            const colCases = filtered.filter((c) => c.status === status);
            const colStyle = {
              'في المعمل':   { header: 'bg-yellow-100 border-yellow-200', title: 'text-yellow-800', count: 'bg-yellow-200 text-yellow-700', col: 'border-yellow-200 bg-yellow-50/40' },
              'تم الاستلام': { header: 'bg-green-100 border-green-200',  title: 'text-green-800',  count: 'bg-green-200 text-green-700',  col: 'border-green-200 bg-green-50/40'  },
              'أعيد للمعمل': { header: 'bg-red-100 border-red-200',      title: 'text-red-800',    count: 'bg-red-200 text-red-700',      col: 'border-red-200 bg-red-50/40'      },
            }[status]!;

            return (
              <div
                key={status}
                className={`rounded-2xl border overflow-hidden flex flex-col transition-all ${colStyle.col} ${dragOverStatus === status ? 'ring-2 ring-indigo-400 scale-[1.01]' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStatus(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = parseInt(e.dataTransfer.getData('text/plain'));
                  if (id) handleDragDrop(status, id);
                  setDraggingId(null);
                  setDragOverStatus(null);
                }}
              >
                {/* عنوان العمود */}
                <div className={`flex items-center justify-between px-4 py-3 border-b ${colStyle.header}`}>
                  <span className={`font-bold text-sm ${colStyle.title}`}>{status}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colStyle.count}`}>{colCases.length}</span>
                </div>

                {/* البطاقات */}
                <div className="flex-1 p-3 space-y-3 min-h-[160px]">
                  {colCases.length === 0 ? (
                    <p className="text-center text-gray-400 text-xs pt-8">لا توجد حالات</p>
                  ) : colCases.map((c) => (
                    <div
                      key={c.id}
                      draggable={!!(isAdmin || canEdit) && editingId !== c.id}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(c.id)); setDraggingId(c.id); }}
                      onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                      className={`bg-white rounded-xl border shadow-sm p-3 transition-all
                        ${editingId === c.id ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100 hover:shadow-md'}
                        ${(isAdmin || canEdit) && editingId !== c.id ? 'cursor-grab active:cursor-grabbing' : ''}
                        ${draggingId === c.id ? 'opacity-40 scale-95' : ''}
                      `}
                    >

                      {editingId === c.id ? (
                        /* وضع التعديل */
                        <div className="space-y-2">
                          <input type="text" value={c.patient_name} onChange={(e) => handleChange(c.id, 'patient_name', e.target.value)}
                            placeholder="اسم المريض"
                            className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white font-medium" />
                          <input type="text" value={c.file_number ?? ''} onChange={(e) => handleChange(c.id, 'file_number', e.target.value)}
                            placeholder="رقم الملف"
                            className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white" />
                          <select value={c.doctor_name ?? ''} onChange={(e) => handleChange(c.id, 'doctor_name', e.target.value)}
                            className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white">
                            <option value="">— الدكتور —</option>
                            {doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                          </select>
                          <input type="text" value={c.case_type ?? ''} onChange={(e) => handleChange(c.id, 'case_type', e.target.value)}
                            placeholder="نوع الحالة"
                            className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white" />
                          <div className="grid grid-cols-2 gap-2">
                            <select value={c.lab_name} onChange={(e) => handleChange(c.id, 'lab_name', e.target.value)}
                              className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white">
                              <option value="معمل سكاكا">معمل سكاكا</option>
                              <option value="معمل بريدة">معمل بريدة</option>
                            </select>
                            <input type="number" value={c.teeth_count ?? ''} onChange={(e) => handleChange(c.id, 'teeth_count', e.target.value)}
                              placeholder="عدد الأسنان"
                              className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white" />
                          </div>
                          <select value={c.status} onChange={(e) => handleChange(c.id, 'status', e.target.value)}
                            className={`w-full px-2 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${statusColors[c.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">تاريخ الخروج</p>
                              <input type="date" value={c.sent_date ? c.sent_date.split('T')[0] : ''} onChange={(e) => handleChange(c.id, 'sent_date', e.target.value)}
                                className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">تاريخ الاستلام</p>
                              <input type="date" value={c.received_date ?? ''} onChange={(e) => handleChange(c.id, 'received_date', e.target.value)}
                                className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">تاريخ الإعادة</p>
                            <input type="date" value={c.return_date ?? ''} onChange={(e) => handleChange(c.id, 'return_date', e.target.value)}
                              className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs focus:outline-none bg-white" />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => handleSave(c.id)} disabled={saving[c.id]}
                              className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                              {saving[c.id] ? '...' : 'حفظ'}
                            </button>
                            <button onClick={() => handleCancelEdit(c.id)}
                              className="flex-1 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* وضع العرض */
                        <>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{c.patient_name}</p>
                              {c.file_number && <p className="text-xs text-gray-400 mt-0.5">ملف: {c.file_number}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {(isAdmin || canEdit) && (
                                <button onClick={() => setEditingId(c.id)}
                                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                                  تعديل
                                </button>
                              )}
                              {isAdmin && (
                                <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                  <MdDelete className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            {c.doctor_name && (
                              <p className="text-xs text-gray-600">
                                <span className="text-gray-400">الدكتور: </span>{c.doctor_name}
                              </p>
                            )}
                            {c.case_type && (
                              <p className="text-xs text-gray-600">
                                <span className="text-gray-400">نوع الحالة: </span>{c.case_type}
                              </p>
                            )}
                            {c.teeth_count && (
                              <p className="text-xs text-gray-600">
                                <span className="text-gray-400">عدد الأسنان: </span>{c.teeth_count}
                              </p>
                            )}
                          </div>

                          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-1">
                            <div className="text-xs text-gray-400 space-y-0.5">
                              {c.sent_date && <p>خروج: {formatDate(c.sent_date)}</p>}
                              {c.received_date && <p>استلام: {formatDate(c.received_date)}</p>}
                              {c.return_date && <p>إعادة: {formatDate(c.return_date)}</p>}
                            </div>
                            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">{c.lab_name}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
