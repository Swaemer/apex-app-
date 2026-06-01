import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { MdLeaderboard } from 'react-icons/md';
import { getLeads, getEmployees } from '../services/leadsService';
import { useAuth } from '../context/AuthContext';
import type { Lead, Profile } from '../services/leadsService';

const STATUSES = ['جديد', 'متابعة', 'مبيعة'];

const statusColors: Record<string, string> = {
  جديد: 'bg-blue-50 text-blue-700 border-blue-200',
  متابعة: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  مبيعة: 'bg-green-50 text-green-700 border-green-200',
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
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const allLeads = await getLeads();
        if (user.isAdmin) {
          setLeads(allLeads);
          const emps = await getEmployees();
          setEmployees(emps);
        } else {
          setMyLeads(allLeads.filter((l) => l.assigned_to === user.name));
        }
      } catch { /* profiles قد لا تكون جاهزة */ }
      setLoadingStats(false);
    };
    fetchData();
  }, [user]);

  // إحصائيات الأدمن
  const totalLeads = leads.length;
  const totalDone = leads.filter((l) => l.status === 'مبيعة').length;
  const completionRate = totalLeads > 0 ? Math.round((totalDone / totalLeads) * 100) : 0;

  // إحصائيات الموظف
  const myTotal = myLeads.length;
  const myDone = myLeads.filter((l) => l.status === 'مبيعة').length;
  const myRate = myTotal > 0 ? Math.round((myDone / myTotal) * 100) : 0;
  const motivation = motivationalMessages(myRate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">لوحة التحكم</h1>
          <p className="text-gray-500">مرحباً بك في Apex Dashboard</p>
        </div>

        {/* ======== داشبورد الأدمن ======== */}
        {isAdmin && !loadingStats && (
          <>
            {/* إحصائيات عامة */}
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
                    <p className="text-xs text-gray-400 mt-1">
                      {totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0}%
                    </p>
                  </div>
                );
              })}
            </div>

            {/* نسبة الإنجاز الكلية */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">نسبة الإنجاز الكلية</span>
                <span className="text-2xl font-bold text-green-600">{completionRate}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            {/* أداء الفريق */}
            {employees.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">أداء الفريق</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map((emp) => {
                    const empLeads = leads.filter((l) => l.assigned_to === emp.name);
                    const empDone = empLeads.filter((l) => l.status === 'مبيعة').length;
                    const empRate = empLeads.length > 0 ? Math.round((empDone / empLeads.length) * 100) : 0;
                    return (
                      <div key={emp.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-right">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                            {empRate}% إنجاز
                          </span>
                          <div>
                            <p className="font-bold text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-400">{empLeads.length} lead</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap mb-4">
                          {STATUSES.map((s) => {
                            const cnt = empLeads.filter((l) => l.status === s).length;
                            return (
                              <span key={s} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusColors[s]}`}>
                                {s}: {cnt}
                              </span>
                            );
                          })}
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-700"
                            style={{ width: `${empRate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ======== داشبورد الموظف ======== */}
        {!isAdmin && !loadingStats && (
          <div className="mb-8">
            {/* رسالة تحفيزية */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl p-6 mb-6 text-white text-right">
              <div className="flex items-center justify-between">
                <span className="text-5xl">{motivation.emoji}</span>
                <div>
                  <p className="text-white/70 text-sm mb-1">مرحباً {userName}</p>
                  <p className="text-xl font-bold">{motivation.text}</p>
                </div>
              </div>
            </div>

            {/* إحصائيات الموظف */}
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

            {/* شريط تقدم الموظف */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-green-600">{myRate}%</span>
                <span className="text-sm font-medium text-gray-600">نسبة إنجازك</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(myRate, 5)}%` }}
                >
                  {myRate > 10 && (
                    <span className="text-white text-xs font-bold">{myRate}%</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>منجز: {myDone}</span>
                <span>متبقي: {myTotal - myDone}</span>
              </div>
            </div>
          </div>
        )}

        {/* القائمة */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">القائمة الرئيسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button
              onClick={() => navigate('/leads')}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 hover:shadow-lg hover:border-slate-300 transition-all text-right group"
            >
              <div className="mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow">
                  <MdLeaderboard className="text-white text-xl" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">إدارة العملاء المحتملين</h3>
              <p className="text-gray-600 text-sm mb-4">إدارة وتتبع العملاء المحتملين</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium group-hover:gap-3 transition-all">
                افتح الآن
                <FiArrowLeft className="w-4 h-4" />
              </div>
            </button>

            <div className="bg-gray-50 rounded-2xl border border-gray-200 border-dashed p-8 text-right opacity-40">
              <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">قادم قريباً</h3>
              <p className="text-gray-500 text-sm">ميزات جديدة قيد الإعداد</p>
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-200 border-dashed p-8 text-right opacity-40">
              <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">قادم قريباً</h3>
              <p className="text-gray-500 text-sm">ميزات جديدة قيد الإعداد</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
