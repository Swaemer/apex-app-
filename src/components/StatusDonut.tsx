import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { ChartDatum } from './StatCharts';

interface StatusDonutProps {
  data: ChartDatum[];
  total: number;
  centerLabel?: string;
}

const StatusDonut = ({ data, total, centerLabel }: StatusDonutProps) => {
  const visible = data.filter((d) => d.value > 0);
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 w-full">
      <div className="relative w-40 h-40 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={visible.length ? visible : [{ name: '', value: 1, color: '#e5e7eb' }]} dataKey="value" nameKey="name"
              innerRadius="65%" outerRadius="100%" paddingAngle={visible.length > 1 ? 2 : 0} startAngle={90} endAngle={-270}>
              {(visible.length ? visible : [{ name: '', value: 1, color: '#e5e7eb' }]).map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            {visible.length > 0 && (
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 8, fontSize: 12 }} />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{total}</span>
          {centerLabel && <span className="text-xs text-gray-400 dark:text-gray-500">{centerLabel}</span>}
        </div>
      </div>
      <div className="flex-1 w-full space-y-2">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-gray-600 dark:text-gray-300">{d.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white">{d.value}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-left">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusDonut;
