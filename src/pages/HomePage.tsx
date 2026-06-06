import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { MdLeaderboard, MdScience, MdAssignment, MdAdd, MdDelete, MdEdit, MdCheck, MdClose, MdLocalOffer, MdCampaign, MdSend, MdCalendarMonth, MdAdminPanelSettings } from 'react-icons/md';
import { AppointmentsCalendar } from '../components/AppointmentsCalendar';
import { getLeads, getEmployees } from '../services/leadsService';
import { getLabCases } from '../services/labService';
import { getDoctors, addDoctor, deleteDoctor, updateDoctor } from '../services/doctorService';
import { getAllAnnouncements, createAnnouncement, deactivateAnnouncement, deleteAnnouncement, getReads } from '../services/announcementService';
import { supabase } from '../utils/supabase/supabase';
import { useAuth } from '../context/AuthContext';
import type { Lead, Profile } from '../services/leadsService';
import type { LabCase } from '../services/labService';
import type { Doctor } from '../services/doctorService';
import type { Announcement, AnnouncementRead } from '../services/announcementService';

const STATUSES = ['جديد', 'متابعة', 'تم حجز الموعد', 'عميل بالفعل', 'لا يرغب'];

const statusColors: Record<string, string> = {
  جديد:             'bg-blue-50 text-blue-700 border-blue-200',
  متابعة:           'bg-yellow-50 text-yellow-700 border-yellow-200',
  'تم حجز الموعد':  'bg-green-50 text-green-700 border-green-200',
  'عميل بالفعل':    'bg-purple-50 text-purple-700 border-purple-200',
  'لا يرغب':        'bg-gray-100 text-gray-500 border-gray-300',
};

const motivationalMessages = (rate: number): { text: string; emoji: string } => {
  if (rate === 0)  return { text: 'ابدأ يومك بخطوة، كل إنجاز يبدأ بالأول!', emoji: '🚀' };
  if (rate < 25)  return { text: 'بداية ممتازة، واصل التقدم!', emoji: '💪' };
  if (rate < 50)  return { text: 'أنت في المنتصف، لا تتوقف!', emoji: '🔥' };
  if (rate < 75)  return { text: 'رائع! أنت تتجاوز نصف الطريق!', emoji: '⭐' };
  if (rate < 100) return { text: 'قريب جداً من الهدف، أكمل!', emoji: '🏆' };
  return { text: 'أنجزت كل شيء! عمل رائع!', emoji: '🎯' };
};

