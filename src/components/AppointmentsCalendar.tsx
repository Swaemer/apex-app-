import { useState, useMemo } from 'react';
import { MdChevronLeft, MdChevronRight, MdAccessTime, MdPerson, MdContentCopy, MdCheck } from 'react-icons/md';
import { toast } from 'react-hot-toast';
import type { Lead } from '../services/leadsService';
import { updateLeadStatus } from '../services/leadsService';

interface Props {
  leads: Lead[];
}

const ARABIC_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];
const DAYS = ['أحد','اثن','ثلا','أرب','خمس','جمع','سبت'];

const formatTime = (appointmentAt: string) => {
  const [h, m] = (appointmentAt.split('T')[1] ?? '00:00').split(':');
  const hour = parseInt(h ?? '0');
  const min = m ?? '00';
  if (hour === 0) return `12:${min} ص`;
  if (hour < 12) return `${hour}:${min} ص`;
  if (hour === 12) return `12:${min} م`;
  return `${hour - 12}:${min} م`;
};

const buildAppointmentMessage = (l: Lead) => {
  const date = new Date(l.appointment_at! + (l.appointment_at!.includes('T') ? '' : 'T12:00:00'))
    .toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = formatTime(l.appointment_at!);
  return [
    `تأكيد موعد في عيادة صفوة أمينة`,
    ``,
    `نؤكد موعدكم بتاريخ ${date} الساعة ${time}.`,
    `نرجو التواجد قبل الموعد بـ 10 دقائق. في حال الرغبة في تعديل الموعد، نرجو إبلاغنا مسبقاً.`,
  ].join('\n');
};

export const AppointmentsCalendar = ({ leads }: Props) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(
    today.toISOString().split('T')[0]
  );
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads);

  const appointments = useMemo(() =>
    localLeads.filter((l) => l.appointment_at && ['تم حجز الموعد', 'تم ارسال تذكير الواتساب', 'حضر', 'حضر ودفع', 'لم يحضر'].includes(l.status)),
    [localLeads]
  );

  const byDay = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    appointments.forEach((l) => {
      const day = l.appointment_at!.split('T')[0];
      if (!map[day]) map[day] = [];
      map[day].push(l);
    });
    return map;
  }, [appointments]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const selectedLeads = selectedDay ? (byDay[selectedDay] ?? []) : [];

  const todayStr = today.toISOString().split('T')[0];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">الحجوزات</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* التقويم */}
        <div>
          {/* رأس التقويم */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <MdChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <p className="font-bold text-gray-900 dark:text-white">{ARABIC_MONTHS[month]} {year}</p>
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <MdChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* أيام الأسبوع */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
            ))}
          </div>

          {/* أيام الشهر */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDay;
              const hasApp = !!byDay[dateStr];
              const count = byDay[dateStr]?.length ?? 0;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(dateStr)}
                  className={`relative aspect-square rounded-xl text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5
                    ${isSelected ? 'bg-slate-700 text-white shadow-md' :
                      isToday ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-bold' :
                      hasApp ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50' :
                      'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  <span>{day}</span>
                  {hasApp && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                  {hasApp && isSelected && (
                    <span className="text-xs text-white/80">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ملخص الشهر */}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> يوم فيه حجز</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-700 inline-block" /> اليوم المحدد</span>
          </div>
        </div>

        {/* قائمة الحجوزات لليوم المحدد */}
        <div>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">
            {selectedDay
              ? `حجوزات ${new Date(selectedDay + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' })}`
              : 'اختر يوماً'}
          </p>
          {selectedLeads.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedLeads
                .sort((a, b) => new Date(a.appointment_at!).getTime() - new Date(b.appointment_at!).getTime())
                .map((l) => (
                  <div key={l.id} className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-3 text-right">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">{l.name}</span>
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-bold">
                        <MdAccessTime className="w-3.5 h-3.5" />
                        {formatTime(l.appointment_at!)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{l.phone || '—'}</span>
                      {l.assigned_to && (
                        <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-lg">
                          <MdPerson className="w-3 h-3" />{l.assigned_to}
                        </span>
                      )}
                    </div>
                    {l.service && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{l.service}</p>}
                    {l.doctor && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-xs text-cyan-600 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 rounded-lg font-medium">
                          🩺 {l.doctor}
                        </span>
                      </div>
                    )}
                    {l.status === 'تم ارسال تذكير الواتساب' ? (
                      <div className="mt-2 w-full py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                        <MdCheck className="w-3.5 h-3.5 text-green-500" />
                        تم إرسال التذكير
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          navigator.clipboard.writeText(buildAppointmentMessage(l));
                          try {
                            await updateLeadStatus(l.id, 'تم ارسال تذكير الواتساب');
                            setLocalLeads((prev) => prev.map((x) => x.id === l.id ? { ...x, status: 'تم ارسال تذكير الواتساب' } : x));
                            toast.success('تم النسخ وتحديث الحالة');
                          } catch {
                            toast.success('تم نسخ رسالة التأكيد');
                          }
                        }}
                        className="mt-2 w-full py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MdContentCopy className="w-3.5 h-3.5" />
                        نسخ تأكيد الموعد للواتساب
                      </button>
                    )}
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        onClick={async () => {
                          try {
                            await updateLeadStatus(l.id, 'حضر');
                            setLocalLeads((prev) => prev.map((x) => x.id === l.id ? { ...x, status: 'حضر' } : x));
                            toast.success('تم تسجيل الحضور');
                          } catch { toast.error('خطأ في التحديث'); }
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                          l.status === 'حضر'
                            ? 'bg-blue-500 text-white cursor-default'
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        }`}
                        disabled={l.status === 'حضر'}
                      >
                        {l.status === 'حضر' ? <MdCheck className="w-3.5 h-3.5" /> : null}
                        حضر
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await updateLeadStatus(l.id, 'حضر ودفع');
                            setLocalLeads((prev) => prev.map((x) => x.id === l.id ? { ...x, status: 'حضر ودفع' } : x));
                            toast.success('تم تسجيل الحضور والدفع');
                          } catch { toast.error('خطأ في التحديث'); }
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                          l.status === 'حضر ودفع'
                            ? 'bg-emerald-500 text-white cursor-default'
                            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        }`}
                        disabled={l.status === 'حضر ودفع'}
                      >
                        {l.status === 'حضر ودفع' ? <MdCheck className="w-3.5 h-3.5" /> : null}
                        حضر ودفع
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await updateLeadStatus(l.id, 'لم يحضر');
                            setLocalLeads((prev) => prev.map((x) => x.id === l.id ? { ...x, status: 'لم يحضر' } : x));
                            toast.success('تم تسجيل الغياب');
                          } catch { toast.error('خطأ في التحديث'); }
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                          l.status === 'لم يحضر'
                            ? 'bg-red-500 text-white cursor-default'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                        }`}
                        disabled={l.status === 'لم يحضر'}
                      >
                        لم يحضر
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">لا توجد حجوزات هذا اليوم</p>
            </div>
          )}

          {/* إجمالي الحجوزات للشهر */}
          {appointments.filter((l) => {
            const d = new Date(l.appointment_at!);
            return d.getFullYear() === year && d.getMonth() === month;
          }).length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                إجمالي حجوزات {ARABIC_MONTHS[month]}:
                <span className="font-bold text-gray-800 dark:text-gray-200 mr-1">
                  {appointments.filter((l) => {
                    const d = new Date(l.appointment_at!);
                    return d.getFullYear() === year && d.getMonth() === month;
                  }).length}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
