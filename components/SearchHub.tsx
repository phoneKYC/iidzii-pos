import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Package, Hash, Truck, User, ShoppingCart, ScanLine, Boxes, Star,
  ExternalLink, DollarSign, Calendar, Tag, ArrowRight, RotateCcw,
  X, CheckCircle, AlertCircle, Trash2, Edit2, FileText, Camera, Printer
} from 'lucide-react';
import { Product, Customer, Sale, AppSettings, Supplier, User as AuthUser, CartItem } from '../types';
import { BarcodeScanner } from './BarcodeScanner';

interface SearchHubProps {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  suppliers: Supplier[];
  settings: AppSettings;
  onAddToCart: (p: Product) => void;
  onNavigateToTab: (tab: string, itemId?: string) => void;
  t?: any;
  setSales?: React.Dispatch<React.SetStateAction<Sale[]>>;
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  currentUser?: AuthUser;
}

export const SearchHub: React.FC<SearchHubProps> = ({
  products, customers, sales, suppliers, settings, onAddToCart, onNavigateToTab, t = {},
  setSales, setProducts, currentUser
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'products' | 'customers' | 'sales' | 'suppliers'>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState<{ [key: string]: number }>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnSuccess, setReturnSuccess] = useState(false);
  const isRTL = settings.interfaceLanguage === 'ar';
  const cur = settings.currency;

  // Check for selected item from navigation
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.itemId) {
        const sale = sales.find(s => s.id === e.detail.itemId);
        if (sale) { setSelectedSale(sale); setQuery(sale.id); }
        localStorage.removeItem('selectedItem');
      }
    };
    window.addEventListener('itemSelected', handler as any);
    return () => window.removeEventListener('itemSelected', handler as any);
  }, [sales]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return { products: [], customers: [], sales: [], suppliers: [] };
    const q = query.toLowerCase().trim();
    return {
      products: products.filter(p => p.name.toLowerCase().includes(q) || p.barcode === query || p.barcode.includes(q) || p.category.toLowerCase().includes(q)),
      customers: customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email && c.email.toLowerCase().includes(q))),
      sales: sales.filter(s => s.id.toLowerCase().includes(q) || (s.customerName && s.customerName.toLowerCase().includes(q)) || s.items.some(i => i.name.toLowerCase().includes(q))),
      suppliers: suppliers.filter(s => s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.productType.toLowerCase().includes(q))
    };
  }, [query, products, customers, sales, suppliers]);

  const totalResults = Object.values(searchResults).reduce((a, b) => a + b.length, 0);

  const handleQRScan = (code: string) => {
    setIsScannerOpen(false);
    try {
      const data = JSON.parse(code);
      if (data.invoiceId) {
        const sale = sales.find(s => s.id === data.invoiceId);
        if (sale) { setSelectedSale(sale); setQuery(data.invoiceId); setActiveCategory('sales'); }
        else setQuery(data.invoiceId);
        return;
      }
    } catch {}
    // Try as barcode
    setQuery(code);
  };

  const openReturnModal = (sale: Sale) => {
    setSelectedSale(sale);
    // تهيئة الكميات مع مراعاة ما تم إرجاعه سابقاً
    const initialReturn: { [key: string]: number } = {};
    sale.items.forEach(item => {
      const alreadyReturned = sale.returnInfo?.returnedItems
        ?.filter(ri => ri.id === item.id)
        .reduce((s, ri) => s + ri.quantity, 0) || 0;
      initialReturn[item.id] = 0;
      // نحفظ الكمية المتبقية القابلة للإرجاع
      (initialReturn as any)[`__max_${item.id}`] = Math.max(0, item.quantity - alreadyReturned);
    });
    setReturnItems(initialReturn);
    setReturnReason('');
    setReturnSuccess(false);
    setShowReturnModal(true);
  };

  // حساب المبلغ المسترد
  const refundAmount = selectedSale
    ? selectedSale.items.reduce((sum, item) => {
        return sum + (item.price * (returnItems[item.id] || 0));
      }, 0)
    : 0;

  const handleReturn = () => {
    if (!selectedSale || !setSales || !setProducts) return;
    const returnedItems: CartItem[] = selectedSale.items
      .filter(item => returnItems[item.id] > 0)
      .map(item => ({ ...item, quantity: returnItems[item.id] }));

    if (returnedItems.length === 0) return;

    // دمج المرتجعات السابقة مع الجديدة
    const prevReturned = selectedSale.returnInfo?.returnedItems || [];
    const mergedReturned = [...prevReturned];
    returnedItems.forEach(ri => {
      const existing = mergedReturned.find(p => p.id === ri.id);
      if (existing) existing.quantity += ri.quantity;
      else mergedReturned.push({ ...ri });
    });

    // هل كل كميات كل صنف مرتجعة الآن؟
    const isFullReturn = selectedSale.items.every(orig => {
      const totalRet = mergedReturned.find(r => r.id === orig.id)?.quantity || 0;
      return totalRet >= orig.quantity;
    });

    const updatedSale: Sale = {
      ...selectedSale,
      status: isFullReturn ? 'returned' : 'partial_return',
      returnInfo: {
        returnedAt: Date.now(),
        returnedBy: currentUser?.id || '',
        returnedItems: mergedReturned,
        reason: returnReason,
        refundAmount: (selectedSale.returnInfo?.refundAmount || 0) + refundAmount,
      }
    };

    setSales(prev => prev.map(s => s.id === selectedSale.id ? updatedSale : s));
    setProducts(prev => prev.map(p => {
      const returned = returnedItems.find(ri => ri.id === p.id);
      return returned ? { ...p, stock: p.stock + returned.quantity } : p;
    }));

    setReturnSuccess(true);
    setTimeout(() => {
      setShowReturnModal(false);
      setReturnSuccess(false);
      setSelectedSale(updatedSale);
    }, 2000);
  };

  const getStatusBadge = (sale: Sale) => {
    if (sale.status === 'returned') return <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">مرتجع</span>;
    if (sale.status === 'partial_return') return <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">مرتجع جزئي</span>;
    if (sale.paymentMethod === 'debt') return <span className="text-[9px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full font-bold">دين</span>;
    return <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-bold">مكتملة</span>;
  };

  const renderSaleCard = (sale: Sale, compact = false) => (
    <div key={sale.id} className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden ${compact ? '' : 'mb-3'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-gray-800 dark:text-white">#{sale.id}</span>
              {getStatusBadge(sale)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{new Date(sale.timestamp).toLocaleString('ar-DZ')}</div>
            {sale.customerName && <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{sale.customerName}</div>}
          </div>
          <div className="text-end flex-shrink-0">
            <div className="font-black text-lg text-primary">{sale.total.toFixed(2)} {cur}</div>
            <div className="text-xs text-gray-500">{sale.items.length} {t.items || 'صنف'}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => setSelectedSale(sale === selectedSale ? null : sale)}
            className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all">
            <FileText size={12} /> {t.details || 'التفاصيل'}
          </button>
          <button onClick={() => { if ((window as any).__matjariReprintSale) (window as any).__matjariReprintSale(sale); }}
            className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all">
            <Printer size={12} /> {t.print_receipt || 'طباعة'}
          </button>
          {sale.status !== 'returned' && setSales && setProducts && (
            <button onClick={() => openReturnModal(sale)}
              className="flex items-center gap-1.5 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-orange-100 transition-all">
              <RotateCcw size={12} /> {t.return || 'مرتجع'}
            </button>
          )}
        </div>
      </div>
      {/* Sale details */}
      {selectedSale?.id === sale.id && (
        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-200 dark:border-gray-600"><th className="text-start py-1 font-bold">الصنف</th><th className="text-center">الكمية</th><th className="text-end">السعر</th></tr></thead>
            <tbody>
              {sale.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-1.5 font-medium dark:text-gray-300">{item.name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-end font-bold">{(item.price * item.quantity).toFixed(2)} {cur}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sale.returnInfo && (
            <div className="mt-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-xs space-y-1.5">
              <div className="font-black text-orange-700 dark:text-orange-400 flex items-center gap-1">
                <RotateCcw size={12}/> مرتجع — {new Date(sale.returnInfo.returnedAt).toLocaleDateString('ar-DZ')}
                {sale.status === 'partial_return' && <span className="text-[10px] bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded-full mr-1">جزئي</span>}
              </div>
              {sale.returnInfo.returnedItems?.length > 0 && (
                <div className="space-y-1 border-t border-orange-200 dark:border-orange-700 pt-1.5">
                  <p className="text-orange-600 font-bold">الأصناف المرتجعة:</p>
                  {sale.returnInfo.returnedItems.map((ri, i) => (
                    <div key={i} className="flex justify-between text-orange-700 dark:text-orange-400">
                      <span>{ri.name} × {ri.quantity}</span>
                      <span className="font-bold">{(ri.price * ri.quantity).toFixed(2)} {cur}</span>
                    </div>
                  ))}
                </div>
              )}
              {sale.returnInfo.refundAmount != null && sale.returnInfo.refundAmount > 0 && (
                <div className="flex justify-between font-black text-green-700 dark:text-green-400 border-t border-orange-200 dark:border-orange-700 pt-1.5">
                  <span>💵 المبلغ المسترد للزبون:</span>
                  <span>{sale.returnInfo.refundAmount.toFixed(2)} {cur}</span>
                </div>
              )}
              {sale.returnInfo.reason && (
                <div className="text-orange-600 dark:text-orange-500">السبب: {sale.returnInfo.reason}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const cats = [
    { id: 'all', label: t.all || 'الكل', count: totalResults },
    { id: 'products', label: t.products || 'منتجات', count: searchResults.products.length },
    { id: 'customers', label: t.customers || 'زبائن', count: searchResults.customers.length },
    { id: 'sales', label: t.sales || 'مبيعات', count: searchResults.sales.length },
    { id: 'suppliers', label: t.suppliers || 'موردون', count: searchResults.suppliers.length },
  ];

  return (
    <div className="space-y-5 font-cairo pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Search Bar */}
      <div className="bg-gradient-to-br from-primary to-blue-700 p-6 sm:p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 end-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black mb-2">{t.search_hub_title || 'البحث الشامل'}</h1>
          <p className="text-white/70 text-sm mb-6">{t.search_hub_subtitle || 'ابحث عن منتجات، زبائن، فواتير أو موردين'}</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 start-4 text-primary" size={22} />
              <input value={query} onChange={e => setQuery(e.target.value)} autoFocus
                className="w-full py-4 ps-12 pe-4 bg-white text-gray-900 rounded-2xl text-base outline-none shadow-xl font-bold"
                placeholder={t.search_placeholder || 'اسم، باركود، هاتف، رقم الفاتورة...'} />
            </div>
            <button onClick={() => setIsScannerOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white p-4 rounded-2xl transition-all flex-shrink-0" title={t.scan || 'مسح QR'}>
              <Camera size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Category filters */}
      {query && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cats.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0 transition-all ${activeCategory === c.id ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
              {c.label} <span className={`rounded-full px-1.5 py-0.5 text-xs font-black ${activeCategory === c.id ? 'bg-white/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {query ? (
        <div className="space-y-6">
          {(activeCategory === 'all' || activeCategory === 'sales') && searchResults.sales.length > 0 && (
            <section>
              <h2 className="font-black text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <DollarSign size={18} className="text-primary" /> {t.sales || 'المبيعات'} ({searchResults.sales.length})
              </h2>
              <div className="space-y-3">
                {searchResults.sales.map(s => renderSaleCard(s))}
              </div>
            </section>
          )}

          {(activeCategory === 'all' || activeCategory === 'products') && searchResults.products.length > 0 && (
            <section>
              <h2 className="font-black text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Package size={18} className="text-primary" /> {t.products || 'المنتجات'} ({searchResults.products.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.products.map(p => (
                  <div key={p.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.image ? <img src={p.image} className="w-full h-full object-cover" alt={p.name} /> : <Package size={24} className="text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm dark:text-white truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.barcode}</div>
                      <div className="text-sm font-black text-primary">{p.price} {cur}</div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => onAddToCart(p)} disabled={p.stock <= 0}
                        className="bg-primary text-white p-2 rounded-xl hover:bg-primary/90 disabled:opacity-50">
                        <ShoppingCart size={14} />
                      </button>
                      <button onClick={() => onNavigateToTab('inventory', p.id)}
                        className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 p-2 rounded-xl hover:bg-gray-200">
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(activeCategory === 'all' || activeCategory === 'customers') && searchResults.customers.length > 0 && (
            <section>
              <h2 className="font-black text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <User size={18} className="text-primary" /> {t.customers || 'الزبائن'} ({searchResults.customers.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.customers.map(c => (
                  <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm dark:text-white">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.phone}</div>
                      <div className="text-xs text-yellow-600">⭐ {c.points.toFixed(1)} نقطة</div>
                    </div>
                    <button onClick={() => onNavigateToTab('customers', c.id)} className="text-primary p-2 rounded-xl hover:bg-primary/10">
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(activeCategory === 'all' || activeCategory === 'suppliers') && searchResults.suppliers.length > 0 && (
            <section>
              <h2 className="font-black text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Truck size={18} className="text-primary" /> {t.suppliers || 'الموردون'} ({searchResults.suppliers.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.suppliers.map(s => (
                  <div key={s.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <Truck size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm dark:text-white">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.phone}</div>
                      <div className="text-xs text-gray-400">{s.productType}</div>
                    </div>
                    <button onClick={() => onNavigateToTab('suppliers', s.id)} className="text-blue-600 p-2 rounded-xl hover:bg-blue-50">
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {totalResults === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Search size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-lg">{t.no_results || 'لا توجد نتائج'}</p>
              <p className="text-sm mt-1">{t.try_another || 'جرب كلمة بحث مختلفة'}</p>
            </div>
          )}
        </div>
      ) : (
        /* Empty state with recent sales */
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t.products || 'منتجات', count: products.length, icon: <Package className="text-primary" />, tab: 'inventory' },
              { label: t.customers || 'زبائن', count: customers.length, icon: <User className="text-green-500" />, tab: 'customers' },
              { label: t.sales || 'مبيعات', count: sales.length, icon: <DollarSign className="text-yellow-500" />, tab: null },
              { label: t.suppliers || 'موردون', count: suppliers.length, icon: <Truck className="text-blue-500" />, tab: 'suppliers' },
            ].map((item, i) => (
              <button key={i} onClick={() => item.tab && onNavigateToTab(item.tab)}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 text-center shadow-sm hover:border-primary transition-all ${item.tab ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className="flex justify-center mb-2">{React.cloneElement(item.icon, { size: 28 })}</div>
                <div className="text-2xl font-black text-gray-800 dark:text-white">{item.count}</div>
                <div className="text-xs text-gray-500">{item.label}</div>
              </button>
            ))}
          </div>

          {/* Recent sales */}
          {sales.length > 0 && (
            <div>
              <h2 className="font-black text-gray-700 dark:text-gray-200 mb-3">📋 {t.recent_sales || 'آخر المبيعات'}</h2>
              <div className="space-y-3">
                {[...sales].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5).map(s => renderSaleCard(s, true))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                <RotateCcw size={20} className="text-orange-500" /> {t.process_return || 'معالجة مرتجع'} #{selectedSale.id}
              </h2>
              <button onClick={() => setShowReturnModal(false)} className="text-gray-400 p-1"><X size={20} /></button>
            </div>

            {returnSuccess ? (
              <div className="p-10 text-center">
                <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-black text-gray-800 dark:text-white">{t.return_success || 'تم المرتجع بنجاح!'}</h3>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-sm text-orange-700 dark:text-orange-400">
                  ⚠️ {t.return_warning || 'سيتم إعادة المخزون تلقائياً عند تأكيد المرتجع.'}
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300">{t.select_return_items || 'حدد الأصناف المرتجعة:'}</h3>
                  {selectedSale.items.map(item => {
                    const alreadyRet = selectedSale.returnInfo?.returnedItems
                      ?.filter((ri: any) => ri.id === item.id)
                      .reduce((s: number, ri: any) => s + ri.quantity, 0) || 0;
                    const maxCanReturn = Math.max(0, item.quantity - alreadyRet);
                    const isFullyReturned = maxCanReturn === 0;
                    return (
                    <div key={item.id} className={`flex items-center justify-between rounded-xl p-3 ${isFullyReturned ? 'bg-gray-100 dark:bg-gray-700/30 opacity-60' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm dark:text-white truncate">{item.name}</div>
                        <div className="text-xs text-gray-500">
                          {isFullyReturned ? '✓ مرتجع بالكامل' : `يمكن إرجاع: ${maxCanReturn} من ${item.quantity}`}
                        </div>
                        {(returnItems[item.id] || 0) > 0 && (
                          <div className="text-xs text-green-600 font-bold mt-0.5">
                            💵 {(item.price * (returnItems[item.id] || 0)).toFixed(2)} {cur}
                          </div>
                        )}
                      </div>
                      {!isFullyReturned && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setReturnItems(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}
                            className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 font-black flex items-center justify-center">-</button>
                          <span className="w-8 text-center font-black text-sm dark:text-white">{returnItems[item.id] || 0}</span>
                          <button onClick={() => setReturnItems(p => ({ ...p, [item.id]: Math.min(maxCanReturn, (p[item.id] || 0) + 1) }))}
                            className="w-7 h-7 rounded-lg bg-primary/20 text-primary font-black flex items-center justify-center">+</button>
                          <button onClick={() => setReturnItems(p => ({ ...p, [item.id]: maxCanReturn }))}
                            className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-lg font-bold">{t.all || 'الكل'}</button>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>

                {refundAmount > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3 flex justify-between items-center">
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">💵 المبلغ المسترد للزبون:</span>
                    <span className="text-lg font-black text-green-700 dark:text-green-400">{refundAmount.toFixed(2)} {cur}</span>
                  </div>
                )}

                <div>
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">{t.return_reason || 'سبب المرتجع'}</label>
                  <textarea className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                    rows={2} value={returnReason} onChange={e => setReturnReason(e.target.value)}
                    placeholder={t.return_reason_placeholder || 'منتج معيب، لا يناسب...'} />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowReturnModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-bold text-sm">{t.cancel || 'إلغاء'}</button>
                  <button onClick={handleReturn} disabled={!Object.values(returnItems).some(v => v > 0)}
                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-50">
                    ✓ {t.confirm_return || 'تأكيد المرتجع'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scanner */}
      {isScannerOpen && (
        <BarcodeScanner onScan={handleQRScan} onClose={() => setIsScannerOpen(false)}
          title={t.scan_invoice || 'مسح فاتورة أو باركود'} hint={t.scan_invoice_hint || 'مسح QR الفاتورة لفتحها'} t={t} />
      )}
    </div>
  );
};
