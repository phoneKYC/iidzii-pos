import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Package, Plus, Trash2, Edit2, Lock, ImageIcon,
  Loader2, Globe, X, Sparkles, AlertTriangle,
  Eye, Terminal, CheckSquare, Square, Search, CheckCircle2, AlertCircle,
  RefreshCcw, Camera, Truck, ChevronDown, Printer
} from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { InvoiceBarcode } from './InvoiceBarcode';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Product, Supplier, AppSettings, User } from '../types';

interface InventoryProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  settings: AppSettings;
  currentUser: User;
  t?: any;
}

interface DataProvider {
  id: string;
  name: string;
  url: string;
}

const compressImage = (dataUrl: string, maxSize = 400, quality = 0.7): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

export const Inventory: React.FC<InventoryProps> = ({
  products,
  setProducts,
  suppliers,
  setSuppliers,
  settings,
  currentUser,
  t = {}
}) => {
  // --- الحالات (States) ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<{ids: string[], isBulk: boolean} | null>(null);
  const [deletePass, setDeletePass] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(t.all || 'الكل');
  const [formData, setFormData] = useState<Partial<Product>>({
    category: t.general || 'عام',
    minStock: 5,
    cost: 0,
    price: 0,
    stock: 0,
    supplierId: ''
  });

  const [fetchStatus, setFetchStatus] = useState<'idle' | 'searching' | 'success' | 'notfound' | 'error'>('idle');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const [providers] = useState<DataProvider[]>([
    { id: 'goupc', name: 'Go-UPC (عام/عربي)', url: 'https://go-upc.com/search?q={code}' },
                                               { id: 'off', name: 'Open Food Facts (مواد غذائية)', url: 'https://world.openfoodfacts.org/api/v2/product/{code}.json' },
                                               { id: 'obf', name: 'Open Beauty Facts (تجميل)', url: 'https://world.openbeautyfacts.org/api/v2/product/{code}.json' },
                                               { id: 'opf', name: 'Open Products Facts (منتجات عامة)', url: 'https://world.openproductsfacts.org/api/v2/product/{code}.json' },
                                               { id: 'opff', name: 'Open Pet Food Facts (حيوانات)', url: 'https://world.openpetfoodfacts.org/api/v2/product/{code}.json' },
                                               { id: 'google', name: 'Google Shopping (البحث الشامل)', url: 'https://www.google.com/search?q={code}&tbm=shop' }
  ]);
  const [selectedProvider, setSelectedProvider] = useState(providers[0].url);
  const [isFetching, setIsFetching] = useState(false);
  const [rawJson, setRawJson] = useState<any>(null);
  const [showRawData, setShowRawData] = useState(false);

  const [undoDelete, setUndoDelete] = useState<{ items: Product[], timeLeft: number } | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productCameraRef = useRef<HTMLInputElement>(null);

  // ── نافذة إضافة مورد سريع ─────────────────────────────────────
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({ name: '', productType: '', phone: '' });
  const [quickSupplierError, setQuickSupplierError] = useState('');

  // ── بحث في قائمة الموردين داخل نافذة المنتج ──────────────────
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const filteredSuppliers = suppliers.filter(s =>
    !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  // --- ميزة كاميرا الماسح الضوئي الذكية ---
  useEffect(() => {
    let scanner: any = null;
    if (isScannerOpen) {
      setTimeout(() => {
        scanner = new Html5QrcodeScanner("inventory-camera-reader", {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true
        }, false);

        scanner.render((decodedText: string) => {
          setFormData(prev => ({ ...prev, barcode: decodedText }));
          setIsScannerOpen(false);
          scanner.clear();
          handleOnlineLookup(decodedText);
        }, () => {});
      }, 300);
    }
    return () => { if (scanner) scanner.clear().catch(() => {}); };
  }, [isScannerOpen]);

  useEffect(() => {
    if (undoDelete && undoDelete.timeLeft > 0) {
      undoTimerRef.current = setTimeout(() => {
        setUndoDelete(prev => prev ? { ...prev, timeLeft: prev.timeLeft - 1 } : null);
      }, 1000);
    } else if (undoDelete && undoDelete.timeLeft === 0) {
      setUndoDelete(null);
    }
    return () => { if(undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, [undoDelete]);

  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && !isModalOpen) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) barcodeBuffer = '';

  if (e.key === 'Enter') {
    if (barcodeBuffer.length > 3) {
      if (isModalOpen) {
        setFormData(prev => ({ ...prev, barcode: barcodeBuffer }));
        handleOnlineLookup(barcodeBuffer);
      } else {
        setSearchQuery(barcodeBuffer);
      }
      barcodeBuffer = '';
    }
  } else if (e.key.length === 1) {
    barcodeBuffer += e.key;
  }
  lastKeyTime = currentTime;
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [isModalOpen]);

  const deepSearch = (obj: any, keys: string[]): string => {
    if (!obj || typeof obj !== 'object') return "";
    for (const key of keys) {
      if (obj[key] && typeof obj[key] === 'string' && obj[key].length > 2) return obj[key];
    }
    for (const k in obj) {
      if (typeof obj[k] === 'object') {
        const res = deepSearch(obj[k], keys);
        if (res) return res;
      }
    }
    return "";
  };

  const handleOnlineLookup = async (forcedBarcode?: string) => {
    const codeToSearch = forcedBarcode || formData.barcode;
    if (!codeToSearch) return;

    setIsFetching(true);
    setFetchStatus('searching');
    setRawJson(null);

    // ── 1. البحث في قاعدة البيانات المحلية أولاً ──────────────
    const localMatch = products.find(
      p => p.barcode === codeToSearch || p.name.toLowerCase() === codeToSearch.toLowerCase()
    );
    if (localMatch && !editingProduct) {
      setFormData(prev => ({
        ...prev,
        name: localMatch.name,
        image: localMatch.image || prev.image,
        barcode: codeToSearch,
        category: localMatch.category,
        price: localMatch.price,
        cost: localMatch.cost,
        supplierId: localMatch.supplierId,
      }));
      setFetchStatus('success');
      setIsFetching(false);
      return;
    }

    // ── 2. البحث الخارجي مع إعادة المحاولة (retry ×2) ─────────
    let foundName = "";
    let foundImage = "";
    let successfulProviderUrl = "";

    const searchSequence = [
      selectedProvider,
      ...providers.map(p => p.url).filter(url => url !== selectedProvider)
    ];

    const RETRY = 2; // عدد محاولات إضافية عند الفشل
    for (const baseUrl of searchSequence) {
      if (foundName) break;
      const apiUrl = baseUrl.replace('{code}', codeToSearch);
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;

      for (let attempt = 0; attempt <= RETRY; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
          const response = await fetch(proxyUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (!response.ok) break;
          const wrapper = await response.json();
          const content = wrapper.contents;

          try {
            const data = JSON.parse(content);
            setRawJson(data);
            foundName = deepSearch(data, ['product_name', 'product_name_ar', 'name', 'title', 'brand']);
            foundImage = deepSearch(data, ['image_front_url', 'image_url', 'image', 'thumbnail']);
            if (foundName) successfulProviderUrl = baseUrl;
          } catch {
            const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
            content.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ||
            content.match(/itemprop="name">([\s\S]*?)<\/h1>/i);
            const imgMatch = content.match(/<img[^>]*src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp|gif))"/i) ||
            content.match(/data-image-src="([^"]+)"/i);

            if (h1Match) {
              foundName = h1Match[1].replace(/<[^>]*>/g, '').trim();
              foundImage = imgMatch ? imgMatch[1] : "";
              successfulProviderUrl = baseUrl;
            }
          }
          if (foundName) break; // نجح — توقف عن المحاولات
        } catch (err: any) {
          if (attempt < RETRY) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // انتظر قبل retry
          }
          continue;
        }
      }
    }

    if (foundName) {
      setFormData(prev => ({ ...prev, name: foundName, image: foundImage || prev.image, barcode: codeToSearch }));
      setFetchStatus('success');
      if (successfulProviderUrl) setSelectedProvider(successfulProviderUrl);
    } else {
      setFetchStatus('notfound');
    }
    setIsFetching(false);
  };

  const handleBulkCategoryChange = (newCat: string) => {
    setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, category: newCat } : p));
    setSelectedIds([]);
  };

  const initiateDelete = (ids: string[]) => {
    if (settings.security.confirmDeleteInventory) {
      setIsConfirmingDelete({ ids, isBulk: ids.length > 1 });
    } else {
      executeDelete(ids);
    }
  };

  const executeDelete = (ids: string[]) => {
    const itemsToDelete = products.filter(p => ids.includes(p.id));
    setProducts(prev => prev.filter(p => !ids.includes(p.id)));
    setUndoDelete({ items: itemsToDelete, timeLeft: 10 });
    setSelectedIds([]);
    setIsConfirmingDelete(null);
    setDeletePass('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setRawJson(null);
    setFetchStatus('idle');
    setFormData({
      category: t.general || 'عام',
      minStock: 5,
      cost: 0,
      price: 0,
      stock: 0,
      supplierId: '',
      localBarcode: '',
    });
  };

  // ── حفظ المورد السريع ────────────────────────────────────────
  const handleQuickSupplierSave = () => {
    if (!quickSupplierForm.name.trim()) { setQuickSupplierError('الاسم مطلوب'); return; }
    const ns: Supplier = {
      id: `SUP_${Date.now()}`,
      name: quickSupplierForm.name.trim(),
      phone: quickSupplierForm.phone.trim(),
      productType: quickSupplierForm.productType.trim(),
    };
    setSuppliers(prev => [ns, ...prev]);
    setFormData(prev => ({ ...prev, supplierId: ns.id }));
    setQuickSupplierOpen(false);
    setQuickSupplierForm({ name: '', productType: '', phone: '' });
    setQuickSupplierError('');
  };

  // ── تصوير المنتج مباشرة (Android native أو file input) ──────
  const handleProductCameraCapture = async () => {
    const isAndroid = !!(window as any).Capacitor?.isNativePlatform?.() && (window as any).Capacitor?.getPlatform?.() === 'android';
    if (isAndroid) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 80, resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera, allowEditing: false, correctOrientation: true, width: 800,
        });
        if (photo.dataUrl) {
          const compressed = await compressImage(photo.dataUrl);
          setFormData(prev => ({ ...prev, image: compressed }));
        }
      } catch (e: any) {
        if (!e.message?.toLowerCase().includes('cancel')) console.error(e);
      }
    } else {
      productCameraRef.current?.click();
    }
  };

  const categories = useMemo(() => {
    return [t.all || 'الكل', ...Array.from(new Set(products.map(p => p.category || (t.general || 'عام'))))];
  }, [products, t]);

  const sortedProducts = useMemo(() => {
    let filtered = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
      const matchesCategory = activeCategory === (t.all || 'الكل') || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
    return [...filtered].sort((a, b) => {
      const aIsLow = a.stock <= a.minStock;
      const bIsLow = b.stock <= b.minStock;
      if (aIsLow && !bIsLow) return -1;
      if (!aIsLow && bIsLow) return 1;
      return b.id.localeCompare(a.id);
    });
  }, [products, searchQuery, activeCategory, t]);

  // ── طباعة بطاقة باركود حرارية ──────────────────────────────────
  const generateBarcodeLabelHTML = (product: Product): string => {
    const cfg = (settings as any).barcodePrintConfig || { width: 40, height: 25, showPrice: true, showName: true, fontSize: 10, copies: 1 };
    const barcode = product.barcode || product.localBarcode || product.id;

    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <style>
      @page { size: ${cfg.width}mm ${cfg.height}mm; margin: 2mm; }
      body { margin: 0; padding: 2mm; font-family: 'Cairo', sans-serif; text-align: center; }
      .label { width: ${cfg.width - 4}mm; height: ${cfg.height - 4}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px dashed #ccc; }
      .name { font-size: ${cfg.fontSize - 2}pt; font-weight: bold; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .price { font-size: ${cfg.fontSize}pt; font-weight: 900; color: #1e40af; margin-bottom: 2px; }
      .barcode { font-family: 'Libre Barcode 128', monospace; font-size: 24pt; }
      @media print { body { -webkit-print-color-adjust: exact; } }
    </style></head><body>
    ${Array(cfg.copies || 1).fill(`
      <div class="label">
        ${cfg.showName ? `<div class="name">${product.name}</div>` : ''}
        <svg id="barcode-svg" data-value="${barcode}" width="150" height="40"></svg>
        ${cfg.showPrice ? `<div class="price">${product.price} ${settings.currency}</div>` : ''}
      </div>
    `).join('<div style="page-break-after: always;"></div>')}
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
    <script>
      document.querySelectorAll('#barcode-svg').forEach(svg => {
        try { JsBarcode(svg, svg.dataset.value, { format: 'CODE128', width: 1.5, height: 35, displayValue: true, fontSize: 10, margin: 0 }); } catch(e) { console.error(e); }
      });
      setTimeout(() => window.print(), 500);
    <\/script>
    </body></html>`;
  };

  const handlePrintBarcode = (product: Product) => {
    const html = generateBarcodeLabelHTML(product);
    const printWindow = window.open('', '_blank', 'width=500,height=400');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-4 font-cairo p-2 md:p-4" dir="rtl">
    {undoDelete && (
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-bounce">
      <div className="bg-gray-900 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-6 border border-white/10">
      <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
      <circle cx="28" cy="28" r="24" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="150.8" style={{ strokeDashoffset: 150.8 - (150.8 * undoDelete.timeLeft) / 10, transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className="text-lg font-black">{undoDelete.timeLeft}</span>
      </div>
      <div>
      <p className="text-sm font-black">{t.operation_success || 'تمت العملية بنجاح'}!</p>
      <button onClick={() => { setProducts(prev => [...prev, ...undoDelete.items]); setUndoDelete(null); }} className="text-primary font-black text-xs hover:underline">
      {t.undo || 'تراجع الآن'}
      </button>
      </div>
      </div>
      </div>
    )}

    {isConfirmingDelete && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl">
      <Lock className="text-red-500 mx-auto mb-6" size={40} />
      <h2 className="text-xl font-black dark:text-white mb-6">{t.confirm_delete || 'تأكيد الحذف'}</h2>
      <input
      type="password"
      value={deletePass}
      onChange={e => setDeletePass(e.target.value)}
      className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-center text-2xl mb-6 outline-none dark:text-white"
      placeholder={t.password || 'الرمز السري'}
      autoFocus
      />
      <div className="flex gap-3">
      <button onClick={() => { if(deletePass === currentUser.password) executeDelete(isConfirmingDelete.ids); else alert(t.wrong_password || 'خطأ في الرمز'); }} className="flex-[2] bg-red-500 text-white py-4 rounded-2xl font-black shadow-lg">
      {t.delete || 'حذف'}
      </button>
      <button onClick={() => setIsConfirmingDelete(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 dark:text-white py-4 rounded-2xl">
      {t.cancel || 'إلغاء'}
      </button>
      </div>
      </div>
      </div>
    )}

    <div className="sticky top-0 z-[100] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b dark:border-white/5 -mx-4 px-4 py-4 space-y-4 shadow-sm">
    <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
    <div className="flex items-center gap-4 w-full md:w-auto">
    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
    <Package size={24}/>
    </div>
    <div className="flex items-center gap-3">
    <h1 className="text-lg font-black dark:text-white">{t.inventory || 'المخزون'}</h1>
    {selectedIds.length > 0 && (
      <div className="flex gap-2">
      <button onClick={() => initiateDelete(selectedIds)} className="bg-red-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-lg animate-pulse">
      <Trash2 size={12}/> {t.delete || 'حذف'} ({selectedIds.length})
      </button>
      <select
      onChange={(e) => handleBulkCategoryChange(e.target.value)}
      className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg outline-none cursor-pointer appearance-none"
      defaultValue=""
      >
      <option value="" disabled>{t.move_to_category || 'نقل إلى صنف...'}</option>
      {categories.filter(c => c !== (t.all || 'الكل')).map(cat => (
        <option key={cat} value={cat} className="text-black">{cat}</option>
      ))}
      </select>
      </div>
    )}
    </div>
    </div>

    <div className="flex flex-1 items-center gap-3 w-full md:max-w-2xl">
    <div className="relative flex-1 group">
    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
    <input
    type="text"
    placeholder={t.search_placeholder || 'ابحث بالاسم أو امسح باركود...'}
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    className="w-full pr-12 pl-14 py-3 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-primary/30 transition-all"
    />
    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
    <button
    type="button"
    className="p-1.5 bg-white dark:bg-gray-700 text-primary rounded-xl shadow-sm hover:scale-110 active:scale-95 transition-all"
    onClick={() => setIsScannerOpen(true)}
    title={t.scan_barcode || 'مسح باركود'}
    >
    <Camera size={16} />
    </button>
    </div>
    </div>
    <button
    onClick={() => { closeModal(); setIsModalOpen(true); }}
    className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shrink-0"
    >
    <Plus size={20} /> {t.add || 'إضافة'}
    </button>
    </div>
    </div>

    <div className="max-w-[1600px] mx-auto flex gap-2 overflow-x-auto no-scrollbar pb-1">
    {categories.map(cat => (
      <button
      key={cat}
      onClick={() => setActiveCategory(cat)}
      className={`px-5 py-2 rounded-xl text-[11px] font-black whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-primary text-white shadow-md scale-105' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
      >
      {cat}
      </button>
    ))}
    </div>
    </div>

    {isModalOpen && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-2">
      <div className="bg-white dark:bg-gray-800 w-full max-w-5xl rounded-[2.5rem] p-6 shadow-2xl flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto">
      <div className="flex-1">
      <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-black dark:text-white">
      {editingProduct ? (t.edit_product || 'تعديل المنتج') : (t.add_product || 'إضافة منتج ذكية')}
      </h2>
      <div className="flex gap-2">
      <button onClick={() => setShowRawData(!showRawData)} className={`p-2.5 rounded-xl ${showRawData ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
      <Eye size={20}/>
      </button>
      <button onClick={closeModal} className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl dark:text-white">
      <X size={20}/>
      </button>
      </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-4 space-y-4">
      <div
      onClick={() => fileInputRef.current?.click()}
      className="w-28 h-28 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/5 flex items-center justify-center cursor-pointer relative overflow-hidden flex-shrink-0"
      >
      {formData.image ? (
        <img src={formData.image} className="w-full h-full object-cover" alt="product" />
      ) : (
        <ImageIcon size={28} className="text-gray-300" />
      )}
      {/* زر كاميرا المنتج */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleProductCameraCapture(); }}
        className="absolute bottom-2 left-2 bg-primary text-white p-2 rounded-xl shadow-lg hover:bg-primary/90 transition-all"
        title="تصوير المنتج"
      >
        <Camera size={18} />
      </button>
      <input
      ref={fileInputRef}
      type="file"
      className="hidden"
      accept="image/*"
      onChange={e => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setFormData({...formData, image: reader.result as string});
          reader.readAsDataURL(file);
        }
      }}
      />
      {/* camera capture input for web */}
      <input
      ref={productCameraRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={e => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const compressed = await compressImage(reader.result as string);
            setFormData(prev => ({ ...prev, image: compressed }));
          };
          reader.readAsDataURL(file);
        }
      }}
      />
      </div>
      <div className="space-y-2">
      <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-widest">
      {t.data_source || 'مصدر البحث'}
      </label>
      <select
      value={selectedProvider}
      onChange={(e) => setSelectedProvider(e.target.value)}
      className="w-full p-3.5 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-2xl text-xs font-black outline-none border-none"
      >
      {providers.map(p => <option key={p.id} value={p.url}>{p.name}</option>)}
      </select>
      <div className="relative flex gap-2">
      <div className="relative flex-1">
      <input
      value={formData.barcode || ''}
      onChange={e => setFormData({...formData, barcode: e.target.value})}
      className="w-full p-4 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-2xl text-sm font-black text-center focus:ring-2 ring-primary transition-all"
      placeholder={t.barcode || 'الباركود'}
      />
      <button onClick={() => handleOnlineLookup()} className="absolute left-2 top-1/2 -translate-y-1/2 bg-primary text-white p-2 rounded-xl">
      {isFetching ? <Loader2 className="animate-spin" size={18}/> : <Globe size={18}/>}
      </button>
      </div>
      <button
      onClick={() => setIsScannerOpen(true)}
      className="p-4 bg-gray-100 dark:bg-gray-900 text-primary rounded-2xl shadow-sm hover:scale-105 active:scale-95 transition-all"
      >
      <Camera size={20} />
      </button>
      </div>
      <div className="px-2 min-h-[20px]">
      {fetchStatus === 'searching' && (
        <p className="text-[10px] text-blue-500 font-bold flex items-center gap-1 animate-pulse">
        <Loader2 size={10} className="animate-spin"/> {t.searching || 'جاري البحث...'}
        </p>
      )}
      {fetchStatus === 'success' && (
        <p className="text-[10px] text-green-500 font-black flex items-center gap-1">
        <CheckCircle2 size={10}/> {t.operation_success || 'تم الجلب بنجاح!'}
        </p>
      )}
      {fetchStatus === 'notfound' && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-2xl p-3 space-y-2">
          <p className="text-[10px] text-orange-600 font-black flex items-center gap-1">
            <AlertCircle size={12}/> {t.product_not_found || 'المنتج غير مسجل عالمياً'}
          </p>
          <p className="text-[9px] text-orange-500">يمكنك تصوير المنتج وحفظ باركوده محلياً</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleProductCameraCapture}
              className="flex-1 flex items-center justify-center gap-1 bg-orange-100 dark:bg-orange-900/40 text-orange-600 py-2 rounded-xl text-[10px] font-black"
            >
              <Camera size={13}/> تصوير المنتج
            </button>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 flex items-center justify-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 py-2 rounded-xl text-[10px] font-black"
            >
              <RefreshCcw size={13}/> مسح الباركود
            </button>
          </div>
        </div>
      )}
      {fetchStatus === 'error' && (
        <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
        <AlertCircle size={10}/> {t.connection_error || 'خطأ في الاتصال'}
        </p>
      )}
      </div>
      </div>
      </div>
      <div className="md:col-span-8 grid grid-cols-2 gap-4">
      <div className="col-span-2">
      <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase mr-2 tracking-widest">
      {t.product_name || 'اسم المنتج'}
      </label>
      <input
      value={formData.name || ''}
      onChange={e => setFormData({...formData, name: e.target.value})}
      className="w-full p-4 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-2xl text-sm font-black outline-none"
      placeholder={t.product_name_placeholder || 'اسم المنتج...'}
      />
      </div>
      <div>
      <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase mr-2 tracking-widest">
      {t.category || 'الفئة'}
      </label>
      <div className="relative">
        <input
          value={formData.category || ''}
          onChange={e => setFormData({...formData, category: e.target.value})}
          className="w-full p-4 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-2xl text-sm font-black outline-none border-2 border-transparent focus:border-primary/20 transition-all pl-12"
          placeholder={t.category_placeholder || 'اكتب الفئة...'}
        />
        {/* زر السهم فقط يفتح القائمة — لا تظهر تلقائياً */}
        <button
          type="button"
          onPointerDown={e => { e.preventDefault(); setShowCategoryDropdown(v => !v); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary p-1"
        >
          <ChevronDown size={16} className={showCategoryDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {showCategoryDropdown && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-2xl z-[500] overflow-hidden"
            style={{ maxHeight: '220px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
            onPointerDown={e => e.stopPropagation()}
          >
            {categories.filter(cat => cat !== (t.all || 'الكل')).map(cat => {
              let pointerDownY = 0;
              return (
                <div
                  key={cat}
                  role="button"
                  onPointerDown={e => { pointerDownY = e.clientY; }}
                  onPointerUp={e => {
                    // تمييز النقر عن التمرير: إذا تحرك الإصبع أكثر من 8px → تمرير لا اختيار
                    if (Math.abs(e.clientY - pointerDownY) < 8) {
                      setFormData({...formData, category: cat});
                      setShowCategoryDropdown(false);
                    }
                  }}
                  className="w-full text-right px-4 py-3.5 text-sm font-bold dark:text-white hover:bg-primary hover:text-white transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 cursor-pointer select-none"
                  style={{ touchAction: 'pan-y' }}
                >
                  {cat}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-black text-gray-400 uppercase mr-2">
        {t.supplier || 'المورد'}
        </label>
        <button
          type="button"
          onClick={() => { setQuickSupplierOpen(true); setQuickSupplierError(''); setQuickSupplierForm({ name: '', productType: '', phone: '' }); }}
          className="text-[10px] text-primary font-black flex items-center gap-1 hover:underline"
        >
          <Plus size={11}/> {t.add_supplier || 'مورد جديد'}
        </button>
      </div>
      <select
      value={formData.supplierId}
      onChange={e => setFormData({...formData, supplierId: e.target.value})}
      className="w-full p-4 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-2xl text-sm font-black outline-none hidden"
      />
      {/* ── قائمة موردين قابلة للبحث ── */}
      <div className="relative">
        <button
          type="button"
          onPointerDown={e => { e.preventDefault(); setSupplierDropdownOpen(v => !v); if (!supplierDropdownOpen) setSupplierSearch(''); }}
          className="w-full p-4 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-2xl text-sm font-black outline-none text-right flex items-center justify-between border-2 border-transparent focus-within:border-primary/20"
        >
          <ChevronDown size={15} className={`text-gray-400 transition-transform ${supplierDropdownOpen ? 'rotate-180' : ''}`}/>
          <span>{suppliers.find(s => s.id === formData.supplierId)?.name || t.not_specified || 'غير محدد'}</span>
        </button>
        {supplierDropdownOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-2xl z-[500] overflow-hidden"
            onPointerDown={e => e.stopPropagation()}
          >
            {/* حقل البحث */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  autoFocus
                  type="text"
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  placeholder="ابحث عن مورد..."
                  className="w-full pr-8 pl-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-primary"
                />
              </div>
            </div>
            {/* قائمة النتائج */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {/* خيار "غير محدد" */}
              {(() => {
                let y0 = 0;
                return (
                  <div
                    role="button"
                    onPointerDown={e => { y0 = e.clientY; }}
                    onPointerUp={e => {
                      if (Math.abs(e.clientY - y0) < 8) {
                        setFormData({...formData, supplierId: ''});
                        setSupplierDropdownOpen(false);
                      }
                    }}
                    className={`px-4 py-3 text-sm font-bold text-right cursor-pointer select-none border-b border-gray-100 dark:border-gray-700 transition-colors ${!formData.supplierId ? 'bg-primary/10 text-primary' : 'dark:text-white hover:bg-primary hover:text-white'}`}
                    style={{ touchAction: 'pan-y' }}
                  >
                    {t.not_specified || 'غير محدد'}
                  </div>
                );
              })()}
              {filteredSuppliers.length === 0 && (
                <div className="px-4 py-3 text-xs text-gray-400 text-center">لا توجد نتائج</div>
              )}
              {filteredSuppliers.map(s => {
                let y0 = 0;
                return (
                  <div
                    key={s.id}
                    role="button"
                    onPointerDown={e => { y0 = e.clientY; }}
                    onPointerUp={e => {
                      if (Math.abs(e.clientY - y0) < 8) {
                        setFormData({...formData, supplierId: s.id});
                        setSupplierDropdownOpen(false);
                        setSupplierSearch('');
                      }
                    }}
                    className={`px-4 py-3 text-sm font-bold text-right cursor-pointer select-none border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${formData.supplierId === s.id ? 'bg-primary/10 text-primary' : 'dark:text-white hover:bg-primary hover:text-white'}`}
                    style={{ touchAction: 'pan-y' }}
                  >
                    {s.name}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
      {/* ── الأسعار والمخزون ── */}
      <div className="col-span-2 space-y-3 pt-2">
        {/* صف 1: التكلفة + التجزئة + الكمية */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-500/5 p-3 rounded-2xl border border-blue-500/10 text-center">
            <label className="text-[9px] font-black text-blue-500 block mb-1">{t.cost || 'التكلفة'}</label>
            <input type="number" value={formData.cost || ''}
              onChange={e => setFormData({...formData, cost: Number(e.target.value)})}
              onFocus={e => e.target.select()}
              className="w-full bg-transparent dark:text-white text-base font-black text-center outline-none" />
          </div>
          <div className="bg-green-500/5 p-3 rounded-2xl border border-green-500/10 text-center">
            <label className="text-[9px] font-black text-green-500 block mb-1">{t.price || 'تجزئة'}</label>
            <input type="number" value={formData.price || ''}
              onChange={e => setFormData({...formData, price: Number(e.target.value)})}
              onFocus={e => e.target.select()}
              className="w-full bg-transparent dark:text-white text-base font-black text-center outline-none" />
          </div>
          <div className="bg-purple-500/5 p-3 rounded-2xl border border-purple-500/10 text-center">
            <label className="text-[9px] font-black text-purple-500 block mb-1">{t.stock || 'الكمية'}</label>
            <input type="number" value={formData.stock || ''}
              onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
              onFocus={e => e.target.select()}
              className="w-full bg-transparent dark:text-white text-base font-black text-center outline-none" />
          </div>
        </div>

        {/* QR للمنتجات المحلية */}
        {!formData.barcode && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-3 flex items-center gap-3">
            <div>
              <p className="text-[10px] font-black text-gray-500 mb-1">رمز QR محلي</p>
              {formData.localBarcode ? (
                <div className="flex items-center gap-2">
                  <div className="bg-white p-1 rounded-lg">
                    <QRCodeSVG value={formData.localBarcode} size={52} level="M"/>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 font-mono">{formData.localBarcode}</p>
                    <button type="button"
                      onPointerDown={e => { e.preventDefault(); setFormData(p => ({...p, localBarcode: ''})); }}
                      className="text-[9px] text-red-400 hover:text-red-600">إزالة</button>
                  </div>
                </div>
              ) : (
                <button type="button"
                  onPointerDown={e => { e.preventDefault(); setFormData(p => ({...p, localBarcode: `LOCAL-${Math.random().toString(36).substr(2,8).toUpperCase()}`})); }}
                  className="text-[10px] bg-primary text-white px-3 py-1.5 rounded-xl font-black active:scale-95">
                  ✦ توليد رمز QR
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="col-span-2 bg-red-500/5 p-4 rounded-3xl border border-red-500/10 flex items-center justify-between">
      <div>
      <label className="text-[10px] font-black text-red-500 block uppercase tracking-widest">
      {t.min_stock || 'الحد الأدنى للمخزون'}
      </label>
      <p className="text-[9px] text-gray-400 font-bold">
      {t.stock_alert || 'تنبيه عند نقص الكمية عن هذا الرقم'}
      </p>
      </div>
      <input
      type="number"
      value={formData.minStock || ''}
      onChange={e => setFormData({...formData, minStock: Number(e.target.value)})}
      className="w-24 bg-white dark:bg-gray-900 dark:text-white p-3 rounded-2xl text-xl font-black text-center outline-none ring-1 ring-red-500/20"
      />
      </div>
      </div>
      </div>
      <div className="flex gap-3 mt-8">
      <button
      onClick={() => {
        if(!formData.name || !formData.price) return alert(t.required_fields || 'الاسم والسعر مطلوبان');
        // Duplicate check - same barcode or same name
        if (!editingProduct) {
          const dupBarcode = formData.barcode && products.find(p => p.barcode && p.barcode === formData.barcode);
          const dupName = products.find(p => p.name.toLowerCase().trim() === (formData.name || '').toLowerCase().trim());
          if (dupBarcode) {
            alert((t.duplicate_barcode || 'يوجد منتج بنفس الباركود') + ': ' + dupBarcode.name);
            return;
          }
          if (dupName) {
            if (!window.confirm((t.duplicate_name || 'يوجد منتج بنفس الاسم') + ': ' + dupName.name + '\n' + (t.continue_anyway || 'هل تريد المتابعة؟'))) return;
          }
        }
        if(editingProduct) setProducts(products.map(p => p.id === editingProduct.id ? {...p, ...formData} as any : p));
        else setProducts([...products, {id: Math.random().toString(36).substr(2, 9).toUpperCase(), ...formData} as any]);
        closeModal();
      }}
      className="flex-[2] bg-primary text-white py-5 rounded-[1.5rem] font-black text-sm shadow-xl flex items-center justify-center gap-3"
      >
      <Sparkles size={20}/> {editingProduct ? (t.update || 'تحديث') : (t.save || 'حفظ المنتج')}
      </button>
      <button
      onClick={closeModal}
      className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white py-5 rounded-[1.5rem] font-black text-sm"
      >
      {t.cancel || 'إلغاء'}
      </button>
      </div>
      </div>
      {showRawData && (
        <div className="w-72 bg-gray-950 rounded-[1.5rem] p-4 hidden xl:block overflow-auto border border-white/5 font-mono text-[10px] text-green-400">
        <div className="border-b border-white/10 pb-2 mb-3 text-primary font-black uppercase tracking-widest">
        {t.raw_data_scan || 'Raw Data Scan'}
        </div>
        <pre>{JSON.stringify(rawJson || {status: "No data fetched yet"}, null, 2)}</pre>
        </div>
      )}
      </div>
      </div>
    )}

    {/* ── نافذة إضافة مورد سريع ─────────────────────────────── */}
    {quickSupplierOpen && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-black dark:text-white text-sm flex items-center gap-2">
              <Truck size={16} className="text-primary"/> إضافة مورد سريع
            </h3>
            <button onClick={() => setQuickSupplierOpen(false)} className="text-gray-400 p-1"><X size={18}/></button>
          </div>
          <div className="p-4 space-y-3">
            {quickSupplierError && (
              <p className="text-xs text-red-500 font-bold">{quickSupplierError}</p>
            )}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">اسم المورد *</label>
              <input
                autoFocus
                value={quickSupplierForm.name}
                onChange={e => setQuickSupplierForm(p => ({ ...p, name: e.target.value }))}
                placeholder="اسم الشركة أو المورد"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">نوع السلعة</label>
              <input
                value={quickSupplierForm.productType}
                onChange={e => setQuickSupplierForm(p => ({ ...p, productType: e.target.value }))}
                placeholder="غذاء، إلكترونيات، مستلزمات..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={quickSupplierForm.phone}
                onChange={e => setQuickSupplierForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="06XXXXXXXX"
                dir="ltr"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-[9px] text-gray-400">يمكن إتمام باقي البيانات لاحقاً من قسم الموردين.</p>
          </div>
          <div className="flex gap-2 p-4 border-t border-gray-100 dark:border-gray-700">
            <button onClick={() => setQuickSupplierOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-400">
              إلغاء
            </button>
            <button onClick={handleQuickSupplierSave} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold">
              <Plus size={14} className="inline mr-1"/> إضافة
            </button>
          </div>
        </div>
      </div>
    )}

    {/* نافذة الكاميرا الخاصة بالمخزون */}
    {isScannerOpen && (
      <BarcodeScanner
        onScan={(code) => {
          setIsScannerOpen(false);
          if (isModalOpen) {
            setFormData(prev => ({ ...prev, barcode: code }));
            handleOnlineLookup(code);
          } else {
            setSearchQuery(code);
          }
        }}
        onClose={() => setIsScannerOpen(false)}
        title={t.scan_product || 'مسح منتج'}
        hint={t.scan_product_hint || 'وجّه الكاميرا نحو باركود المنتج'}
        t={t}
      />
    )}

    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] overflow-hidden shadow-sm border dark:border-white/5">
    <div className="overflow-x-auto">
    <table className="w-full text-right min-w-[800px]">
    <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 font-black text-[10px] uppercase border-b dark:border-white/5">
    <tr>
    <th className="p-5 w-14 text-center">
    <button onClick={() => {
      const visibleIds = sortedProducts.map(p => p.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
      if (allVisibleSelected) setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
      else setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }} className="text-primary">
    {sortedProducts.length > 0 && sortedProducts.every(p => selectedIds.includes(p.id)) ? <CheckSquare size={20}/> : <Square size={20}/>}
    </button>
    </th>
    <th className="p-5">{t.product || 'المنتج'}</th>
    <th className="p-5 text-center">{t.price || 'السعر'}</th>
    <th className="p-5 text-center">{t.stock || 'المخزون'}</th>
    <th className="p-5 text-center">{t.actions || 'الإجراءات'}</th>
    </tr>
    </thead>
    <tbody className="divide-y dark:divide-white/5 font-bold">
    {sortedProducts.map(p => (
      <tr key={p.id} className={`${selectedIds.includes(p.id) ? 'bg-primary/5' : ''} hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-all`}>
      <td className="p-5 text-center">
      <button onClick={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])} className="text-gray-300">
      {selectedIds.includes(p.id) ? <CheckSquare className="text-primary" size={20}/> : <Square size={20}/>}
      </button>
      </td>
      <td className="p-5 flex items-center gap-4">
      <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl overflow-hidden border dark:border-white/5">
      {p.image ? (
        <img src={p.image} className="w-full h-full object-cover" alt="product" />
      ) : (
        <Package className="w-full h-full p-4 text-gray-300"/>
      )}
      </div>
      <div>
      <p className="font-black dark:text-white text-base leading-tight flex items-center gap-2">
      {p.name} {p.stock <= p.minStock && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
      </p>
      <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase">{p.barcode}</p>
      </div>
      </td>
      <td className="p-5 text-center font-black dark:text-white text-lg">
      {p.price.toFixed(2)} <span className="text-[10px] opacity-40">{settings.currency}</span>
      </td>
      <td className="p-5 text-center">
      <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black inline-flex items-center gap-2 ${p.stock <= p.minStock ? 'bg-red-500/10 text-red-600 ring-1 ring-red-500/20' : 'bg-green-500/10 text-green-500 ring-1 ring-green-500/20'}`}>
      <div className={`w-2 h-2 rounded-full ${p.stock <= p.minStock ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-green-500'}`} />
      {p.stock} {t.unit || 'قطعة'}
      </span>
      </td>
      <td className="p-5 text-center">
      <div className="flex justify-center gap-2">
      <button onClick={() => handlePrintBarcode(p)} className="p-3 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl" title={t.print_barcode || 'طباعة باركود'}>
      <Printer size={18}/>
      </button>
      <button onClick={() => {setEditingProduct(p); setFormData(p); setIsModalOpen(true);}} className="p-3 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl">
      <Edit2 size={18}/>
      </button>
      <button onClick={() => initiateDelete([p.id])} className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl">
      <Trash2 size={18}/>
      </button>
      </div>
      </td>
      </tr>
    ))}
    </tbody>
    </table>
    </div>
    </div>
    </div>
  );
};

export default Inventory;
