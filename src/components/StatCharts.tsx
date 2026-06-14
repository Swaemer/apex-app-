import { useEffect, useRef, useState } from 'react';

export interface ChartDatum {
  name: string;
  value: number;
  color: string;
}

interface RadialProgressProps {
  percentage: number;
  label: string;
  color?: string;
  size?: number;
}

export const RadialProgress = ({ percentage, label, color = '#22c55e', size = 128 }: RadialProgressProps) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-gray-100 dark:stroke-gray-700" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{clamped}%</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      </div>
    </div>
  );
};

interface StackedBarProps {
  data: ChartDatum[];
  total: number;
}

export const StackedBar = ({ data, total }: StackedBarProps) => (
  <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-700">
    {data.map((d) =>
      total > 0 && d.value > 0 ? (
        <div key={d.name} title={`${d.name}: ${d.value}`} style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }} />
      ) : null
    )}
  </div>
);

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
}

export const CountUp = ({ value, duration = 1500, className }: CountUpProps) => {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const wobbleInterval = 100;
    let lastWobble = 0;

    let frame: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      if (progress < 1) {
        // تأثير تردد: يقفز بين أرقام قريبة كأنه يحتار قبل أن يستقر
        if (elapsed - lastWobble >= wobbleInterval) {
          lastWobble = elapsed;
          const amplitude = Math.max(Math.abs(value - from), 3) * (1 - progress);
          const wobble = Math.round((Math.random() * 2 - 1) * amplitude);
          setDisplay(Math.max(0, value + wobble));
        }
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        fromRef.current = value;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={className}>{display}</span>;
};
