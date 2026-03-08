import { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { format, subMonths } from 'date-fns';
import type { InventoryItem } from '../types/domain';
import { useLanguage } from '../lib/i18n';

const COLORS = ['#4f46e5', '#0ea5e9', '#16a34a', '#f59e0b', '#dc2626', '#a855f7'];

interface ReportsPanelProps {
  listItems: InventoryItem[];
  allItems: InventoryItem[];
}

export function ReportsPanel({ listItems, allItems }: ReportsPanelProps) {
  const { t } = useLanguage();
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 260 });

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(260, Math.floor(rect.height || 260));
      setChartSize({ width, height });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const byCategory = Object.entries(
    listItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.price * item.quantity;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const thisMonth = format(new Date(), 'yyyy-MM');
  const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

  const totalThisMonth = allItems
    .filter((item) => (item.purchased_at || item.created_at || '').startsWith(thisMonth))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const totalLastMonth = allItems
    .filter((item) => (item.purchased_at || item.created_at || '').startsWith(lastMonth))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t('reports.title')}</h2>
      <div ref={chartContainerRef} className="h-64 min-h-[260px] min-w-0 w-full">
        {chartSize.width > 0 && (
          <PieChart width={chartSize.width} height={chartSize.height}>
            <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label>
              {byCategory.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
          <p className="text-sm text-indigo-700">{t('reports.currentMonth')}</p>
          <p className="text-xl font-semibold text-indigo-900">₪{totalThisMonth.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm text-slate-600">{t('reports.previousMonth')}</p>
          <p className="text-xl font-semibold text-slate-900">₪{totalLastMonth.toFixed(2)}</p>
        </div>
      </div>
    </section>
  );
}
