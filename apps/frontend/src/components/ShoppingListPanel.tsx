import { useState } from 'react';
import type { InventoryItem } from '../types/domain';
import { useLanguage } from '../lib/i18n';

interface ShoppingListPanelProps {
  items: InventoryItem[];
  onMarkPurchased: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: InventoryItem) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => void;
  onBuySelected: () => void;
}

export function ShoppingListPanel({
  items,
  onMarkPurchased,
  onDelete,
  onEdit,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteSelected,
  onBuySelected,
}: ShoppingListPanelProps) {
  const { t } = useLanguage();
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);
  const selectedCount = selectedIds.length;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const groupedByCategory = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const toggleExpanded = (id: string) => {
    setExpandedItemIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            aria-label={t('shopping.selectAllProducts')}
            checked={allSelected}
            onChange={onToggleSelectAll}
            disabled={!items.length}
          />
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t('shopping.title')}</h2>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
            {t('shopping.total', { total: totalPrice.toFixed(2) })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 1 && (
            <>
              <button
                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                onClick={onDeleteSelected}
              >
                {t('shopping.deleteAll')}
              </button>
              <button
                className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700"
                onClick={onBuySelected}
              >
                {t('shopping.buyAll')}
              </button>
            </>
          )}
        </div>
      </div>
      {Object.entries(groupedByCategory).map(([category, categoryItems]) => (
        <div key={category} className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{category}</h3>
          <ul className="space-y-2">
            {categoryItems.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label={`Select ${item.product_name}`}
                      checked={selectedIds.includes(item.id)}
                      onChange={() => onToggleSelect(item.id)}
                    />
                    <div>
                      <p className="font-medium text-slate-900">{item.product_name}</p>
                      <p className="text-xs text-slate-500">
                        {t('shopping.qtyPrice', { quantity: item.quantity, price: item.price.toFixed(2) })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      {expandedItemIds.includes(item.id) ? t('shopping.collapse') : t('shopping.details')}
                    </button>
                    <button
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                      onClick={() => onEdit(item)}
                    >
                      {t('shopping.edit')}
                    </button>
                    <button
                      className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700"
                      onClick={() => onMarkPurchased(item.id)}
                    >
                      {t('shopping.purchased')}
                    </button>
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      onClick={() => onDelete(item.id)}
                    >
                      {t('shopping.delete')}
                    </button>
                  </div>
                </div>

                {expandedItemIds.includes(item.id) && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
                    <p>
                      <span className="font-medium text-slate-700">{t('common.category')}:</span> {item.category}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">{t('common.expiryDate')}:</span> {item.expiry_date}
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
            ))}
          </ul>
        </div>
      ))}
      {!items.length && <p className="text-sm text-slate-500">{t('shopping.noProducts')}</p>}
    </section>
  );
}
