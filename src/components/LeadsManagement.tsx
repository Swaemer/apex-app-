import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MdRefresh } from 'react-icons/md';
import { getLeads, upsertLeads, updateLeadStatus, updateLeadNotes, deleteLead } from '../services/leadsService';
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
}

interface LeadsManagementProps {
  config: LeadsManagementConfig;
  employeeName?: string; // إذا موجود → موظف يشوف بس leads باسمه
  isAdmin?: boolean;
}

export const LeadsManagement = ({ config, employeeName, isAdmin = false }: LeadsManagementProps) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>('الكل');
  const [filterUser, setFilterUser] = useState<string>('الكل');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

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
      const dataRows = rows.slice(1); // skip header
      const total = dataRows.length;

      const newLeads: NewLead[] = dataRows
        .map((cells, index) => {
          const lead: Partial<NewLead> = {};

          config.columns.forEach((col) => {
            lead[col.field] = (cells[col.columnIndex] ?? '').toString().trim();
          });

          const shouldDistribute =
            !config.distribution?.distributeOnlyNewLeads || lead.status === 'جديد';

          return {
            name: lead.name || '',
            phone: lead.phone || '',
            service: lead.service || null,
            status: lead.status || 'جديد',
            notes: null,
            assigned_to: shouldDistribute ? assignUser(index, total) : 'لم يتم التعيين',
          };
        })
        .filter((lead) => lead.name || lead.phone);

      await upsertLeads(newLeads);
      await loadLeads();
      toast.success(`تم استيراد ${newLeads.length} سجل من Google Sheets`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
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

  const handleDelete = async (id: number) => {
    try {
      await deleteLead(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast.success('تم حذف السجل');
    } catch {
      toast.error('خطأ في حذف السجل');
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
          if (show) setLeads((prev) => [newLead, ...prev]);
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

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      جديد:             'bg-blue-50 text-blue-700 border-blue-200',
      متابعة:           'bg-yellow-50 text-yellow-700 border-yellow-200',
      'تم حجز الموعد':  'bg-green-50 text-green-700 border-green-200',
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const handleNotesChange = async (id: number, notes: string) => {
    try {
      await updateLeadNotes(id, notes);
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, notes } : l));
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
            {isAdmin && (
              <button
                onClick={importFromSheets}
                disabled={importing || !config.sheetsUrl}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
              >
                {importing ? 'جاري الاستيراد...' : 'استيراد من Sheets'}
              </button>
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

        {/* Status Filters */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3 font-medium">حسب الحالة:</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {allStatuses.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
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
                  onClick={() => setFilterUser(user)}
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
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الاسم</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الجوال</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الخدمة المطلوبة</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الحالة</th>
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
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{lead.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{lead.phone || '-'}</td>
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
                        <input
                          type="text"
                          value={lead.notes || ''}
                          onChange={(e) => handleNotesChange(lead.id, e.target.value)}
                          placeholder="أضف ملاحظة..."
                          className="w-full min-w-[160px] px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors"
                        />
                      </td>
                      {isAdmin && config.distribution?.enabled && (
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-block px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200">
                            {lead.assigned_to || 'لم يتم التعيين'}
                          </span>
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
