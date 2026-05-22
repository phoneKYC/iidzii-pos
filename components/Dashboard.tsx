import React, { useMemo, useRef, useState } from 'react';
import {
  TrendingUp, Users, ShoppingBag, DollarSign, AlertTriangle,
  Package, Download, Upload, Clock, BarChart3, TrendingDown,
  Star, UserCheck, ArrowRight, Crown, Calculator, CreditCard,
  Activity, Calendar, CheckCircle, XCircle
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Sale, Product, AppSettings, User, Customer, Supplier, EmployeeSession, Debt } from '../types';
import { Calculator as CalculatorWidget } from './Calculator';

interface DashboardProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  settings: AppSettings;
  currentUser: User;
  onDataImport: (data: any) => void;
  users: User[];
  onNavigateToTab: (tab: string, itemId?: string) => void;
  t?: any;
  getTopCustomers: () => Customer[];
  getTopProducts: () => { product: Product; quantity: number; revenue: number }[];
  getCustomerProducts: (id: string) => { product: Product; quantity: number }[];
  employeeSessions?: EmployeeSession[];
  debts?: Debt[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const Dashboard: React.FC<DashboardProps> = ({
  sales, products, customers, suppliers, settings, currentUser, onDataImport, users,
  onNavigateToTab, t = {}, getTopCustomers, getTopProducts, getCustomerProducts,
  employeeSessions = [], debts = []
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'sales' | 'inventory' | 'staff' | 'debts'>('overview');
  const isAdmin = currentUser.role === 'admin';
  const isRTL = settings.interfaceLanguage === 'ar';
  const cur = settings.currency;

  const stats = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 86400000;
    const monthStart = now - 30 * 86400000;

    const mySales = isAdmin ? sales : sales.filter(s => s.sellerId === currentUser.id);
    const todaySales = mySales.filter(s => s.timestamp >= todayStart);
    const weekSales = mySales.filter(s => s.timestamp >= weekStart);
    const monthSales = mySales.filter(s => s.timestamp >= monthStart);

    const rev = (arr: Sale[]) => arr.reduce((a, s) => a + s.total, 0);

    const lowStock = products.filter(p => p.stock <= p.minStock);
    const outOfStock = products.filter(p => p.stock === 0);

    // Sales by day (last 7 days)
    const dailyData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86400000);
      const dayStart = new Date(d).setHours(0, 0, 0, 0);
      const dayEnd = dayStart + 86400000;
      const daySales = mySales.filter(s => s.timestamp >= dayStart && s.timestamp < dayEnd);
      return {
        day: d.toLocaleDateString('ar-DZ', { weekday: 'short' }),
        sales: daySales.length,
        revenue: rev(daySales)
      };
    });

    // Top categories
    const catMap: Record<string, number> = {};
    sales.forEach(s => s.items.forEach(item => {
      const p = products.find(pr => pr.id === item.id);
      if (p?.category) catMap[p.category] = (catMap[p.category] || 0) + item.price * item.quantity;
    }));
    const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));

    // Staff performance
    const staffPerf = isAdmin ? users.map(u => {
      const uSales = sales.filter(s => s.sellerId === u.id);
      const todayUSales = uSales.filter(s => s.timestamp >= todayStart);
      const sessions = employeeSessions.filter(s => s.userId === u.id);
      const activeSession = sessions.find(s => !s.logoutAt);
      const lastSession = sessions[0];
      return {
        ...u,
        totalSales: uSales.length,
        totalRevenue: rev(uSales),
        todaySales: todayUSales.length,
        todayRevenue: rev(todayUSales),
        isOnline: !!activeSession,
        lastLogin: lastSession?.loginAt,
        sessionDuration: activeSession ? Math.round((now - activeSession.loginAt) / 60000) : 0
      };
    }) : [];

    // Debts stats
    const totalDebt = debts.reduce((a, d) => a + d.remainingAmount, 0);
    const overdueDebts = debts.filter(d => d.dueDate && d.dueDate < now && d.status !== 'paid').length;

    return {
      todayRevenue: rev(todaySales), todayCount: todaySales.length,
      weekRevenue: rev(weekSales), weekCount: weekSales.length,
      monthRevenue: rev(monthSales), monthCount: monthSales.length,
      totalRevenue: rev(mySales), totalCount: mySales.length,
      lowStock, outOfStock,
      dailyData, categories,
      staffPerf, totalDebt, overdueDebts,
      topProducts: getTopProducts(),
      topCustomers: getTopCustomers()
    };
  }, [sales, products, customers, users, employeeSessions, debts, isAdmin, currentUser.id]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        onDataImport(data);
      } catch { alert('ملف غير صالح'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportSoldItemsReport = () => {
    // Aggregate sold items from all sales
    const itemsMap: Record<string, { name: string; barcode: string; quantity: number; revenue: number; sales: number }> = {};
    
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!itemsMap[item.id]) {
          itemsMap[item.id] = { name: item.name, barcode: item.barcode || (item as any).localBarcode || '', quantity: 0, revenue: 0, sales: 0 };
        }
        itemsMap[item.id].quantity += item.quantity;
        itemsMap[item.id].revenue += item.price * item.quantity;
        itemsMap[item.id].sales += 1;
      });
    });

    const rows = Object.values(itemsMap).sort((a, b) => b.revenue - a.revenue);
    
    // Generate CSV with UTF-8 BOM
    const BOM = '\uFEFF';
    const headers = ['المنتج', 'الباركود', 'الكمية المباعة', 'عدد العمليات', 'إجمالي الإيرادات'];
    const csvRows = rows.map(r => [r.name, r.barcode, r.quantity, r.sales, r.revenue.toFixed(2)]);
    const csv = BOM + [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_المبيعات_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    const data = { timestamp: new Date().toISOString(), sales, products, customers, suppliers, users, settings, debts };
    const jsonStr = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `iidzii-backup-${dateStr}.json`;

    const isAndroid = !!(window as any).Capacitor?.isNativePlatform?.() &&
      (window as any).Capacitor?.getPlatform?.() === 'android';

    if (isAndroid) {
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        await Filesystem.writeFile({ path: filename, data: jsonStr, directory: Directory.Cache, encoding: Encoding.UTF8 });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({ title: filename, url: uri, dialogTitle: '💾 حفظ النسخة الاحتياطية — اختر Drive أو مدير الملفات' });
      } catch (e) { console.error(e); }
      return;
    }
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const views = [
    { id: 'overview', label: t.overview || 'نظرة عامة', icon: <Activity size={16} /> },
    { id: 'sales', label: t.sales || 'المبيعات', icon: <TrendingUp size={16} /> },
    { id: 'inventory', label: t.inventory || 'المخزون', icon: <Package size={16} /> },
    { id: 'staff', label: t.staff || 'الموظفون', icon: <Users size={16} />, adminOnly: true },
    { id: 'debts', label: t.debts || 'الديون', icon: <CreditCard size={16} /> },
  ].filter(v => !v.adminOnly || isAdmin);

  return (
    <div className="space-y-5 font-cairo" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
            <BarChart3 size={28} className="text-primary" /> {t.dashboard || 'لوحة التحكم'}
          </h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportSoldItemsReport} className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm hover:border-green-500 hover:text-green-600 transition-all">
            <Download size={16} /> {t.export_report || 'تصدير تقرير'}
          </button>
          <button onClick={() => setShowCalc(!showCalc)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${showCalc ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
            <Calculator size={16} /> {t.calculator || 'حاسبة'}
          </button>
          {isAdmin && (
            <>
              <button onClick={handleExport} className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm hover:border-primary hover:text-primary transition-all">
                <Download size={16} /> {t.backup || 'نسخ احتياطي'}
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all">
                <Upload size={16} /> {t.import || 'استيراد'}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </>
          )}
        </div>
      </div>

      {/* Calculator popup */}
      {showCalc && (
        <div className="flex justify-center">
          <CalculatorWidget theme={settings.theme} onClose={() => setShowCalc(false)} t={t} />
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t.today || 'اليوم', value: stats.todayRevenue.toFixed(2), sub: `${stats.todayCount} ${t.sale || 'عملية'}`, icon: <DollarSign size={22} />, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', action: () => setActiveView('sales') },
          { label: t.this_week || 'هذا الأسبوع', value: stats.weekRevenue.toFixed(2), sub: `${stats.weekCount} ${t.sale || 'عملية'}`, icon: <TrendingUp size={22} />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', action: () => setActiveView('sales') },
          { label: t.low_stock || 'مخزون منخفض', value: stats.lowStock.length, sub: `${stats.outOfStock.length} ${t.out_of_stock || 'نفد'}`, icon: <AlertTriangle size={22} />, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', action: () => setActiveView('inventory') },
          { label: t.debts || 'الديون المتبقية', value: stats.totalDebt.toFixed(2), sub: `${stats.overdueDebts} ${t.overdue || 'متأخرة'}`, icon: <CreditCard size={22} />, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', action: () => { setActiveView('debts'); onNavigateToTab('debts'); } },
        ].map((s, i) => (
          <button key={i} onClick={s.action} className={`${s.bg} rounded-2xl p-4 border border-transparent hover:border-primary/30 transition-all text-start`}>
            <div className={`${s.color} mb-2`}>{s.icon}</div>
            <div className="text-xl font-black text-gray-800 dark:text-white leading-none">{s.value} <span className="text-xs text-gray-500">{i < 2 || i === 3 ? cur : ''}</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            <div className="text-[10px] text-gray-400 mt-1">{s.sub}</div>
          </button>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {views.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0 transition-all ${activeView === v.id ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary'}`}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeView === 'overview' && (
        <div className="space-y-5">
          {/* Revenue chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="font-black text-gray-800 dark:text-white mb-4">{t.weekly_revenue || 'المبيعات اليومية (7 أيام)'}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.dailyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: 'Cairo' }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [`${parseFloat(v).toFixed(2)} ${cur}`, t.revenue || 'الإيرادات']} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#colorRev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top products + categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
              <h2 className="font-black text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Crown size={18} className="text-yellow-500" /> {t.top_products || 'أكثر المنتجات مبيعاً'}
              </h2>
              {stats.topProducts.slice(0, 5).map((tp, i) => (
                <button key={tp.product.id} onClick={() => onNavigateToTab('inventory', tp.product.id)}
                  className="w-full flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-2 transition-all last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-yellow-100 text-yellow-600' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-500'}`}>{i + 1}</span>
                  <div className="flex-1 text-start min-w-0">
                    <div className="font-bold text-xs text-gray-800 dark:text-white truncate">{tp.product.name}</div>
                    <div className="text-[10px] text-gray-500">{tp.quantity} {t.units || 'وحدة'}</div>
                  </div>
                  <div className="font-black text-xs text-primary flex-shrink-0">{tp.revenue.toFixed(2)} {cur}</div>
                </button>
              ))}
              {stats.topProducts.length === 0 && <p className="text-center text-gray-400 text-sm py-4">{t.no_data || 'لا توجد بيانات'}</p>}
            </div>

            {stats.categories.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                <h2 className="font-black text-gray-800 dark:text-white mb-4">{t.sales_by_category || 'المبيعات حسب الصنف'}</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={stats.categories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                      {stats.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${parseFloat(v).toFixed(2)} ${cur}`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {stats.categories.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-gray-600 dark:text-gray-400">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SALES VIEW */}
      {activeView === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t.today || 'اليوم', v: stats.todayRevenue, c: stats.todayCount },
              { label: t.this_week || 'الأسبوع', v: stats.weekRevenue, c: stats.weekCount },
              { label: t.this_month || 'الشهر', v: stats.monthRevenue, c: stats.monthCount },
              { label: t.total || 'الإجمالي', v: stats.totalRevenue, c: stats.totalCount },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
                <div className="text-xl font-black text-primary">{s.v.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{cur} — {s.c} {t.sale || 'عملية'}</div>
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="font-black text-gray-800 dark:text-white mb-4">{t.daily_sales_chart || 'مبيعات الأسبوع'}</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: 'Cairo' }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any, n: string) => [n === 'revenue' ? `${parseFloat(v).toFixed(2)} ${cur}` : v, n === 'revenue' ? t.revenue : t.count || 'عدد']} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Top customers */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="font-black text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Star size={18} className="text-yellow-500" /> {t.top_customers || 'أفضل الزبائن'}
            </h2>
            {stats.topCustomers.slice(0, 5).map((c, i) => (
              <button key={c.id} onClick={() => onNavigateToTab('customers', c.id)}
                className="w-full flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-2 transition-all last:border-0">
                <span className="text-lg">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i] || ''}</span>
                <div className="flex-1 text-start">
                  <div className="font-bold text-sm dark:text-white">{c.name}</div>
                  <div className="text-[10px] text-gray-500">{c.totalSpent.toFixed(2)} {cur} {t.total_spent || 'إجمالي المشتريات'}</div>
                </div>
                <ArrowRight size={14} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* INVENTORY VIEW */}
      {activeView === 'inventory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: t.total_products || 'إجمالي المنتجات', value: products.length, color: 'text-primary', bg: 'bg-primary/10' },
              { label: t.low_stock_products || 'مخزون منخفض', value: stats.lowStock.length, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
              { label: t.out_of_stock || 'نفد المخزون', value: stats.outOfStock.length, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-2xl p-4 text-center`}>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {stats.lowStock.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border-2 border-orange-200 dark:border-orange-700 shadow-sm">
              <h2 className="font-black text-orange-700 dark:text-orange-400 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} /> {t.low_stock_alert || 'تنبيه: مخزون منخفض'}
              </h2>
              <div className="space-y-2">
                {stats.lowStock.map(p => (
                  <button key={p.id} onClick={() => onNavigateToTab('inventory', p.id)}
                    className="w-full flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 hover:bg-orange-100 transition-all">
                    <span className="font-bold text-sm text-gray-800 dark:text-white">{p.name}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black ${p.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>{p.stock}</span>
                      <ArrowRight size={14} className="text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAFF VIEW */}
      {activeView === 'staff' && isAdmin && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.staffPerf.map(u => (
              <div key={u.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black flex-shrink-0 ${u.isOnline ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {(u.name || u.username).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-800 dark:text-white">{u.name || u.username}</span>
                      {u.isOnline
                        ? <span className="text-[9px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><CheckCircle size={9} /> متصل</span>
                        : <span className="text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full font-bold">غير متصل</span>}
                    </div>
                    <div className="text-xs text-gray-500">{u.role === 'admin' ? '👑 مدير' : '👤 بائع'}</div>
                    {u.isOnline && <div className="text-xs text-green-600 mt-0.5">⏱ منذ {u.sessionDuration} دقيقة</div>}
                    {u.lastLogin && !u.isOnline && <div className="text-xs text-gray-400 mt-0.5">آخر دخول: {new Date(u.lastLogin).toLocaleString('ar-DZ')}</div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-xl font-black text-primary">{u.todaySales}</div>
                    <div className="text-[10px] text-gray-500">{t.today_sales || 'مبيعات اليوم'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-green-600">{u.todayRevenue.toFixed(0)}</div>
                    <div className="text-[10px] text-gray-500">{cur} {t.today || 'اليوم'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-gray-700 dark:text-gray-300">{u.totalSales}</div>
                    <div className="text-[10px] text-gray-500">{t.total_sales || 'إجمالي المبيعات'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-gray-700 dark:text-gray-300">{u.totalRevenue.toFixed(0)}</div>
                    <div className="text-[10px] text-gray-500">{cur} {t.total || 'إجمالي'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEBTS VIEW */}
      {activeView === 'debts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: t.total_debts || 'إجمالي الديون', value: debts.reduce((a, d) => a + d.amount, 0).toFixed(2), color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
              { label: t.remaining || 'المتبقي', value: stats.totalDebt.toFixed(2), color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
              { label: t.overdue_debts || 'متأخرة', value: stats.overdueDebts, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-2xl p-4 text-center`}>
                <div className={`text-2xl font-black ${s.color}`}>{s.value} {i < 2 ? cur : ''}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigateToTab('debts')} className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all">
            <CreditCard size={18} /> {t.manage_debts || 'إدارة الديون'}
          </button>
          {debts.filter(d => d.status !== 'paid').slice(0, 5).map(d => (
            <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm dark:text-white">{d.customerName}</div>
                <div className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleDateString('ar-DZ')}</div>
              </div>
              <div className="text-end">
                <div className="font-black text-red-500">{d.remainingAmount.toFixed(2)} {cur}</div>
                <div className="text-[10px] text-gray-400">{d.status === 'partial' ? 'جزئي' : 'معلق'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
