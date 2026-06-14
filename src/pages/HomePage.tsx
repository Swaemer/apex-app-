import { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { MdLeaderboard, MdScience, MdAssignment, MdDelete, MdCheck, MdClose, MdLocalOffer, MdCampaign, MdCelebration, MdSend, MdCalendarMonth, MdAdminPanelSettings, MdMedicalServices, MdEdit } from 'react-icons/md';
import { AppointmentsCalendar } from '../components/AppointmentsCalendar';
import { RadialProgress, StackedBar, CountUp } from '../components/StatCharts';

const StatusDonut = lazy(() => import('../components/StatusDonut'));
const donutFallback = <div className="w-full h-40 flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">...</div>;
import { getLeads, getLeadsByAssignee, getEmployees } from '../services/leadsService';
import { getLabCases } from '../services/labService';
import { getAllAnnouncements, createAnnouncement, deactivateAnnouncement, deleteAnnouncement, getReads } from '../services/announcementService';
import { getMonthlyTarget, setMonthlyTarget } from '../services/targetService';
import { supabase } from '../utils/supabase/supabase';
import { useAuth } from '../context/AuthContext';
import type { Lead, Profile } from '../services/leadsService';
import type { LabCase } from '../services/labService';
import type { Announcement, AnnouncementRead, AnnouncementType } from '../services/announcementService';

const STATUSES = ['جديد', 'متابعة', 'تم حجز الموعد', 'عميل بالفعل', 'لا يرغب'];

const statusHexColors: Record<string, string> = {
  جديد:             '#3b82f6',
  متابعة:           '#eab308',
  'تم حجز الموعد':  '#22c55e',
  'عميل بالفعل':    '#a855f7',
  'لا يرغب':        '#9ca3af',
};

const labStatusHexColors: Record<string, string> = {
  'في المعمل':    '#eab308',
  'تم الاستلام':  '#22c55e',
  'أعيد للمعمل':  '#ef4444',
};

interface MonthlyTargetCardProps {
  monthlyTarget: number;
  monthlyTargetAmount: number;
  monthlyLeadsCount: number;
  targetPercentage: number;
  editable?: boolean;
  editingTarget?: boolean;
  setEditingTarget?: (v: boolean) => void;
  targetInput?: string;
  setTargetInput?: (v: string) => void;
  targetAmountInput?: string;
  setTargetAmountInput?: (v: string) => void;
  savingTarget?: boolean;
  onSave?: () => void;
}

const MonthlyTargetCard = ({
  monthlyTarget, monthlyTargetAmount, monthlyLeadsCount, targetPercentage, editable = false,
  editingTarget = false, setEditingTarget, targetInput = '', setTargetInput,
  targetAmountInput = '', setTargetAmountInput, savingTarget = false, onSave,
}: MonthlyTargetCardProps) => (
  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-8 text-white">
    <div className="flex items-stretch gap-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
        <span className="text-3xl leading-none">🎯</span>
        <h2 className="text-lg font-bold">تارقت الشهر</h2>
        {editable && !editingTarget && (
          <button onClick={() => { setTargetInput?.(String(monthlyTarget)); setTargetAmountInput?.(String(monthlyTargetAmount)); setEditingTarget?.(true); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <MdEdit className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="w-px bg-white/20" />
      <div className="flex-1">
    {editingTarget ? (
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div>
          <label className="block text-xs text-white/70 mb-1">عدد الحجوزات المستهدف</label>
          <input type="number" min="0" value={targetInput} onChange={(e) => setTargetInput?.(e.target.value)}
            className="w-28 px-3 py-2 rounded-lg text-gray-900 text-sm focus:outline-none" autoFocus />
        </div>
        <div>
          <label className="block text-xs text-white/70 mb-1">المبلغ (ر.س)</label>
          <input type="number" min="0" value={targetAmountInput} onChange={(e) => setTargetAmountInput?.(e.target.value)}
            className="w-32 px-3 py-2 rounded-lg text-gray-900 text-sm focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSave} disabled={savingTarget} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">حفظ</button>
          <button onClick={() => setEditingTarget?.(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">إلغاء</button>
        </div>
      </div>
    ) : monthlyTarget > 0 ? (
      <div>
        {monthlyTargetAmount > 0 && (
          <div className="flex flex-col items-center justify-center text-center mb-4">
            <span className="text-white/70 text-sm mb-1">المبلغ المستهدف</span>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">{monthlyTargetAmount.toLocaleString('en-US')}</span>
              <span className="text-white/70 text-lg mb-1">ر.س</span>
            </div>
          </div>
        )}
        <p className="text-white/70 text-sm mb-1">تارقت الحجز</p>
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-end gap-2">
            <CountUp value={monthlyLeadsCount} duration={1500} className="text-4xl font-bold" />
            <span className="text-white/70 text-lg mb-1">/ {monthlyTarget} حجز</span>
          </div>
          <span className="text-white/70 text-sm">{targetPercentage}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-white rounded-full animate-pulse-glow transition-all duration-700" style={{ width: `${Math.min(targetPercentage, 100)}%` }} />
        </div>
      </div>
    ) : (
      <p className="text-white/70 text-sm">لم يتم تحديد تارقت لهذا الشهر بعد</p>
    )}
      </div>
    </div>
  </div>
);

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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readsMap, setReadsMap] = useState<Record<number, AnnouncementRead[]>>({});
  const [expandedAnn, setExpandedAnn] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newType, setNewType] = useState<AnnouncementType>('alert');
  const [targetEmployees, setTargetEmployees] = useState<string[]>([]);
  const [canViewAdmin, setCanViewAdmin] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [monthlyTarget, setMonthlyTargetState] = useState(0);
  const [monthlyTargetAmount, setMonthlyTargetAmountState] = useState(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [targetAmountInput, setTargetAmountInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  const currentMonthYear = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const target = await getMonthlyTarget(currentMonthYear);
        setMonthlyTargetState(target?.target ?? 0);
        setMonthlyTargetAmountState(target?.target_amount ?? 0);

        if (user.isAdmin) {
          setCanViewAdmin(true);
          const [allLeads, emps, cases, anns] = await Promise.all([getLeads(), getEmployees(), getLabCases(), getAllAnnouncements()]);
          setLeads(allLeads);
          setEmployees(emps);
          setLabCases(cases);
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
            const [allLeads, emps, cases] = await Promise.all([getLeads(), getEmployees(), getLabCases()]);
            setLeads(allLeads);
            setEmployees(emps);
            setLabCases(cases);
          } else {
            setMyLeads(await getLeadsByAssignee(user.name));
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
      await createAnnouncement(newMessage.trim(), targetEmployees, newType);
      setAnnouncements(await getAllAnnouncements());
      setNewMessage('');
      setTargetEmployees([]);
      setNewType('alert');
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

  const handleSaveTarget = async () => {
    const value = parseInt(targetInput);
    const amountValue = parseFloat(targetAmountInput);
    if (isNaN(value) || value < 0 || isNaN(amountValue) || amountValue < 0) return;
    setSavingTarget(true);
    try {
      await setMonthlyTarget(currentMonthYear, value, amountValue);
      setMonthlyTargetState(value);
      setMonthlyTargetAmountState(amountValue);
      setEditingTarget(false);
    } catch { /* ignore */ }
    setSavingTarget(false);
  };

  // إحصائيات المعمل
  const labStatuses = ['في المعمل', 'تم الاستلام', 'أعيد للمعمل'];

  // إحصائيات الأدمن
  const totalLeads = leads.length;
  const totalDone = leads.filter((l) => l.status === 'تم حجز الموعد').length;
  const completionRate = totalLeads > 0 ? Math.round((totalDone / totalLeads) * 100) : 0;
  const leadStatusData = STATUSES.map((s) => ({ name: s, value: leads.filter((l) => l.status === s).length, color: statusHexColors[s] }));
  const labStatusData = labStatuses.map((s) => ({ name: s, value: labCases.filter((c) => c.status === s).length, color: labStatusHexColors[s] }));

  // تارقت الشهر
  const monthlyLeadsCount = leads.filter((l) => l.status === 'تم حجز الموعد' && l.created_at?.slice(0, 7) === currentMonthYear).length;
  const targetPercentage = monthlyTarget > 0 ? Math.round((monthlyLeadsCount / monthlyTarget) * 100) : 0;

  // إحصائيات الموظف
  const myTotal = myLeads.length;
  const myDone = myLeads.filter((l) => l.status === 'تم حجز الموعد').length;
  const myRate = myTotal > 0 ? Math.round((myDone / myTotal) * 100) : 0;
  const myStatusData = STATUSES.map((s) => ({ name: s, value: myLeads.filter((l) => l.status === s).length, color: statusHexColors[s] }));
  const motivation = motivationalMessages(myRate);

  if (canViewAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-8" dir="rtl">
        <div className="max-w-6xl mx-auto">
          {!loadingStats && (
            <>
              {/* تارقت الشهر */}
              <MonthlyTargetCard
                monthlyTarget={monthlyTarget}
                monthlyTargetAmount={monthlyTargetAmount}
                monthlyLeadsCount={monthlyLeadsCount}
                targetPercentage={targetPercentage}
                editable={isAdmin}
                editingTarget={editingTarget}
                setEditingTarget={setEditingTarget}
                targetInput={targetInput}
                setTargetInput={setTargetInput}
                targetAmountInput={targetAmountInput}
                setTargetAmountInput={setTargetAmountInput}
                savingTarget={savingTarget}
                onSave={handleSaveTarget}
              />

              {/* إحصائيات Leads */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-8">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">إحصائيات الـ Leads</h2>
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <Suspense fallback={donutFallback}>
                    <StatusDonut data={leadStatusData} total={totalLeads} centerLabel="إجمالي" />
                  </Suspense>
                  <RadialProgress percentage={completionRate} label="نسبة الإنجاز" color="#22c55e" />
                </div>
              </div>

              {/* أداء الفريق */}
              {employees.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-8">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">أداء الفريق</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map((emp) => {
                      const empLeads = leads.filter((l) => l.assigned_to === emp.name);
                      const empDone = empLeads.filter((l) => l.status === 'تم حجز الموعد').length;
                      const empRate = empLeads.length > 0 ? Math.round((empDone / empLeads.length) * 100) : 0;
                      const empStatusData = STATUSES.map((s) => ({ name: s, value: empLeads.filter((l) => l.status === s).length, color: statusHexColors[s] }));
                      return (
                        <div key={emp.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-right">
                          <div className="flex items-start justify-between mb-4">
                            <div><p className="font-bold text-gray-900 dark:text-white">{emp.name}</p><p className="text-xs text-gray-400 dark:text-gray-500">{empLeads.length} lead</p></div>
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg border border-green-100 dark:border-green-800">{empRate}% إنجاز</span>
                          </div>
                          <div className="flex gap-3 flex-wrap mb-3">
                            {empStatusData.filter((d) => d.value > 0).map((d) => (
                              <span key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                {d.name}: <span className="font-bold text-gray-900 dark:text-white">{d.value}</span>
                              </span>
                            ))}
                          </div>
                          <StackedBar data={empStatusData} total={empLeads.length} />
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
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                  <Suspense fallback={donutFallback}>
                    <StatusDonut data={labStatusData} total={labCases.length} centerLabel="إجمالي" />
                  </Suspense>
                </div>
              </div>

          {/* إدارة الإشعارات — للأدمن فقط */}
          {isAdmin && showAnnouncementsModal &&
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setShowAnnouncementsModal(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <MdClose className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">إرسال إشعار للموظفين</h3>
                <MdCampaign className="w-5 h-5 text-red-500" />
              </div>
            </div>

            {/* نموذج الإشعار */}
            <div className="space-y-3 mb-5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewType('alert')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    newType === 'alert'
                      ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                      : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                  }`}
                >
                  <MdCampaign className="w-4 h-4" /> تنبيه عام
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('celebration')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    newType === 'celebration'
                      ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700'
                      : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                  }`}
                >
                  <MdCelebration className="w-4 h-4" /> تهنئة / احتفال
                </button>
              </div>
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
                        <p className={`font-medium flex items-center gap-1.5 justify-end ${a.is_active ? 'text-red-800 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'}`}>
                          {a.message}
                          {a.type === 'celebration' && <MdCelebration className="w-4 h-4 text-purple-500 flex-shrink-0" />}
                        </p>
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
          </div>
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
              {isAdmin && (
                <button onClick={() => navigate('/permissions')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all text-right group">
                  <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdAdminPanelSettings className="text-white text-xl" /></div></div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">صلاحيات الموظفين</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">تحكم بصلاحيات كل موظف من مكان واحد</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowAnnouncementsModal(true)} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-red-200 dark:hover:border-red-700 transition-all text-right group">
                  <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdCampaign className="text-white text-xl" /></div></div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">الإشعارات</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">إرسال إشعارات للموظفين ومتابعة من اطلع عليها</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
                </button>
              )}
              {isAdmin && (
                <button onClick={() => navigate('/doctors')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-cyan-200 dark:hover:border-cyan-700 transition-all text-right group">
                  <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdMedicalServices className="text-white text-xl" /></div></div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">فريق الأطباء</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">إدارة قائمة الأطباء في العيادة</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
                </button>
              )}
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
        {!loadingStats && (
          <>
            {/* تارقت الشهر */}
            <MonthlyTargetCard
              monthlyTarget={monthlyTarget}
              monthlyTargetAmount={monthlyTargetAmount}
              monthlyLeadsCount={monthlyLeadsCount}
              targetPercentage={targetPercentage}
            />

            {/* داشبورد الموظف */}
            <div className="mb-8">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl p-6 mb-6 text-white text-right">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-sm mb-1">مرحباً {userName}</p>
                    <p className="text-xl font-bold">{motivation.text}</p>
                  </div>
                  <span className="text-5xl">{motivation.emoji}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <Suspense fallback={donutFallback}>
                    <StatusDonut data={myStatusData} total={myTotal} centerLabel="إجمالي" />
                  </Suspense>
                  <div className="flex flex-col items-center gap-2">
                    <RadialProgress percentage={myRate} label="نسبة إنجازك" color="#22c55e" />
                    <div className="flex justify-between gap-4 text-xs text-gray-400 dark:text-gray-500">
                      <span>منجز: {myDone}</span>
                      <span>متبقي: {myTotal - myDone}</span>
                    </div>
                  </div>
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
            <button onClick={() => navigate('/leave')} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-700 transition-all text-right group">
              <div className="mb-4"><div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow"><MdAssignment className="text-white text-xl" /></div></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">طلبات الإجازة المرضية</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">استقبال المرضى</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg text-sm font-medium">افتح الآن<FiArrowLeft className="w-4 h-4" /></div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
