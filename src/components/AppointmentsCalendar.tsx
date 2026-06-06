import { useState, useMemo } from 'react';
import { MdChevronLeft, MdChevronRight, MdAccessTime, MdPerson } from 'react-icons/md';
import type { Lead } from '../services/leadsService';

interface Props {
  leads: Lead[];
}

const ARABIC_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];
const DAYS = ['أحد','اثن','ثلا','أرب','خمس','جمع','سبت'];

export const AppointmentsCalendar = ({ leads }: Props) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(
    today.toISOString().split('T')[0]
  );

  const appointments = useMemo(() =>
    leads.filter((l) => l.appointment_at && l.status === 'تم حجز الموعد'),
    [leads]
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-bold">
                        <MdAccessTime className="w-3.5 h-3.5" />
                        {(() => {
                  const hour = parseInt(l.appointment_at!.split('T')[1]?.substring(0, 2) ?? '0');
                  return hour === 0 ? '12:00 ص' : hour < 12 ? `${hour}:00 ص` : hour === 12 ? '12:00 م' : `${hour - 12}:00 م`;
                })()}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white text-sm">{l.name}</span>
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