export const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const userName = user?.name ?? '';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [labCases, setLabCases] = useState<LabCase[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [editingDoctorId, setEditingDoctorId] = useState<number | null>(null);
  const [editingDoctorName, setEditingDoctorName] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readsMap, setReadsMap] = useState<Record<number, AnnouncementRead[]>>({});
  const [expandedAnn, setExpandedAnn] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [targetEmployees, setTargetEmployees] = useState<string[]>([]);
  const [canViewAdmin, setCanViewAdmin] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const allLeads = await getLeads();
        if (user.isAdmin) {
          setCanViewAdmin(true);
          setLeads(allLeads);
          const [emps, cases, docs, anns] = await Promise.all([getEmployees(), getLabCases(), getDoctors(), getAllAnnouncements()]);
          setEmployees(emps);
          setLabCases(cases);
          setDoctors(docs);
          setAnnouncements(anns);
        } else {
          // تحقق من صلاحية عرض الداشبورد
          const { data: profile } = await supabase
            .from('profiles')
            .select('can_view_admin')
            .eq('id', user.id)
            .single();

          if (profile?.can_view_admin) {
            setCanViewAdmin(true);
            setLeads(allLeads);
            const [emps, cases] = await Promise.all([getEmployees(), getLabCases()]);
            setEmployees(emps);
            setLabCases(cases);
          } else {
            setMyLeads(allLeads.filter((l) => l.assigned_to === user.name));
          }
        }
      } catch { /* profiles قد لا تكون جاهزة */ }
      setLoadingStats(false);
    };
    fetchData();

    if (!user?.isAdmin) return;

    const channel = supabase
      .channel('home-leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLeads((prev) => [payload.new as Lead, ...prev]);
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
  }, [user]);

  const handleAddDoctor = async () => {
    if (!newDoctorName.trim()) return;
    await addDoctor(newDoctorName.trim());
    setDoctors(await getDoctors());
    setNewDoctorName('');
  };

  const handleDeleteDoctor = async (id: number) => {
    await deleteDoctor(id);
    setDoctors((prev) => prev.filter((d) => d.id !== id));
  };

  const handleUpdateDoctor = async (id: number) => {
    if (!editingDoctorName.trim()) return;
    await updateDoctor(id, editingDoctorName.trim());
    setDoctors((prev) => prev.map((d) => d.id === id ? { ...d, name: editingDoctorName.trim() } : d));
    setEditingDoctorId(null);
  };


  const handleExpandAnn = async (id: number) => {
    if (expandedAnn === id) { setExpandedAnn(null); return; }
    setExpandedAnn(id);
    if (!readsMap[id]) {
      const reads = await getReads(id);
      setReadsMap((prev) => ({ ...prev, [id]: reads }));
    }
  };

  const handleSendAnnouncement = async () => {
    if (!newMessage.trim()) return;
    try {
      await createAnnouncement(newMessage.trim(), targetEmployees);
      setAnnouncements(await getAllAnnouncements());
      setNewMessage('');
      setTargetEmployees([]);
    } catch { /* ignore */ }
  };

  const handleDeactivate = async (id: number) => {
    await deactivateAnnouncement(id);
    setAnnouncements((prev) => prev.map((a) => a.id === id ? { ...a, is_active: false } : a));
  };

  const handleDeleteAnn = async (id: number) => {
    await deleteAnnouncement(id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };


  // إحصائيات المعمل
  const labStatuses = ['في المعمل', 'تم الاستلام', 'أعيد للمعمل'];

  // إحصائيات الأدمن
  const totalLeads = leads.length;
  const totalDone = leads.filter((l) => l.status === 'تم حجز الموعد').length;
  const completionRate = totalLeads > 0 ? Math.round((totalDone / totalLeads) * 100) : 0;

  // إحصائيات الموظف
  const myTotal = myLeads.length;
  const myDone = myLeads.filter((l) => l.status === 'تم حجز الموعد').length;
  const myRate = myTotal > 0 ? Math.round((myDone / myTotal) * 100) : 0;
  const motivation = motivationalMessages(myRate);

  if (canViewAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-8" dir="rtl">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">لوحة التحكم</h1>
            <p className="text-gray-500 dark:text-gray-400">مرحباً بك في Apex Dashboard</p>
          </div>

          {!loadingStats && (
            <>
              {/* إحصائيات Leads */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">إجمالي الـ Leads</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalLeads}</p>
                </div>
                {STATUSES.map((s) => {
                  const count = leads.filter((l) => l.status === s).length;
                  return (
                    <div key={s} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s}</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0}%</p>
                    </div>
                  );
                })}
              </div>

              {/* نسبة الإنجاز */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">نسبة الإنجاز الكلية</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">{completionRate}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }} />
                </div>
              </div>

              {/* أداء الفريق */}
              {employees.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">أداء الفريق</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map((emp) => {
                      const empLeads = leads.filter((l) => l.assigned_to === emp.name);
                      const empDone = empLeads.filter((l) => l.status === 'تم حجز الموعد').length;
                      const empRate = empLeads.length > 0 ? Math.round((empDone / empLeads.length) * 100) : 0;
                      return (
                        <div key={emp.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 text-right">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg border border-green-100 dark:border-green-800">{empRate}% إنجاز</span>
                            <div><p className="font-bold text-gray-900 dark:text-white">{emp.name}</p><p className="text-xs text-gray-400 dark:text-gray-500">{empLeads.length} lead</p></div>
                          </div>
                          <div className="flex gap-2 flex-wrap mb-4">
                            {STATUSES.map((s) => {
                              const cnt = empLeads.filter((l) => l.status === s).length;
                              return <span key={s} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusColors[s]}`}>{s}: {cnt}</span>;
                            })}
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full" style={{ width: `${empRate}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* تقويم الحجوزات */}
              <AppointmentsCalendar leads={leads} />

              {/* إحصائيات المعمل — للجميع */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">إحصائيات المعمل</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">إجمالي الحالات</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{labCases.length}</p>
                  </div>
                  {labStatuses.map((s) => {
                    const colors: Record<string, string> = { 'في المعمل': 'text-yellow-700', 'تم الاستلام': 'text-green-700', 'أعيد للمعمل': 'text-red-700' };
                    return (
                      <div key={s} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s}</p>
                        <p className={`text-3xl font-bold ${colors[s]}`}>{labCases.filter((c) => c.status === s).length}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* رابط صفحة الصلاحيات — للأدمن فقط */}
              {isAdmin && <button onClick={() => navigate('/permissions')}
                className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-8 flex items-center justify-between hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right group">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:gap-3 transition-all">
                  إدارة الصلاحيات <FiArrowLeft className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">صلاحيات الموظفين</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">تحكم بصلاحيات كل موظف من مكان واحد</p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center">
                    <MdAdminPanelSettings className="text-white text-xl" />
                  </div>
                </div>
              </button>}

              {/* إدارة الأطباء — للأدمن فقط */}
              {isAdmin && <>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-8">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">إدارة فريق الأطباء</h3>
                <div className="flex gap-2 mb-4">
                  <button onClick={handleAddDoctor} className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                    <MdAdd className="w-4 h-4" /> إضافة
                  </button>
                  <input type="text" value={newDoctorName} onChange={(e) => setNewDoctorName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddDoctor()}
                    placeholder="اسم الطبيب الجديد" className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-gray-300" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {doctors.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between py-2.5 gap-2">
                      <div className="flex gap-1">
                        {editingDoctorId === doc.id ? (
                          <>
                            <button onClick={() => handleUpdateDoctor(doc.id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"><MdCheck className="w-4 h-4" /></button>
                            <button onClick={() => setEditingDoctorId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><MdClose className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingDoctorId(doc.id); setEditingDoctorName(doc.name); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><MdEdit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteDoctor(doc.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><MdDelete className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                      {editingDoctorId === doc.id
                        ? <input type="text" value={editingDoctorName} onChange={(e) => setEditingDoctorName(e.target.value)} className="flex-1 px-2 py-1 border border-blue-300 dark:border-blue-600 rounded-lg text-sm focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
                        : <p className="text-sm font-medium text-gray-900 dark:text-white">{doc.name}</p>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </>}

          {/* إدارة الإشعارات — للأدمن فقط */}
          {isAdmin &&
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-8">
            <div className="flex items-center gap-2 mb-5">
              <MdCampaign className="w-5 h-5 text-red-500" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">إرسال إشعار للموظفين</h3>
            </div>

            {/* نموذج الإشعار */}
            <div className="space-y-3 mb-5">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="اكتب الرسالة هنا..."
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-red-300 transition-colors resize-none"
              />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">اختر المستلمين (اتركها فاضية لإرسال للكل)</p>
                <div className="flex flex-wrap gap-2">
                  {employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetEmployees.includes(emp.name)}
                        onChange={(e) =>
                          setTargetEmployees((prev) =>
                            e.target.checked ? [...prev, emp.name] : prev.filter((n) => n !== emp.name)
                          )
                        }
                        className="w-4 h-4 accent-red-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{emp.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSendAnnouncement}
                disabled={!newMessage.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all disabled:opacity-50"
              >
                <MdSend className="w-4 h-4" /> إرسال الإشعار
              </button>
            </div>

            {/* الإشعارات الحالية */}
            {announcements.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">الإشعارات السابقة</p>
                {announcements.map((a) => (
                  <div key={a.id} className={`rounded-lg border text-sm overflow-hidden ${a.is_active ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-600 opacity-60'}`}>
                    <div className={`flex items-center justify-between gap-3 p-3 ${a.is_active ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                      <div className="flex-1 text-right">
                        <p className={`font-medium ${a.is_active ? 'text-red-800 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'}`}>{a.message}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {a.target_employees?.length ? `إلى: ${a.target_employees.join('، ')}` : 'للجميع'}
                          {' · '}{new Date(a.created_at).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleExpandAnn(a.id)}
                          className="px-2.5 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                          {expandedAnn === a.id ? 'إخفاء' : 'من اطلع؟'}
                        </button>
                        {a.is_active && (
                          <button onClick={() => handleDeactivate(a.id)} className="px-2.5 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                            إيقاف
                          </button>
                        )}
                        <button onClick={() => handleDeleteAnn(a.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                          <MdDelete className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {expandedAnn === a.id && (
                      <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                        {readsMap[a.id]?.length ? (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">اطلع على الإشعار:</p>
                            {readsMap[a.id].map((r) => (
                              <div key={r.user_name} className="flex items-center justify-between">
                                <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(r.read_at).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
                                <span className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                                  <MdCheck className="w-3.5 h-3.5" />{r.user_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">لم يطلع أحد بعد</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>}
            </>
          )}

          {/* القائمة */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">القائمة الرئيسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <button onClick={() => navigate('/leads')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right group">
                <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center"><MdLeaderboard className="text-white text-xl" /></div></div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">إدارة العملاء المحتملين</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">إدارة وتتبع العملاء المحتملين</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
              </button>
              <button onClick={() => navigate('/lab')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right group">
                <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center"><MdScience className="text-white text-xl" /></div></div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">استقبال المعمل</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">متابعة حالات الشحن والاستلام من المعمل</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
              </button>
              <button onClick={() => navigate('/offers')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-amber-200 dark:hover:border-amber-700 transition-all text-right group">
                <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdLocalOffer className="text-white text-xl" /></div></div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">عروض الشهر</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">عرض وإدارة أسعار وخدمات الشهر</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ======== عرض الموظف ========
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">لوحة التحكم</h1>
          <p className="text-gray-500 dark:text-gray-400">مرحباً بك في Apex Dashboard</p>
        </div>

        {!loadingStats && (
          <>
            {/* كرت طلب الإجازة */}
            <div className="mb-6">
              <button onClick={() => navigate('/leave')}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white text-right hover:shadow-lg transition-all group">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg text-sm font-medium group-hover:bg-white/30 transition-all">
                    افتح الآن <MdAssignment className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-white/70 text-sm mb-1">استقبال المرضى</p>
                    <p className="text-2xl font-bold">طلبات الإجازة المرضية</p>
                  </div>
                </div>
              </button>
            </div>

            {/* داشبورد الموظف */}
            <div className="mb-8">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl p-6 mb-6 text-white text-right">
                <div className="flex items-center justify-between">
                  <span className="text-5xl">{motivation.emoji}</span>
                  <div>
                    <p className="text-white/70 text-sm mb-1">مرحباً {userName}</p>
                    <p className="text-xl font-bold">{motivation.text}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">إجمالي leads</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{myTotal}</p>
                </div>
                {STATUSES.map((s) => {
                  const count = myLeads.filter((l) => l.status === s).length;
                  return (
                    <div key={s} className={`rounded-2xl border shadow-sm p-5 text-right ${statusColors[s]}`}>
                      <p className="text-xs opacity-70 mb-1">{s}</p>
                      <p className="text-3xl font-bold">{count}</p>
                    </div>
                  );
                })}
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">{myRate}%</span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">نسبة إنجازك</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 flex items-center justify-end pr-2" style={{ width: `${Math.max(myRate, 5)}%` }}>
                    {myRate > 10 && <span className="text-white text-xs font-bold">{myRate}%</span>}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-2">
                  <span>منجز: {myDone}</span>
                  <span>متبقي: {myTotal - myDone}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* القائمة */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">القائمة الرئيسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button onClick={() => navigate('/leads')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right group">
              <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdLeaderboard className="text-white text-xl" /></div></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">إدارة العملاء المحتملين</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">إدارة وتتبع العملاء المحتملين</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
            </button>
            <button onClick={() => navigate('/lab')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right group">
              <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdScience className="text-white text-xl" /></div></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">استقبال المعمل</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">متابعة حالات الشحن والاستلام من المعمل</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
            </button>
            <button onClick={() => navigate('/offers')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-amber-200 dark:hover:border-amber-700 transition-all text-right group">
              <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdLocalOffer className="text-white text-xl" /></div></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">عروض الشهر</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">عرض أسعار وخدمات الشهر</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
            </button>

            <button onClick={() => navigate('/appointments')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-green-200 dark:hover:border-green-700 transition-all text-right group">
              <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-green-600 to-green-700 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdCalendarMonth className="text-white text-xl" /></div></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">حجوزات المرضى الجدد</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">تقويم حجوزاتك للمرضى</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
