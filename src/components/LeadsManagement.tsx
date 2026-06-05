import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MdRefresh } from 'react-icons/md';
import { getLeads, getLeadPhoneIdMap, insertLeads, deleteLeadsByIds, updateLeadStatus, updateLeadNotes, updateLeadAssignment, updateLeadAppointment, deleteLead } from '../services/leadsService';
import type { Lead, NewLead } from '../services/leadsService';
import { supabase } from '../utils/supabase/supabase';

interface ColumnConfig {
  columnIndex: number;
  label: string;
  field: 'name' | 'phone' | 'status' | 'service';
}

interface User {
  id: number;
  name: string;
}

interface DistributionConfig {
  enabled: boolean;
  method: 'round-robin' | 'sequential';
  users: User[];
  distributeOnlyNewLeads?: boolean;
}

interface LeadsManagementConfig {
  sheetsUrl: string;
  columns: ColumnConfig[];
  statuses: string[];
  distribution?: DistributionConfig;
  idColumnIndex?: number; // عمود الشيت (0-based) اللي نكتب فيه Supabase ID
}

interface LeadsManagementProps {
  config: LeadsManagementConfig;
  employeeName?: string;
  isAdmin?: boolean;
  employeesList?: string[];
}

export const LeadsManagement = ({ config, employeeName, isAdmin = false, employeesList = [] }: LeadsManagementProps) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>('الكل');
  const [filterUser, setFilterUser] = useState<string>('الكل');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savedNote, setSavedNote] = useState<number | null>(null);
  const [noteValues, setNoteValues] = useState<Record<number, string>>({});
  const [pendingAppointment, setPendingAppointment] = useState<Record<number, { date: string; hour: string }>>({});
  const [showDistribute, setShowDistribute] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [distributing, setDistributing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDistributeSelected, setShowDistributeSelected] = useState(false);
  const [selectedDistEmployees, setSelectedDistEmployees] = useState<string[]>([]);
  const [distributingSelected, setDistributingSelected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 250;

  const assignUser = (index: number, total: number): string => {
    if (!config.distribution?.enabled || !config.distribution.users.length)
      return 'لم يتم التعيين';
    const users = config.distribution.users;
    if (config.distribution.method === 'round-robin') {
      return users[index % users.length].name;
    }
    const perUser = Math.ceil(total / users.length);
    return users[Math.min(Math.floor(index / perUser), users.length - 1)].name;
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      const all = await getLeads();
      // الموظف يشوف بس leads باسمه
      setLeads(employeeName ? all.filter((l) => l.assigned_to === employeeName) : all);
    } catch {
      toast.error('خطأ في جلب البيانات من قاعدة البيانات');
    } finally {
      setLoading(false);
    }
  };

  const importFromSheets = async () => {
    if (!config.sheetsUrl) {
      toast.error('لم يتم تعيين رابط Google Sheets');
      return;
    }
    setImporting(true);
    try {
      const response = await fetch(config.sheetsUrl);
      const rows: string[][] = await response.json();
      const dataRows = rows.slice(1);

      const phoneIdMap = await getLeadPhoneIdMap();

      const seenPhones = new Set<string>();
      const toAdd: Array<{ lead: NewLead; sheetRow: number }> = [];
      const toWriteId: Array<{ id: number; sheetRow: number }> = [];
      let skipped = 0;

      dataRows.forEach((cells, index) => {
        // إذا في ID بالشيت = استُورد سابقاً ومكتوب ID
        if (config.idColumnIndex !== undefined) {
          const existingId = (cells[config.idColumnIndex] ?? '').toString().trim();
          if (existingId) { skipped++; return; }
        }

        const lead: Partial<NewLead> = {};
        config.columns.forEach((col) => {
          lead[col.field] = (cells[col.columnIndex] ?? '').toString().trim();
        });

        if (!lead.name && !lead.phone) return;

        const phone = lead.phone || '';
        if (seenPhones.has(phone)) { skipped++; return; }
        seenPhones.add(phone);

        if (phoneIdMap.has(phone)) {
          // موجود بالـ DB لكن ما عنده ID بالشيت — اكتب ID فقط
          if (config.idColumnIndex !== undefined) {
            toWriteId.push({ id: phoneIdMap.get(phone)!, sheetRow: index + 2 });
          }
          skipped++;
          return;
        }

        const shouldDistribute =
          !config.distribution?.distributeOnlyNewLeads || lead.status === 'جديد';
        toAdd.push({
          lead: {
            name: lead.name || '',
            phone,
            service: lead.service || null,
            status: lead.status || 'جديد',
            notes: null,
            appointment_at: null,
            assigned_to: shouldDistribute ? assignUser(index, dataRows.length) : 'لم يتم التعيين',
          },
          sheetRow: index + 2,
        });
      });

      const inserted = await insertLeads(toAdd.map((t) => t.lead));

      // اكتب الـ IDs للشيت (جديد + موجود بدون ID)
      if (config.idColumnIndex !== undefined) {
        const newUpdates = inserted.map((l) => {
          const row = toAdd.find((t) => t.lead.phone === l.phone)!.sheetRow;
          return { row, col: config.idColumnIndex! + 1, value: String(l.id) };
        });
        const existingUpdates = toWriteId.map(({ id, sheetRow }) => ({
          row: sheetRow,
          col: config.idColumnIndex! + 1,
          value: String(id),
        }));
        const allUpdates = [...newUpdates, ...existingUpdates];

        if (allUpdates.length > 0) {
          try {
            const writeRes = await fetch(config.sheetsUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: allUpdates }),
            });
            const writeData = await writeRes.json().catch(() => ({}));
            if (!writeRes.ok || writeData.error) {
              toast.error(`تعذّر كتابة IDs للشيت: ${writeData.error ?? writeRes.status}`);
            }
          } catch (e) {
            toast.error(`تعذّر الاتصال بالشيت: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      await loadLeads();

      if (inserted.length === 0) {
        toast('لا توجد سجلات جديدة — كل البيانات موجودة بالفعل');
      } else {
        toast.success(`تمت إضافة ${inserted.length} جديد${skipped > 0 ? ` · تم تجاهل ${skipped} موجود` : ''}`);
      }
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message ?? JSON.stringify(error);
      toast.error(`فشل الاستيراد: ${msg}`);
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateLeadStatus(id, newStatus);
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
      toast.success('تم تحديث الحالة');
    } catch {
      toast.error('خطأ في تحديث الحالة');
    }
  };

  const markDeletedInSheet = (ids: number[]) => {
    if (config.idColumnIndex === undefined) return;
    fetch(config.sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markDeleted: ids }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.error) toast.error(`خطأ الشيت: ${d.error ?? r.status}`);
      })
      .catch((e) => toast.error(`تعذّر الاتصال: ${e.message}`));
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLead(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast.success('تم حذف السجل');
      markDeletedInSheet([id]);
    } catch {
      toast.error('خطأ في حذف السجل');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await deleteLeadsByIds(ids);
      setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
      setSelectedIds(new Set());
      toast.success(`تم حذف ${ids.length} سجل`);
      markDeletedInSheet(ids);
    } catch {
      toast.error('خطأ في الحذف');
    }
  };

  const handleDistributeSelected = async () => {
    if (selectedIds.size === 0 || selectedDistEmployees.length === 0) return;
    setDistributingSelected(true);
    try {
      const ids = Array.from(selectedIds);
      const updates = ids.map((id, i) => ({
        id,
        assigned_to: selectedDistEmployees[i % selectedDistEmployees.length],
      }));
      await Promise.all(updates.map(({ id, assigned_to }) => updateLeadAssignment(id, assigned_to)));
      setLeads((prev) =>
        prev.map((l) => {
          const u = updates.find((u) => u.id === l.id);
          return u ? { ...l, assigned_to: u.assigned_to } : l;
        })
      );
      setSelectedIds(new Set());
      setShowDistributeSelected(false);
      toast.success(`تم توزيع ${ids.length} lead على ${selectedDistEmployees.length} موظف`);
    } catch {
      toast.error('خطأ في التوزيع');
    } finally {
      setDistributingSelected(false);
    }
  };

  const toggleSelectAll = () => {
    if (pagedLeads.every((l) => selectedIds.has(l.id))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pagedLeads.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pagedLeads.forEach((l) => next.add(l.id));
        return next;
      });
    }
  };

  useEffect(() => {
    loadLeads();

    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newLead = payload.new as Lead;
          const show = !employeeName || newLead.assigned_to === employeeName;
          // تجنب التكرار لو loadLeads شغّال بنفس الوقت
          if (show) setLeads((prev) =>
            prev.some((l) => l.id === newLead.id) ? prev : [newLead, ...prev]
          );
        } else if (payload.eventType === 'UPDATE') {
          setLeads((prev) =>
            prev.map((l) => (l.id === (payload.new as Lead).id ? (payload.new as Lead) : l))
          );
        } else if (payload.eventType === 'DELETE') {
          setLeads((prev) => prev.filter((l) => l.id !== (payload.old as Lead).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employeeName]);

  const filteredLeads = leads.filter((lead) => {
    if (filter !== 'الكل' && lead.status !== filter) return false;
    if (filterUser !== 'الكل' && lead.assigned_to !== filterUser) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedLeads = filteredLeads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      جديد:             'bg-blue-50 text-blue-700 border-blue-200',
      متابعة:           'bg-yellow-50 text-yellow-700 border-yellow-200',
      'تم حجز الموعد':  'bg-green-50 text-green-700 border-green-200',
      'عميل بالفعل':    'bg-purple-50 text-purple-700 border-purple-200',
      'لا يرغب':        'bg-gray-100 text-gray-500 border-gray-300',
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getRowColor = (status: string) => {
    const colors: Record<string, string> = {
      جديد:             'bg-blue-50 hover:bg-blue-100',
      متابعة:           'bg-yellow-50 hover:bg-yellow-100',
      'تم حجز الموعد':  'bg-green-50 hover:bg-green-100',
      'عميل بالفعل':    'bg-purple-50 hover:bg-purple-100',
      'لا يرغب':        'bg-gray-100 hover:bg-gray-200',
    };
    return colors[status] || 'bg-white hover:bg-gray-50';
  };

  const handleDistribute = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('اختر موظفاً واحداً على الأقل');
      return;
    }
    setDistributing(true);
    try {
      // بس اللي ما فيهم مسؤول
      const unassigned = leads.filter((l) => !l.assigned_to || l.assigned_to === 'لم يتم التعيين');
      if (unassigned.length === 0) {
        toast('كل الـ leads عندهم مسؤول معيّن');
        setShowDistribute(false);
        return;
      }
      const updates = unassigned.map((lead, index) => ({
        id: lead.id,
        assigned_to: selectedEmployees[index % selectedEmployees.length],
      }));
      await Promise.all(updates.map(({ id, assigned_to }) => updateLeadAssignment(id, assigned_to)));
      setLeads((prev) =>
        prev.map((lead) => {
          const update = updates.find((u) => u.id === lead.id);
          return update ? { ...lead, assigned_to: update.assigned_to } : lead;
        })
      );
      toast.success(`تم توزيع ${unassigned.length} lead على ${selectedEmployees.length} موظف`);
      setShowDistribute(false);
    } catch {
      toast.error('خطأ في التوزيع');
    } finally {
      setDistributing(false);
    }
  };

  const handleSaveAppointment = async (id: number) => {
    const p = pendingAppointment[id];
    if (!p?.date || !p?.hour) { toast.error('اختر التاريخ والساعة'); return; }
    try {
      // نخزّن مباشرة بدون تحويل timezone عشان تطلع نفس الساعة للجميع
      const isoString = `${p.date}T${p.hour.padStart(2, '0')}:00:00Z`;
      await updateLeadAppointment(id, isoString);
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, appointment_at: isoString } : l));
      setPendingAppointment((prev) => { const n = { ...prev }; delete n[id]; return n; });
      toast.success('تم حفظ موعد الحجز');
    } catch {
      toast.error('خطأ في حفظ الموعد');
    }
  };

  const handleAssignmentChange = async (id: number, assigned_to: string) => {
    try {
      await updateLeadAssignment(id, assigned_to);
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, assigned_to } : l));
      toast.success('تم تغيير التعيين');
    } catch {
      toast.error('خطأ في تغيير التعيين');
    }
  };

  const handleNoteBlur = async (id: number) => {
    const notes = noteValues[id] ?? leads.find((l) => l.id === id)?.notes ?? '';
    try {
      await updateLeadNotes(id, notes);
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, notes } : l));
      setSavedNote(id);
      setTimeout(() => setSavedNote(null), 2000);
    } catch {
      toast.error('خطأ في حفظ الملاحظة');
    }
  };

  const allStatuses = ['الكل', ...config.statuses];
  const assignedUsers: string[] = config.distribution?.enabled
    ? ['الكل', ...Array.from(new Set(leads.map((l) => l.assigned_to).filter((u): u is string => !!u)))]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">إدارة العملاء المحتملين</h1>
            <p className="text-gray-600">عدد العملاء: {filteredLeads.length}</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => {
                    setSelectedDistEmployees([...employeesList]);
                    setShowDistributeSelected(true);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all"
                >
                  توزيع المحدد ({selectedIds.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all"
                >
                  حذف المحدد ({selectedIds.size})
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={importFromSheets}
                  disabled={importing || !config.sheetsUrl}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {importing ? 'جاري الاستيراد...' : 'استيراد من Sheets'}
                </button>
                {employeesList.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedEmployees([...employeesList]);
                      setShowDistribute(true);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all"
                  >
                    توزيع تلقائي
                  </button>
                )}
              </>
            )}
            <button
              onClick={loadLeads}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
            >
              <MdRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>

        {/* لوحة التوزيع التلقائي */}
        {showDistribute && (
          <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">توزيع Leads تلقائياً</h2>
            <p className="text-sm text-gray-500 mb-4">اختر الموظفين اللي تبي توزّع عليهم — الغائبين اشيل علامتهم</p>
            <div className="flex flex-wrap gap-3 mb-5">
              {employeesList.map((name) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(name)}
                    onChange={(e) =>
                      setSelectedEmployees((prev) =>
                        e.target.checked ? [...prev, name] : prev.filter((n) => n !== name)
                      )
                    }
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span className="text-sm font-medium text-gray-800">{name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={handleDistribute}
                disabled={distributing || selectedEmployees.length === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:shadow-md transition-all disabled:opacity-50"
              >
                {distributing ? 'جاري التوزيع...' : `وزّع على ${selectedEmployees.length} موظف`}
              </button>
              <button
                onClick={() => setShowDistribute(false)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                إلغاء
              </button>
              <p className="text-xs text-gray-400">
                سيتم توزيع {leads.filter((l) => !l.assigned_to || l.assigned_to === 'لم يتم التعيين').length} lead بدون مسؤول
              </p>
            </div>
          </div>
        )}


        {/* لوحة توزيع المحدد */}
        {showDistributeSelected && selectedIds.size > 0 && (
          <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">توزيع {selectedIds.size} lead محدد</h2>
            <p className="text-sm text-gray-500 mb-4">اختر الموظفين اللي تبي توزّع عليهم</p>
            <div className="flex flex-wrap gap-3 mb-5">
              {employeesList.map((name) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedDistEmployees.includes(name)}
                    onChange={(e) =>
                      setSelectedDistEmployees((prev) =>
                        e.target.checked ? [...prev, name] : prev.filter((n) => n !== name)
                      )
                    }
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span className="text-sm font-medium text-gray-800">{name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDistributeSelected}
                disabled={distributingSelected || selectedDistEmployees.length === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:shadow-md transition-all disabled:opacity-50"
              >
                {distributingSelected ? 'جاري التوزيع...' : `وزّع على ${selectedDistEmployees.length} موظف`}
              </button>
              <button
                onClick={() => setShowDistributeSelected(false)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Status Filters */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3 font-medium">حسب الحالة:</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {allStatuses.map((status) => (
              <button
                key={status}
                onClick={() => { setFilter(status); setCurrentPage(1); }}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                  filter === status
                    ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* User Filters — admin only */}
        {isAdmin && config.distribution?.enabled && assignedUsers.length > 1 && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3 font-medium">حسب المسؤول:</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {assignedUsers.map((user) => (
                <button
                  key={user}
                  onClick={() => { setFilterUser(user); setCurrentPage(1); }}
                  className={`px-6 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                    filterUser === user
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {user}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {isAdmin && (
                    <th className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-red-600 cursor-pointer"
                        checked={pagedLeads.length > 0 && pagedLeads.every((l) => selectedIds.has(l.id))}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الاسم</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الجوال</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الخدمة المطلوبة</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الحالة</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">موعد الحجز</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الملاحظات</th>
                  {isAdmin && config.distribution?.enabled && (
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">المسؤول</th>
                  )}
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">تاريخ الإضافة</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">آخر تحديث</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length > 0 ? (
                  pagedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={`border-b border-gray-100 transition-colors ${getRowColor(lead.status)}`}
                    >
                      {isAdmin && (
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-red-600 cursor-pointer"
                            checked={selectedIds.has(lead.id)}
                            onChange={(e) =>
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(lead.id) : next.delete(lead.id);
                                return next;
                              })
                            }
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{lead.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900" dir="ltr">{lead.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{lead.service || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${getStatusBadgeColor(lead.status)}`}
                        >
                          {config.statuses.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {lead.status === 'تم حجز الموعد' ? (
                          lead.appointment_at && !pendingAppointment[lead.id] ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded-lg border border-green-200">
                                {(() => {
                                const [datePart, timePart] = lead.appointment_at.split('T');
                                const hour = parseInt(timePart?.substring(0, 2) ?? '0');
                                const timeLabel = hour === 0 ? '12:00 ص' : hour < 12 ? `${hour}:00 ص` : hour === 12 ? '12:00 م' : `${hour - 12}:00 م`;
                                return `${datePart} — ${timeLabel}`;
                              })()}
                              </span>
                              <button onClick={() => {
                            const saved = lead.appointment_at ?? '';
                            const date = saved.split('T')[0] ?? '';
                            const hour = saved.split('T')[1]?.substring(0, 2) ?? '';
                            setPendingAppointment((p) => ({ ...p, [lead.id]: { date, hour } }));
                          }} className="text-xs text-blue-500 hover:underline">تعديل</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <input
                                type="date"
                                value={pendingAppointment[lead.id]?.date ?? ''}
                                onChange={(e) => setPendingAppointment((p) => ({ ...p, [lead.id]: { ...p[lead.id], date: e.target.value } }))}
                                className="px-2 py-1 border border-green-300 rounded-lg text-xs text-gray-700 focus:outline-none bg-white"
                              />
                              <select
                                value={pendingAppointment[lead.id]?.hour ?? ''}
                                onChange={(e) => setPendingAppointment((p) => ({ ...p, [lead.id]: { ...p[lead.id], hour: e.target.value } }))}
                                className="px-2 py-1 border border-green-300 rounded-lg text-xs text-gray-700 focus:outline-none bg-white"
                              >
                                <option value="">-- اختر الساعة --</option>
                                {Array.from({ length: 24 }, (_, i) => {
                                  const label = i === 0 ? '12:00 ص' : i < 12 ? `${i}:00 ص` : i === 12 ? '12:00 م' : `${i - 12}:00 م`;
                                  return <option key={i} value={String(i).padStart(2, '0')}>{label}</option>;
                                })}
                              </select>
                              <button onClick={() => handleSaveAppointment(lead.id)}
                                className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                                حفظ
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="relative">
                          <input
                            type="text"
                            value={noteValues[lead.id] ?? lead.notes ?? ''}
                            onChange={(e) => setNoteValues((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            onBlur={() => handleNoteBlur(lead.id)}
                            placeholder="أضف ملاحظة..."
                            className="w-full min-w-[160px] px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors"
                          />
                          {savedNote === lead.id && (
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600 text-xs font-medium">✓ محفوظ</span>
                          )}
                        </div>
                      </td>
                      {isAdmin && config.distribution?.enabled && (
                        <td className="px-6 py-4 text-sm">
                          {employeesList.length > 0 ? (
                            <select
                              value={lead.assigned_to || ''}
                              onChange={(e) => handleAssignmentChange(lead.id, e.target.value)}
                              className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                            >
                              <option value="">-- اختر --</option>
                              {employeesList.map((name) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="inline-block px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200">
                              {lead.assigned_to || 'لم يتم التعيين'}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {lead.updated_at
                          ? new Date(lead.updated_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(lead.id)}
                            className="text-red-600 hover:text-red-700 font-medium text-sm"
                          >
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5 + (config.distribution?.enabled ? 1 : 0) + (isAdmin ? 0 : 0)}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      {loading
                        ? 'جاري التحميل...'
                        : leads.length === 0
                        ? 'لا توجد بيانات — اضغط "استيراد من Sheets" لجلب البيانات'
                        : 'لا توجد عملاء محتملين في هذا الفلتر'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-5 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              السابق
            </button>
            <span className="text-sm text-gray-600 font-medium">
              صفحة {safePage} من {totalPages}
              <span className="text-gray-400 mx-2">·</span>
              {filteredLeads.length} سجل
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-5 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              التالي
            </button>
          </div>
        )}

        {/* Team Stats — admin only */}
        {isAdmin &&
          config.distribution?.enabled &&
          config.distribution.users.length > 0 &&
          leads.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">توزيع الـ Leads على الفريق</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {config.distribution.users.map((user) => {
                  const userLeads = leads.filter((l) => l.assigned_to === user.name);
                  return (
                    <div
                      key={user.id}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-right"
                    >
                      <p className="text-gray-600 text-sm mb-2">{user.name}</p>
                      <p className="text-3xl font-bold text-purple-600">{userLeads.length}</p>
                      <p className="text-xs text-gray-500 mt-3">
                        جديد: {userLeads.filter((l) => l.status === 'جديد').length}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};
