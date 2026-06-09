import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdEdit, MdContentCopy } from 'react-icons/md';
import { supabase } from '../utils/supabase/supabase';
import {
  getReturnRequests, addReturnRequest, updateReturnRequest,
  deleteReturnRequest, generateReferenceNumber,
} from '../services/returnRequestsService';
import type { ReturnRequest } from '../services/returnRequestsService';
import { getDoctors } from '../services/doctorService';
import type { Doctor } from '../services/doctorService';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['طلب جديد', 'قيد المراجعة', 'تمت الموافقة', 'تم الاسترجاع', 'مرفوض'];

const statusColors: Record<string, string> = {
  'طلب جديد':       'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  'قيد المراجعة':   'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  'تمت الموافقة':   'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  'تم الاسترجاع':   'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
  'مرفوض':          'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
};

const emptyForm = {
  patient_name: '',
  phone: '',
  file_number: '',
  invoice_number: '',
  reason: '',
  doctor_name: '',
};

const inputClass =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-gray-300 dark:focus:border-gray-500 transition-colors';

export const ReturnRequestsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState('الكل');

  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [editForm, setEditForm] = useState<Omit<ReturnRequest, 'id' | 'created_at' | 'reference_number'> & { reference_number: string }>({
    reference_number: '',
    patient_name: '',
    phone: null,
    file_number: null,
    invoice_number: null,
    reason: '',
    doctor_name: null,
    status: 'طلب جديد',
  });

  const load = async () => {
    setLoading(true);
    try { setRequests(await getReturnRequests()); }
    catch { toast.error('خطأ في تحميل البيانات'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    getDoctors().then(setDoctors).catch(() => {});

    const channel = supabase
      .channel('return-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'return_requests' }, (payload) => {
        if (payload.eventType === 'INSERT')
          setRequests((prev) => [payload.new as ReturnRequest, ...prev]);
        else if (payload.eventType === 'UPDATE')
          setRequests((prev) => prev.map((r) => r.id === (payload.new as ReturnRequest).id ? payload.new as ReturnRequest : r));
        else if (payload.eventType === 'DELETE')
          setRequests((prev) => prev.filter((r) => r.id !== (payload.old as ReturnRequest).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async () => {
    if (!form.patient_name.trim()) { toast.error('أدخل اسم الراجع'); return; }
    if (!form.reason.trim()) { toast.error('أدخل سبب الاسترجاع'); return; }
    try {
      await addReturnRequest({
        reference_number: generateReferenceNumber(),
        patient_name: form.patient_name.trim(),
        phone: form.phone.trim() || null,
        file_number: form.file_number.trim() || null,
        invoice_number: form.invoice_number.trim() || null,
        reason: form.reason.trim(),
        doctor_name: form.doctor_name || null,
        status: 'طلب جديد',
      });
      toast.success('تم إضافة الطلب');
      setForm(emptyForm);
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('addReturnRequest error:', err);
      toast.error(`خطأ في إضافة الطلب: ${msg}`);
    }
  };

  const openDetail = (r: ReturnRequest) => {
    setSelectedRequest(r);
    setEditForm({
      reference_number: r.reference_number,
      patient_name: r.patient_name,
      phone: r.phone,
      file_number: r.file_number,
      invoice_number: r.invoice_number,
      reason: r.reason,
      doctor_name: r.doctor_name,
      status: r.status,
    });
  };

  const handleUpdate = async () => {
    if (!selectedRequest) return;
    if (!editForm.patient_name.trim()) { toast.error('أدخل اسم الراجع'); return; }
    if (!editForm.reason.trim()) { toast.error('أدخل سبب الاسترجاع'); return; }
    try {
      const statusChanged = editForm.status !== selectedRequest.status;
      const newStatusChangedAt = statusChanged ? new Date().toISOString() : selectedRequest.status_changed_at;
      await updateReturnRequest(selectedRequest.id, {
        patient_name: editForm.patient_name.trim(),
        phone: editForm.phone?.trim() || null,
        file_number: editForm.file_number?.trim() || null,
        invoice_number: editForm.invoice_number?.trim() || null,
        reason: editForm.reason.trim(),
        doctor_name: editForm.doctor_name || null,
        status: editForm.status,
      }, selectedRequest.status);
      setRequests((prev) => prev.map((r) => r.id === selectedRequest.id ? { ...r, ...editForm, status_changed_at: newStatusChangedAt ?? null } : r));
      toast.success('تم تحديث الطلب');
      setSelectedRequest(null);
    } catch { toast.error('خطأ في التحديث'); }
  };

  const daysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const buildWhatsAppMessage = (r: ReturnRequest) => {
    const messages: Record<string, string[]> = {
      'طلب جديد': [
        `السلام عليكم ${r.patient_name}،`,
        ``,
        `تم استلام طلب الاسترجاع الخاص بكم برقم ${r.reference_number} وهو قيد المعالجة.`,
        `سيتم التواصل معكم قريباً.`,
      ],
      'قيد المراجعة': [
        `السلام عليكم ${r.patient_name}،`,
        ``,
        `طلب الاسترجاع رقم ${r.reference_number} يتم مراجعته حالياً من قِبل الفريق المختص.`,
        `سنُعلمكم بالنتيجة في أقرب وقت.`,
      ],
      'تمت الموافقة': [
        `السلام عليكم ${r.patient_name}،`,
        ``,
        `يسعدنا إبلاغكم بالموافقة على طلب الاسترجاع رقم ${r.reference_number}.`,
        `سيتم التواصل معكم لإتمام الإجراءات.`,
      ],
      'تم الاسترجاع': [
        `السلام عليكم ${r.patient_name}،`,
        ``,
        `يسعدنا إبلاغكم بأنه تم إتمام عملية الاسترجاع لطلبكم رقم ${r.reference_number} بنجاح.`,
        `شكراً لتواصلكم معنا.`,
      ],
      'مرفوض': [
        `السلام عليكم ${r.patient_name}،`,
        ``,
        `بخصوص طلب الاسترجاع رقم ${r.reference_number}، نأسف لإبلاغكم بأنه لم تتم الموافقة على الطلب.`,
        `للاستفسار يرجى التواصل معنا.`,
      ],
    };
    return (messages[r.status] ?? messages['طلب جديد']).join('\n');
  };

  const handleCopyWhatsApp = (r: ReturnRequest) => {
    navigator.clipboard.writeText(buildWhatsAppMessage(r));
    toast.success('تم نسخ الرسالة');
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteReturnRequest(id);
      setSelectedRequest(null);
      toast.success('تم الحذف');
    } catch { toast.error('خطأ في الحذف'); }
  };

  const filtered = filter === 'الكل' ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-1">طلبات الاسترجاع</h1>
            <p className="text-gray-500 dark:text-gray-400">إجمالي الطلبات: {filtered.length}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all"
            >
              <MdAdd className="w-5 h-5" />
              طلب جديد
            </button>
          )}
        </div>

        {/* Modal إضافة طلب */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowForm(false); setForm(emptyForm); }}
          >
            <div
              dir="rtl"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => { setShowForm(false); setForm(emptyForm); }}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold"
                >✕</button>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">طلب استرجاع جديد</h2>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    اسم الراجع <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.patient_name}
                    onChange={(e) => setForm((p) => ({ ...p, patient_name: e.target.value }))}
                    placeholder="الاسم الكامل"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">رقم الجوال</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="05xxxxxxxx"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">رقم الملف</label>
                    <input
                      type="text"
                      value={form.file_number}
                      onChange={(e) => setForm((p) => ({ ...p, file_number: e.target.value }))}
                      placeholder="مثال: 1042"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">رقم الفاتورة</label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))}
                    placeholder="مثال: INV-2024-001"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    سبب الاسترجاع <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="اذكر سبب طلب الاسترجاع..."
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">الطبيب المعالج</label>
                  <select
                    value={form.doctor_name}
                    onChange={(e) => setForm((p) => ({ ...p, doctor_name: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">-- اختر الطبيب --</option>
                    {doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  إضافة الطلب
                </button>
                <button
                  onClick={() => { setShowForm(false); setForm(emptyForm); }}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal تفاصيل الطلب */}
        {selectedRequest && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedRequest(null)}
          >
            <div
              dir="rtl"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold"
                >✕</button>
                <div className="flex items-center gap-2">
                  <MdEdit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">تفاصيل الطلب</h2>
                </div>
              </div>

              {/* الرقم المرجعي */}
              <div className="px-6 pt-4">
                <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg">
                  {selectedRequest.reference_number}
                </span>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    اسم الراجع <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.patient_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, patient_name: e.target.value }))}
                    className={inputClass}
                    disabled={!isAdmin}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">رقم الجوال</label>
                    <input
                      type="tel"
                      value={editForm.phone ?? ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                      className={inputClass}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">رقم الملف</label>
                    <input
                      type="text"
                      value={editForm.file_number ?? ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, file_number: e.target.value }))}
                      className={inputClass}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">رقم الفاتورة</label>
                  <input
                    type="text"
                    value={editForm.invoice_number ?? ''}
                    onChange={(e) => setEditForm((p) => ({ ...p, invoice_number: e.target.value }))}
                    className={inputClass}
                    disabled={!isAdmin}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    سبب الاسترجاع <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={editForm.reason}
                    onChange={(e) => setEditForm((p) => ({ ...p, reason: e.target.value }))}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    disabled={!isAdmin}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">الطبيب المعالج</label>
                  <select
                    value={editForm.doctor_name ?? ''}
                    onChange={(e) => setEditForm((p) => ({ ...p, doctor_name: e.target.value || null }))}
                    className={inputClass}
                    disabled={!isAdmin}
                  >
                    <option value="">-- اختر الطبيب --</option>
                    {doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">الحالة</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                    className={`${inputClass} font-semibold ${statusColors[editForm.status] ?? ''}`}
                    disabled={!isAdmin}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  تاريخ الإضافة: {new Date(selectedRequest.created_at).toLocaleDateString('ar-SA')}
                  {editForm.status === 'قيد المراجعة' && selectedRequest.status_changed_at && (
                    <span className="mr-3 text-yellow-600 dark:text-yellow-400 font-semibold">
                      · {daysSince(selectedRequest.status_changed_at) === 0 ? 'قيد المراجعة منذ اليوم' : `قيد المراجعة منذ ${daysSince(selectedRequest.status_changed_at)} يوم`}
                    </span>
                  )}
                </p>

                {/* اختصار واتساب */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">معاينة رسالة الواتساب</p>
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {buildWhatsAppMessage({ ...selectedRequest, ...editForm })}
                  </pre>
                  <button
                    onClick={() => handleCopyWhatsApp({ ...selectedRequest, ...editForm })}
                    className="mt-3 w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <MdContentCopy className="w-4 h-4" />
                    نسخ للواتساب
                  </button>
                </div>
              </div>

              {isAdmin && (
                <div className="flex gap-3 px-6 pb-6">
                  <button
                    onClick={handleUpdate}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    حفظ التعديلات
                  </button>
                  <button
                    onClick={() => handleDelete(selectedRequest.id)}
                    className="py-2.5 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-800 flex items-center gap-1.5"
                  >
                    <MdDelete className="w-4 h-4" />
                    حذف
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* فلاتر الحالة */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {['الكل', ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
                filter === s
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
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
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">الرقم المرجعي</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">اسم الراجع</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">رقم الجوال</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">رقم الملف</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">رقم الفاتورة</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">سبب الاسترجاع</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">الطبيب المعالج</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">الحالة</th>
                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg whitespace-nowrap">
                        {r.reference_number}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{r.patient_name}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.phone ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.file_number ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.invoice_number ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                      <span className="line-clamp-2">{r.reason}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.doctor_name ?? '—'}</td>
                    <td className="px-5 py-4 text-sm">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusColors[r.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {r.status}
                        </span>
                        {r.status === 'قيد المراجعة' && r.status_changed_at && (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                            {daysSince(r.status_changed_at) === 0 ? 'اليوم' : `منذ ${daysSince(r.status_changed_at)} يوم`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('ar-SA')}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-gray-400 dark:text-gray-500">
                      {loading ? 'جاري التحميل...' : 'لا توجد طلبات استرجاع'}
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
