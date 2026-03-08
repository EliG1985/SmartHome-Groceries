import { useState } from 'react';
import { Barcode, CalendarDays, CircleDollarSign, ListChecks, Package, Shapes, ShoppingBag } from 'lucide-react';
import { backendMode, getSupermarketProductPrice } from '../lib/api';
import { fetchProductNameByBarcode } from '../lib/openFoodFacts';
import { BarcodeScanner } from './BarcodeScanner';
import { HistoryInput } from './HistoryInput';
import { useLanguage } from '../lib/i18n';

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  supermarket: string;
  onCreate: (payload: {
    product_name: string;
    category: string;
    expiry_date: string;
    quantity: number;
    price: number;
    barcode?: string;
    status: 'In_List' | 'At_Home';
  }) => void;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function supermarketFactor(supermarketName: string): number {
  const normalized = supermarketName.toLowerCase();
  if (normalized.includes('rami')) return 0.96;
  if (normalized.includes('yochan')) return 0.97;
  if (normalized.includes('victory')) return 0.98;
  if (normalized.includes('carrefour')) return 1.02;
  if (normalized.includes('shufersal')) return 1.03;
  return 1;
}

export function AddItemModal({ open, onClose, supermarket, onCreate }: AddItemModalProps) {
  const { t } = useLanguage();
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('General');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [priceInput, setPriceInput] = useState('');
  const [status, setStatus] = useState<'In_List' | 'At_Home'>('In_List');
  const [barcode, setBarcode] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const resetForm = () => {
    setProductName('');
    setCategory('General');
    setExpiryDate('');
    setQuantity(1);
    setPriceInput('');
    setBarcode('');
    setShowScanner(false);
  };

  const getDefaultExpiryDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  };

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!productName.trim()) return;
    const parsedPrice = Number(priceInput || '0');

    onCreate({
      product_name: productName.trim(),
      category,
      expiry_date: expiryDate,
      quantity,
      price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      barcode: barcode || undefined,
      status,
    });

    onClose();
    resetForm();
  };

  const onBarcodeDetected = async (value: string) => {
    setBarcode(value);
    const product = await fetchProductNameByBarcode(value);

    const resolvedProductName = product || t('add.scannedItem', { code: value.slice(-6) });
    const resolvedExpiryDate = expiryDate || getDefaultExpiryDate();
    const currentPrice = Number(priceInput || '0');

    let resolvedPrice = Number.isFinite(currentPrice) ? currentPrice : 0;
    try {
      if (backendMode) {
        const pricing = await getSupermarketProductPrice({
          supermarket,
          productName: resolvedProductName,
          barcode: value,
          fallbackPrice: resolvedPrice,
        });
        resolvedPrice = pricing.liveUnitPrice;
      } else {
        const seed = hashString(`${supermarket}:${resolvedProductName}:${value}`);
        const syntheticBase = resolvedPrice > 0 ? resolvedPrice : 8 + (seed % 300) / 20;
        const variation = ((seed % 9) - 4) / 100;
        resolvedPrice = Number((syntheticBase * supermarketFactor(supermarket) * (1 + variation)).toFixed(2));
      }
    } catch {
      const seed = hashString(`${supermarket}:${resolvedProductName}:${value}`);
      const syntheticBase = resolvedPrice > 0 ? resolvedPrice : 8 + (seed % 300) / 20;
      const variation = ((seed % 9) - 4) / 100;
      resolvedPrice = Number((syntheticBase * supermarketFactor(supermarket) * (1 + variation)).toFixed(2));
    }

    setPriceInput(resolvedPrice.toFixed(2));

    onCreate({
      product_name: resolvedProductName,
      category,
      expiry_date: resolvedExpiryDate,
      quantity,
      price: resolvedPrice,
      barcode: value,
      status: 'In_List',
    });

    onClose();
    resetForm();
    setShowScanner(false);
  };

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t('add.title')}</h2>
        <div className="relative">
          <Package className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <HistoryInput
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder={t('add.productName')}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
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
              onChange={(e) => setCategory(e.target.value)}
              historyKey="product-category"
            />
          </div>
          <div className="relative">
            <Barcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <HistoryInput
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder={t('add.barcode')}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
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
              onChange={(e) => setQuantity(Number(e.target.value))}
              historyKey="product-quantity"
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
              onChange={(e) => setPriceInput(e.target.value)}
              historyKey="product-price"
            />
          </div>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <ShoppingBag className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'In_List' | 'At_Home')}
            >
              <option value="In_List">{t('common.shoppingList')}</option>
              <option value="At_Home">{t('common.atHome')}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={() => setShowScanner((current) => !current)}
          >
            {showScanner ? t('add.closeScanner') : t('add.scanAndAdd')}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            {t('add.save')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={onClose}
          >
            {t('add.cancel')}
          </button>
        </div>

        {showScanner && <BarcodeScanner onDetected={onBarcodeDetected} />}
      </form>
    </div>
  );
}
