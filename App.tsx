import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, POS, Inventory, Dashboard, Customers, Settings, Suppliers, Login, SearchHub, Debts, Zakat } from './components';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReprintModal } from './components/ReprintModal';
import { Product, Sale, Customer, AppSettings, Language, Supplier, User, CartItem, Debt, ZakatRecord, EmployeeSession, ZakatMadhab } from './types';
import { translations } from './i18n';


// ─── Storage helpers ────────────────────────────────────────────
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};


// ─── Initial Settings ───────────────────────────────────────────
const INITIAL_SETTINGS: AppSettings = {
  storeName: 'IIDZII POS',
  storeSubtitle: 'نظام إدارة المبيعات الذكي',
  storePhone: '',
  receiptFooter: 'شكراً لتعاملكم معنا',
  currency: 'DZD',
  interfaceLanguage: Language.AR,
  receiptLanguage: Language.AR,
  autoDetectLanguage: false,
  theme: 'dark',
  printerConfig: {
    fontSize: 11,
    density: 'medium',
    autoCut: true,
    thermalWidth: 80,
  },
  barcodePrintConfig: {
    width: 40,
    height: 25,
    showPrice: true,
    showName: true,
    fontSize: 10,
    copies: 1,
  },
  enableCamera: true,
  enableHIDScanner: true,
  security: {
    confirmDeleteInventory: false,
    confirmDeleteCustomers: false,
    confirmDeleteSuppliers: false,
    confirmDeleteUsers: false,
    adminPasswordRequiredForReset: true,
    autoBackupBeforeReset: true,
    maxBackupFiles: 5,
  },
  zakatReminderEnabled: false,
  zakatMadhab: 'hanafi',
  storeLogo: undefined,
  allowCartPriceEdit: true,
  allowEmployeeCartPriceEdit: false,
};


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    loadFromStorage<User | null>('currentUser', null)
  );
  const [users, setUsers] = useState<User[]>(() =>
    loadFromStorage('users', [
      { id: 'admin_1', username: 'admin', name: 'المدير', role: 'admin', password: 'admin', language: Language.AR },
      { id: 'seller_1', username: 'seller', name: 'البائع', role: 'seller', password: 'seller', language: Language.AR }
    ])
  );

  const [activeTab, setActiveTab] = useState('pos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage('products', []));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromStorage('suppliers', []));
  const [sales, setSales] = useState<Sale[]>(() => loadFromStorage('sales', []));
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = loadFromStorage('customers', []);
    // تحويل بيانات الزبائن القديمة - إزالة حقول الولاء
    return saved.map((c: any) => {
      const { points, pointsRemainder, vouchersUsed, ...rest } = c;
      return { ...rest, totalSpent: c.totalSpent || 0 };
    });
  });
  const [debts, setDebts] = useState<Debt[]>(() => loadFromStorage('debts', []));
  const [zakatRecords, setZakatRecords] = useState<ZakatRecord[]>(() => loadFromStorage('zakatRecords', []));
  const [employeeSessions, setEmployeeSessions] = useState<EmployeeSession[]>(() =>
    loadFromStorage('employeeSessions', [])
  );

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          printerConfig: { ...INITIAL_SETTINGS.printerConfig, ...(parsed.printerConfig || {}) },
          security: { ...INITIAL_SETTINGS.security, ...(parsed.security || {}) }
        };
      }
    } catch {}
    return INITIAL_SETTINGS;
  });

  const [isSavingSale, setIsSavingSale] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');
  const [reprintSale, setReprintSale] = useState<Sale | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const activeTabRef = useRef(activeTab);
  const showExitDialogRef = useRef(showExitDialog);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { showExitDialogRef.current = showExitDialog; }, [showExitDialog]);

  // ===== Auto-logout on app restart (all platforms) =====
  useEffect(() => {
    if (!sessionStorage.getItem('session_active')) {
      localStorage.removeItem('currentUser');
      setCurrentUser(null);
    }
    sessionStorage.setItem('session_active', '1');
  }, []);

  // ===== Language / Theme effects =====
  useEffect(() => {
    if (settings.interfaceLanguage === Language.AR) {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = settings.interfaceLanguage;
    }
  }, [settings.interfaceLanguage]);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0a0f1a';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc';
    }
  }, [settings.theme]);

  useEffect(() => {
    if (currentUser?.language) {
      setSettings(prev => ({ ...prev, language: currentUser.language!, interfaceLanguage: currentUser.language! }));
    }
  }, [currentUser]);

  // ===== Auto-save to localStorage =====
  const saveToStorage = useCallback((data: Record<string, any>) => {
    Object.entries(data).forEach(([key, value]) => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('Storage error:', e); }
    });
  }, []);

  useEffect(() => { saveToStorage({ settings }); }, [settings]);
  useEffect(() => { if (currentUser) saveToStorage({ products, customers, suppliers, users }); }, [products, customers, suppliers, users]);
  useEffect(() => { saveToStorage({ debts }); }, [debts]);
  useEffect(() => { saveToStorage({ zakatRecords }); }, [zakatRecords]);
  useEffect(() => { saveToStorage({ employeeSessions }); }, [employeeSessions]);

  // ===== Zakat reminder =====
  useEffect(() => {
    if (settings.zakatReminderEnabled && settings.zakatHawlDate) {
      const hawlTime = settings.zakatHawlDate;
      const now = Date.now();
      const daysLeft = Math.ceil((hawlTime - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7 && daysLeft >= 0) {
        console.log(`⚠️ الزكاة بعد ${daysLeft} أيام`);
      }
    }
  }, [settings.zakatReminderEnabled, settings.zakatHawlDate]);

  // ===== Employee Session Tracking =====
  const startEmployeeSession = useCallback((user: User) => {
    const session: EmployeeSession = {
      id: `SESSION_${Date.now()}`,
      userId: user.id,
      username: user.username,
      userName: user.name || user.username,
      loginAt: Date.now(),
      salesCount: 0,
      totalRevenue: 0
    };
    setEmployeeSessions(prev => [session, ...prev.slice(0, 999)]);
    return session.id;
  }, []);

  const endEmployeeSession = useCallback((userId: string) => {
    setEmployeeSessions(prev =>
      prev.map(s => (!s.logoutAt && s.userId === userId)
        ? { ...s, logoutAt: Date.now() }
        : s
      )
    );
  }, []);

  // ===== Auth =====
  const handleLogout = () => {
    if (currentUser) endEmployeeSession(currentUser.id);
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setActiveTab('pos');
  };

  const handleExitApp = async () => {
    handleLogout();
    setShowExitDialog(false);
    try {
      const { App: CapApp } = await import('@capacitor/app');
      CapApp.exitApp();
    } catch { window.close(); }
  };

  const handleLogin = (user: User, selectedLanguage: Language) => {
    const updatedUser = { ...user, language: selectedLanguage };
    setCurrentUser(updatedUser);
    setSettings(prev => ({ ...prev, language: selectedLanguage, interfaceLanguage: selectedLanguage }));
    saveToStorage({ currentUser: updatedUser });
    startEmployeeSession(updatedUser);
  };

  // ===== Sale completion =====
  const handleCompleteSale = async (sale: Sale): Promise<boolean> => {
    setIsSavingSale(true);
    setSaveError('');
    try {
      const saleWithSeller: Sale = {
        ...sale,
        sellerName: currentUser?.name || currentUser?.username || '',
        status: 'completed'
      };

      const updatedSales = [...sales, saleWithSeller];
      const updatedProducts = products.map(p => {
        const soldItem = sale.items.find(item => item.id === p.id);
        return soldItem ? { ...p, stock: Math.max(0, p.stock - soldItem.quantity) } : p;
      });

      // تحديث بيانات الزبون
      let updatedCustomers = customers;
      if (sale.customerId) {
        updatedCustomers = customers.map(c =>
          c.id === sale.customerId
            ? { ...c, totalSpent: (c.totalSpent || 0) + sale.total, lastVisit: Date.now() }
            : c
        );
      }

      // If payment method is debt, create debt record
      if (sale.paymentMethod === 'debt' && sale.customerId) {
        const customer = customers.find(c => c.id === sale.customerId);
        const newDebt: Debt = {
          id: `DEBT_${Date.now()}`,
          customerId: sale.customerId,
          customerName: sale.customerName || customer?.name || '',
          customerPhone: customer?.phone,
          amount: sale.total,
          paidAmount: sale.amountPaid || 0,
          remainingAmount: Math.max(0, sale.total - (sale.amountPaid || 0)),
          saleId: sale.id,
          createdAt: Date.now(),
          status: (sale.amountPaid || 0) > 0 ? 'partial' : 'pending',
          payments: [],
          createdBy: currentUser?.id || ''
        };
        setDebts(prev => [newDebt, ...prev]);
        saveToStorage({ debts: [newDebt, ...debts] });
      }

      saveToStorage({ products: updatedProducts, sales: updatedSales, customers: updatedCustomers });
      setSales(updatedSales);
      setProducts(updatedProducts);
      setCustomers(updatedCustomers);

      // Update employee session stats
      setEmployeeSessions(prev =>
        prev.map(s => (!s.logoutAt && s.userId === currentUser?.id)
          ? { ...s, salesCount: s.salesCount + 1, totalRevenue: s.totalRevenue + sale.total }
          : s
        )
      );

      setLastSaleId(sale.id);
      setIsSavingSale(false);
      setSaleComplete(true);
      return true;
    } catch (error: any) {
      setSaveError(error.message || 'فشل حفظ البيانات');
      setIsSavingSale(false);
      return false;
    }
  };

  const startNewSale = () => {
    setCart([]);
    setSaleComplete(false);
    setLastSaleId('');
    setSaveError('');
  };

  // ===== Data import with AUTO-REFRESH =====
  const handleDataImport = (d: any) => {
    if (d.products) { setProducts(d.products); saveToStorage({ products: d.products }); }
    if (d.customers) { setCustomers(d.customers); saveToStorage({ customers: d.customers }); }
    if (d.suppliers) { setSuppliers(d.suppliers); saveToStorage({ suppliers: d.suppliers }); }
    if (d.settings) { setSettings(s => ({ ...INITIAL_SETTINGS, ...d.settings })); localStorage.setItem('settings', JSON.stringify(d.settings)); }
    if (d.sales) { setSales(d.sales); saveToStorage({ sales: d.sales }); }
    if (d.users) { setUsers(d.users); saveToStorage({ users: d.users }); }
    if (d.debts) { setDebts(d.debts); saveToStorage({ debts: d.debts }); }

    // ✅ AUTO-REFRESH after import
    setTimeout(() => window.location.reload(), 500);
  };

  const handleResetSystem = async (): Promise<boolean> => {
    if (currentUser?.role !== 'admin') { alert('هذه العملية مسموحة فقط لمدير النظام'); return false; }
    if (!window.confirm('⚠️ هل أنت متأكد من إعادة تعيين النظام؟\nسيتم حذف جميع البيانات. هذا الإجراء لا يمكن التراجع عنه!')) return false;

    const adminPassword = prompt('🔒 أدخل كلمة مرور المدير للتأكيد:');
    const adminUser = users.find(u => u.role === 'admin');
    if (!adminUser || adminPassword !== adminUser.password) { alert('❌ كلمة مرور خاطئة'); return false; }

    // Backup
    const blob = new Blob([JSON.stringify({ timestamp: new Date().toISOString(), products, sales, customers, suppliers, users, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `iidzii-backup-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);

    setTimeout(() => {
      if (window.confirm('✅ تم تحميل النسخة الاحتياطية. هل تريد المتابعة في إعادة التعيين؟')) {
        localStorage.clear();
        window.location.reload();
      }
    }, 1000);
    return true;
  };

  // Admin password validator for delete confirmations
  React.useEffect(() => {
    (window as any).__matjariValidateAdminPass = (pass: string): boolean => {
      const admin = users.find(u => u.role === 'admin');
      return admin ? admin.password === pass : false;
    };
    return () => { delete (window as any).__matjariValidateAdminPass; };
  }, [users]);

  // Reprint sale invoice from SearchHub
  React.useEffect(() => {
    (window as any).__matjariReprintSale = (sale: Sale) => {
      setReprintSale(sale);
    };
    return () => { delete (window as any).__matjariReprintSale; };
  }, []);

  // Register window helper for POS quick-add customer
  React.useEffect(() => {
    (window as any).__matjariAddCustomer = (newCust: Customer) => {
      const cust: Customer = { ...newCust };
      setCustomers(prev => {
        const updated = [cust, ...prev];
        try { localStorage.setItem('customers', JSON.stringify(updated)); } catch {}
        return updated;
      });
    };
    return () => { delete (window as any).__matjariAddCustomer; };
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      return ex
        ? prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { ...product, quantity: 1, itemDiscount: 0, cartKey: product.id }];
    });
  };

  const handleNavigateToTab = (tab: string, itemId?: string) => {
    setActiveTab(tab);
    if (itemId) {
      setTimeout(() => {
        localStorage.setItem('selectedItem', itemId);
        window.dispatchEvent(new CustomEvent('itemSelected', { detail: { itemId } }));
      }, 100);
    }
  };

  // Computed values for Zakat
  const inventoryValue = products.reduce((acc, p) => acc + (p.cost * p.stock), 0);
  const totalDebtsReceivable = debts
    .filter(d => d.status !== 'paid')
    .reduce((acc, d) => acc + d.remainingAmount, 0);

  // Statistics helpers
  const getTopCustomers = () => [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
  const getTopProducts = () => {
    const map: Record<string, { product: Product, quantity: number, revenue: number }> = {};
    sales.forEach(s => s.items.forEach(item => {
      if (!map[item.id]) { const p = products.find(p => p.id === item.id); if (p) map[item.id] = { product: p, quantity: 0, revenue: 0 }; }
      if (map[item.id]) { map[item.id].quantity += item.quantity; map[item.id].revenue += item.price * item.quantity; }
    }));
    return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  };
  const getCustomerProducts = (customerId: string) => {
    const map: Record<string, { product: Product, quantity: number }> = {};
    sales.filter(s => s.customerId === customerId).forEach(s =>
      s.items.forEach(item => {
        if (!map[item.id]) { const p = products.find(p => p.id === item.id); if (p) map[item.id] = { product: p, quantity: 0 }; }
        if (map[item.id]) map[item.id].quantity += item.quantity;
      })
    );
    return Object.values(map).sort((a, b) => b.quantity - a.quantity);
  };

  // Android back button — listener مسجّل مرة واحدة، يقرأ الحالة عبر refs
  React.useEffect(() => {
    let listenerHandle: { remove: () => void } | null = null;
    const addBackListener = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        listenerHandle = await CapApp.addListener('backButton', () => {
          if (showExitDialogRef.current) {
            setShowExitDialog(false);
            return;
          }
          if (activeTabRef.current !== 'pos') {
            setActiveTab('pos');
          } else {
            setShowExitDialog(true);
          }
        });
      } catch { /* not on Android */ }
    };
    addBackListener();
    return () => { listenerHandle?.remove(); };
  }, []);

  const t = translations[settings.interfaceLanguage] || translations[Language.AR];

  const ExitDialog = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1e293b] rounded-3xl p-6 w-full max-w-xs shadow-2xl border border-gray-100 dark:border-white/10 text-center">
        <div className="text-5xl mb-3">⚠️</div>
        <h3 className="text-gray-800 dark:text-white font-black text-lg mb-1">
          {t?.exit_app_title || 'إنهاء التطبيق؟'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          {t?.exit_app_desc || 'سيتم تسجيل الخروج تلقائياً عند إعادة الفتح'}
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleExitApp}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl font-black text-base transition-all active:scale-95">
            {t?.exit_confirm || 'إنهاء التطبيق'}
          </button>
          <button
            onClick={() => setShowExitDialog(false)}
            className="w-full bg-gray-100 dark:bg-gray-800 dark:text-white py-3 rounded-2xl font-black text-base transition-all">
            {t?.cancel || 'تراجع'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <>
        <Login users={users} onLogin={handleLogin} initialLanguage={settings.interfaceLanguage} />
        {showExitDialog && <ExitDialog />}
      </>
    );
  }


  return (
    <ErrorBoundary>
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} settings={settings} currentUser={currentUser} t={t}>
      {/* Sale saving overlay */}
      {isSavingSale && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-black text-gray-800 dark:text-white">{t.saving || 'جاري الحفظ...'}</h3>
          </div>
        </div>
      )}

      {(saleComplete || saveError) && (
        <div className="fixed inset-0 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: saveError ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)' }}>
          <div className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl">
            {saveError ? (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">❌ {t.error || 'خطأ'}</h3>
                <p className="text-gray-600 text-sm mb-4">{saveError}</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">✅ {t.success || 'تم'}</h3>
                <p className="text-gray-600 text-sm mb-1">{t.data_saved || 'تم حفظ عملية البيع'}</p>
                <p className="text-xs text-gray-500 mb-4">{t.invoice_number || 'رقم الفاتورة'}: #{lastSaleId}</p>
              </>
            )}
            <button onClick={startNewSale} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-lg">
              {saveError ? (t.retry || 'إعادة المحاولة') : (t.start_new_sale || 'بيعة جديدة')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'pos' && (
        <POS
          products={products} cart={cart} setCart={setCart}
          onCompleteSale={handleCompleteSale} settings={settings}
          customers={customers} currentUser={currentUser}
          onNavigateToSale={() => setActiveTab('search')}
          isSaving={isSavingSale} saleComplete={saleComplete}
          onStartNewSale={startNewSale} saveError={saveError} t={t}
          sales={sales} setSales={setSales} setProducts={setProducts}
          setSettings={setSettings} users={users}
        />
      )}
      {activeTab === 'inventory' && (
        <Inventory products={products} setProducts={setProducts} suppliers={suppliers} setSuppliers={setSuppliers} settings={settings} currentUser={currentUser} t={t} />
      )}
      {activeTab === 'suppliers' && (
        <Suppliers suppliers={suppliers} setSuppliers={setSuppliers} settings={settings} currentUser={currentUser} t={t}
          onNavigateToInventory={() => handleNavigateToTab('inventory')} products={products} />
      )}
      {activeTab === 'dashboard' && (
        <Dashboard
          sales={sales} products={products} customers={customers} suppliers={suppliers}
          settings={settings} currentUser={currentUser} onDataImport={handleDataImport}
          users={users} onNavigateToTab={handleNavigateToTab} t={t}
          getTopCustomers={getTopCustomers} getTopProducts={getTopProducts}
          getCustomerProducts={getCustomerProducts}
          employeeSessions={employeeSessions} debts={debts}
        />
      )}
      {activeTab === 'customers' && (
        <Customers customers={customers} setCustomers={setCustomers} settings={settings} currentUser={currentUser} t={t} />
      )}
      {activeTab === 'debts' && (
        <Debts debts={debts} setDebts={setDebts} customers={customers} settings={settings} currentUser={currentUser} t={t} />
      )}
      {activeTab === 'zakat' && (
        <Zakat
          settings={settings} setSettings={setSettings}
          inventoryValue={inventoryValue} totalDebtsReceivable={totalDebtsReceivable}
          zakatRecords={zakatRecords} setZakatRecords={setZakatRecords} t={t}
        />
      )}
      {activeTab === 'search' && (
        <SearchHub
          products={products} customers={customers} sales={sales} suppliers={suppliers}
          settings={settings} onAddToCart={addToCart} onNavigateToTab={handleNavigateToTab} t={t}
          setSales={setSales} setProducts={setProducts} currentUser={currentUser}
        />
      )}
      {activeTab === 'settings' && (
        <Settings
          settings={settings} setSettings={setSettings} users={users} setUsers={setUsers}
          currentUser={currentUser} onUpdateCurrentUser={setCurrentUser}
          onLogout={handleLogout} onResetSystem={handleResetSystem}
          products={products} sales={sales} customers={customers} suppliers={suppliers} debts={debts} t={t}
        />
      )}
    </Layout>

    {/* ═══ REPRINT RECEIPT MODAL ═══ */}
    {reprintSale && (
      <ReprintModal
        sale={reprintSale}
        settings={settings}
        currentUser={currentUser}
        t={t}
        onClose={() => setReprintSale(null)}
      />
    )}
    {/* ═══ EXIT CONFIRMATION DIALOG ═══ */}
    {showExitDialog && <ExitDialog />}

    </ErrorBoundary>
  );
};

export default App;
