import { useEffect, useState } from 'react';
import { Barcode, CalendarDays, CircleDollarSign, ListChecks, Package, Shapes } from 'lucide-react';
import type { InventoryItem } from '../types/domain';
import { useLanguage } from '../lib/i18n';
import { HistoryInput } from './HistoryInput';

interface EditItemModalProps {
  open: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (payload: {
    product_name: string;
    category: string;
    barcode?: string;
    expiry_date: string;
    quantity: number;
    price: number;
  }) => void;
}

export function EditItemModal({ open, item, onClose, onSave }: EditItemModalProps) {
  const { t } = useLanguage();
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('General');
  const [barcode, setBarcode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [priceInput, setPriceInput] = useState('');

  useEffect(() => {
    if (!item) return;
    setProductName(item.product_name);
    setCategory(item.category);
    setBarcode(item.barcode || '');
    setExpiryDate(item.expiry_date);
    setQuantity(item.quantity);
    setPriceInput(String(item.price));
  }, [item]);

  if (!open || !item) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedPrice = Number(priceInput || '0');

    onSave({
      product_name: productName.trim(),
      category: category.trim() || 'General',
      barcode: barcode.trim() || undefined,
      expiry_date: expiryDate,
      quantity,
      price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t('edit.title')}</h2>

        <div className="relative">
          <Package className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <HistoryInput
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder={t('add.productName')}
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            historyKey="product-name"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Shapes className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <HistoryInput
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder={t('add.category')}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              historyKey="product-category"
              required
            />
          </div>
          <div className="relative">
            <Barcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <HistoryInput
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder={t('add.barcode')}
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              historyKey="product-barcode"
            />
          </div>
          <div className="relative">
            <ListChecks className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <HistoryInput
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              type="number"
              min="1"
              placeholder={t('add.quantity')}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              historyKey="product-quantity"
              required
            />
          </div>
          <div className="relative">
            <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <HistoryInput
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              type="number"
              min="0"
              step="0.1"
              placeholder={t('add.price')}
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              historyKey="product-price"
              required
            />
          </div>
          <div className="relative col-span-2">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            {t('edit.saveChanges')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={onClose}
          >
            {t('edit.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
