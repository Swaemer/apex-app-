import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { MdLeaderboard, MdScience, MdAssignment, MdAdd, MdDelete, MdEdit, MdCheck, MdClose } from 'react-icons/md';
import { getLeads, getEmployees, updateLabPermission } from '../services/leadsService';
import { getLabCases } from '../services/labService';
import { getDoctors, addDoctor, deleteDoctor, updateDoctor } from '../services/doctorService';
import { supabase } from '../utils/supabase/supabase';
import { useAuth } from '../context/AuthContext';
import type { Lead, Profile } from '../services/leadsService';
import type { LabCase } from '../services/labService';
import type { Doctor } from '../services/doctorService';

const STATUSES = ['جديد', 'متابعة', 'تم حجز الموعد'];

const statusColors: Record<string, string> = {
  جديد:             'bg-blue-50 text-blue-700 border-blue-200',
  متابعة:           'bg-yellow-50 text-yellow-700 border-yellow-200',
  'تم حجز الموعد':  'bg-green-50 text-green-700 border-green-200',
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
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const allLeads = await getLeads();
        if (user.isAdmin) {
          setLeads(allLeads);
          const [emps, cases, docs] = await Promise.all([getEmployees(), getLabCases(), getDoctors()]);
          setEmployees(emps);
          setLabCases(cases);
          setDoctors(docs);
        } else {
          setMyLeads(allLeads.filter((l) => l.assigned_to === user.name));
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

  const toggleLeavePermission = async (emp: Profile) => {
    try {
      const newVal = !emp.can_submit_leave;
      await supabase.from('profiles').update({ can_submit_leave: newVal }).eq('id', emp.id);
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, can_submit_leave: newVal } : e));
    } catch { /* ignore */ }
  };

  const toggleLabPermission = async (emp: Profile) => {
    try {
      await updateLabPermission(emp.id, !emp.can_edit_lab);
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, can_edit_lab: !emp.can_edit_lab } : e));
    } catch { /* ignore */ }
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

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">لوحة التحكم</h1>
            <p className="text-gray-500">مرحباً بك في Apex Dashboard</p>
          </div>

          {!loadingStats && (
            <>
              {/* إحصائيات Leads */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-right">
                  <p className="text-xs text-gray-500 mb-1">إجمالي الـ Leads</p>
                  <p className="text-3xl font-bold text-gray-900">{totalLeads}</p>
                </div>
                {STATUSES.map((s) => {
                  const count = leads.filter((l) => l.status === s).length;
                  return (
                    <div key={s} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-right">
                      <p className="text-xs text-gray-500 mb-1">{s}</p>
                      <p className="text-3xl font-bold text-gray-900">{count}</p>
                      <p className="text-xs text-gray-400 mt-1">{totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0}%</p>
                    </div>
                  );
                })}
              </div>

              {/* نسبة الإنجاز */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">نسبة الإنجاز الكلية</span>
                  <span className="text-2xl font-bold text-green-600">{completionRate}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }} />
                </div>
              </div>

              {/* أداء الفريق */}
              {employees.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">أداء الفريق</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map((emp) => {
                      const empLeads = leads.filter((l) => l.assigned_to === emp.name);
                      const empDone = empLeads.filter((l) => l.status === 'تم حجز الموعد').length;
                      const empRate = empLeads.length > 0 ? Math.round((empDone / empLeads.length) * 100) : 0;
                      return (
                        <div key={emp.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-right">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100">{empRate}% إنجاز</span>
                            <div><p className="font-bold text-gray-900">{emp.name}</p><p className="text-xs text-gray-400">{empLeads.length} lead</p></div>
                          </div>
                          <div className="flex gap-2 flex-wrap mb-4">
                            {STATUSES.map((s) => {
                              const cnt = empLeads.filter((l) => l.status === s).length;
                              return <span key={s} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusColors[s]}`}>{s}: {cnt}</span>;
                            })}
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full" style={{ width: `${empRate}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* إحصائيات المعمل */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إحصائيات المعمل</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-right">
                    <p className="text-xs text-gray-500 mb-1">إجمالي الحالات</p>
                    <p className="text-3xl font-bold text-gray-900">{labCases.length}</p>
                  </div>
                  {labStatuses.map((s) => {
                    const colors: Record<string, string> = { 'في المعمل': 'text-yellow-700', 'تم الاستلام': 'text-green-700', 'أعيد للمعمل': 'text-red-700' };
                    return (
                      <div key={s} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-right">
                        <p className="text-xs text-gray-500 mb-1">{s}</p>
                        <p className={`text-3xl font-bold ${colors[s]}`}>{labCases.filter((c) => c.status === s).length}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* الصلاحيات */}
              {employees.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4">صلاحيات تعديل المعمل</h3>
                    <div className="divide-y divide-gray-100">
                      {employees.map((emp) => (
                        <div key={emp.id} className="flex items-center justify-between py-3">
                          <button onClick={() => toggleLabPermission(emp)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emp.can_edit_lab ? 'bg-green-500' : 'bg-gray-200'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${emp.can_edit_lab ? '-translate-x-6' : '-translate-x-1'}`} />
                          </button>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-400">{emp.can_edit_lab ? 'مسموح بالتعديل' : 'عرض فقط'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4">صلاحيات طلبات الإجازة</h3>
                    <div className="divide-y divide-gray-100">
                      {employees.map((emp) => (
                        <div key={emp.id} className="flex items-center justify-between py-3">
                          <button onClick={() => toggleLeavePermission(emp)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emp.can_submit_leave ? 'bg-green-500' : 'bg-gray-200'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${emp.can_submit_leave ? '-translate-x-6' : '-translate-x-1'}`} />
                          </button>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-400">{emp.can_submit_leave ? 'مسموح بالإجازات' : 'غير مفعّل'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* إدارة الأطباء */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
                <h3 className="text-base font-bold text-gray-900 mb-4">إدارة فريق الأطباء</h3>
                <div className="flex gap-2 mb-4">
                  <button onClick={handleAddDoctor} className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                    <MdAdd className="w-4 h-4" /> إضافة
                  </button>
                  <input type="text" value={newDoctorName} onChange={(e) => setNewDoctorName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddDoctor()}
                    placeholder="اسم الطبيب الجديد" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-300" />
                </div>
                <div className="divide-y divide-gray-100">
                  {doctors.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between py-2.5 gap-2">
                      <div className="flex gap-1">
                        {editingDoctorId === doc.id ? (
                          <>
                            <button onClick={() => handleUpdateDoctor(doc.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><MdCheck className="w-4 h-4" /></button>
                            <button onClick={() => setEditingDoctorId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><MdClose className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingDoctorId(doc.id); setEditingDoctorName(doc.name); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><MdEdit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteDoctor(doc.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><MdDelete className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                      {editingDoctorId === doc.id
                        ? <input type="text" value={editingDoctorName} onChange={(e) => setEditingDoctorName(e.target.value)} className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-sm focus:outline-none bg-white" />
                        : <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* القائمة */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">القائمة الرئيسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <button onClick={() => navigate('/leads')} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 hover:shadow-lg hover:border-slate-300 transition-all text-right group">
                <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center"><MdLeaderboard className="text-white text-xl" /></div></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">إدارة العملاء المحتملين</h3>
                <p className="text-gray-600 text-sm mb-4">إدارة وتتبع العملاء المحتملين</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
              </button>
              <button onClick={() => navigate('/lab')} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 hover:shadow-lg hover:border-slate-300 transition-all text-right group">
                <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center"><MdScience className="text-white text-xl" /></div></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">استقبال المعمل</h3>
                <p className="text-gray-600 text-sm mb-4">متابعة حالات الشحن والاستلام من المعمل</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
              </button>
              <div className="bg-gray-50 rounded-2xl border border-gray-200 border-dashed p-8 text-right opacity-40">
                <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mb-4"><span className="text-2xl">🔒</span></div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">قادم قريباً</h3>
                <p className="text-gray-500 text-sm">ميزات جديدة قيد الإعداد</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ======== عرض الموظف ========
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">لوحة التحكم</h1>
          <p className="text-gray-500">مرحباً بك في Apex Dashboard</p>
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
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-right">
                  <p className="text-xs text-gray-500 mb-1">إجمالي leads</p>
                  <p className="text-3xl font-bold text-gray-900">{myTotal}</p>
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
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-green-600">{myRate}%</span>
                  <span className="text-sm font-medium text-gray-600">نسبة إنجازك</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 flex items-center justify-end pr-2" style={{ width: `${Math.max(myRate, 5)}%` }}>
                    {myRate > 10 && <span className="text-white text-xs font-bold">{myRate}%</span>}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>منجز: {myDone}</span>
                  <span>متبقي: {myTotal - myDone}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* القائمة */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">القائمة الرئيسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button onClick={() => navigate('/leads')} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 hover:shadow-lg hover:border-slate-300 transition-all text-right group">
              <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdLeaderboard className="text-white text-xl" /></div></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">إدارة العملاء المحتملين</h3>
              <p className="text-gray-600 text-sm mb-4">إدارة وتتبع العملاء المحتملين</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
            </button>
            <button onClick={() => navigate('/lab')} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 hover:shadow-lg hover:border-slate-300 transition-all text-right group">
              <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdScience className="text-white text-xl" /></div></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">استقبال المعمل</h3>
              <p className="text-gray-600 text-sm mb-4">متابعة حالات الشحن والاستلام من المعمل</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
            </button>
            <div className="bg-gray-50 rounded-2xl border border-gray-200 border-dashed p-8 text-right opacity-40">
              <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mb-4"><span className="text-2xl">🔒</span></div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">قادم قريباً</h3>
              <p className="text-gray-500 text-sm">ميزات جديدة قيد الإعداد</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
