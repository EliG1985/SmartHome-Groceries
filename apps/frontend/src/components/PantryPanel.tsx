import { useState } from 'react';
import { getExpiryTone } from '../store/slices/inventorySlice';
import type { InventoryItem } from '../types/domain';
import { useLanguage } from '../lib/i18n';

interface PantryPanelProps {
  items: InventoryItem[];
  onMoveToList: (id: string) => void;
  onEdit: (item: InventoryItem) => void;
}

export function PantryPanel({ items, onMoveToList, onEdit }: PantryPanelProps) {
  const { t } = useLanguage();
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);

  const toggleExpanded = (id: string) => {
    setExpandedItemIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">{t('home.title')}</h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const tone = getExpiryTone(item.expiry_date);
          const toneClass =
            tone === 'expired'
              ? 'border-red-300 bg-red-50'
              : tone === 'warning'
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-slate-50/70';

          return (
            <li key={item.id} className={`rounded-xl border p-3 ${toneClass}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{item.product_name}</p>
                  <p className="text-xs text-slate-600">{t('home.expires', { date: item.expiry_date })}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    onClick={() => toggleExpanded(item.id)}
                  >
                    {expandedItemIds.includes(item.id) ? t('home.collapse') : t('home.details')}
                  </button>
                  <button
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                    onClick={() => onEdit(item)}
                  >
                    {t('home.edit')}
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    onClick={() => onMoveToList(item.id)}
                  >
                    {t('home.moveToList')}
                  </button>
                </div>
              </div>

              {expandedItemIds.includes(item.id) && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
                  <p>
                    <span className="font-medium text-slate-700">{t('common.category')}:</span> {item.category}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">{t('common.quantity')}:</span> {item.quantity}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">{t('common.price')}:</span> ₪{item.price.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">{t('common.barcode')}:</span> {item.barcode || t('common.na')}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">{t('common.status')}:</span>{' '}
                    {item.status === 'At_Home' ? t('common.atHome') : t('common.shoppingList')}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!items.length && <p className="text-sm text-slate-500">{t('home.noInventory')}</p>}
    </section>
  );
}
