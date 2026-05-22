import React, { useState, useMemo } from 'react';
import {
  CreditCard, Plus, Search, Check, Clock, AlertTriangle, User,
  Phone, DollarSign, Calendar, ChevronDown, ChevronUp, X, Edit2,
  Trash2, TrendingDown, FileText, CheckCircle
} from 'lucide-react';
import { Debt, DebtPayment, Customer, AppSettings, User as AuthUser } from '../types';

interface DebtsProps {
  debts: Debt[];
  setDebts: React.Dispatch<React.SetStateAction<Debt[]>>;
  customers: Customer[];
  settings: AppSettings;
  currentUser: AuthUser;
  t?: any;
}

export const Debts: React.FC<DebtsProps> = ({
  debts, setDebts, customers, settings, currentUser, t = {}
}) => {
  const isRTL = settings.interfaceLanguage === 'ar';
  const cur = settings.currency || 'DZD';
  const isAdmin = currentUser.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'partial' | 'paid'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [undoDebt, setUndoDebt] = useState<{debt: Debt, timer: any, timeLeft: number} | null>(null);
  const [deletePassModal, setDeletePassModal] = useState<string | null>(null); // debt id
  const [deletePassInput, setDeletePassInput] = useState('');
  const [wrongPassDebt, setWrongPassDebt] = useState(false);

  const [newDebt, setNewDebt] = useState({
    customerName: '',
    customerId: '',
    customerPhone: '',
    amount: '',
    dueDate: '',
    notes: ''
  });
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // ── تعديل الدين ───────────────────────────────────────────────
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ amount: '', dueDate: '', notes: '', customerPhone: '' });

  const openEditDebt = (debt: Debt) => {
    setEditingDebt(debt);
    setEditForm({
      amount: debt.amount.toString(),
      dueDate: debt.dueDate ? new Date(debt.dueDate).toISOString().split('T')[0] : '',
      notes: debt.notes || '',
      customerPhone: debt.customerPhone || '',
    });
    setShowEditModal(true);
  };

  const handleEditDebt = () => {
    if (!editingDebt || !editForm.amount) return;
    const newAmount = parseFloat(editForm.amount);
    const paidSoFar = editingDebt.paidAmount;
    const newRemaining = Math.max(0, newAmount - paidSoFar);
    setDebts(prev => prev.map(d => d.id === editingDebt.id ? {
      ...d,
      amount: newAmount,
      remainingAmount: newRemaining,
      paidAmount: paidSoFar,
      status: newRemaining === 0 ? 'paid' : paidSoFar > 0 ? 'partial' : 'pending',
      dueDate: editForm.dueDate ? new Date(editForm.dueDate).getTime() : d.dueDate,
      notes: editForm.notes || d.notes,
      customerPhone: editForm.customerPhone || d.customerPhone,
    } : d));
    setShowEditModal(false);
    setEditingDebt(null);
  };

  const filtered = useMemo(() => {
    return debts.filter(d => {
      const matchSearch =
        d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.customerPhone || '').includes(searchQuery);
      const matchStatus = filterStatus === 'all' || d.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [debts, searchQuery, filterStatus]);

  const totalStats = useMemo(() => {
    const total = debts.reduce((a, d) => a + d.amount, 0);
    const paid = debts.reduce((a, d) => a + d.paidAmount, 0);
    const remaining = debts.reduce((a, d) => a + d.remainingAmount, 0);
    const overdueCount = debts.filter(d => d.dueDate && d.dueDate < Date.now() && d.status !== 'paid').length;
    return { total, paid, remaining, overdueCount };
  }, [debts]);

  const handleAddDebt = () => {
    if (!newDebt.customerName || !newDebt.amount) return;
    const amount = parseFloat(newDebt.amount);
    const debt: Debt = {
      id: `DEBT_${Date.now()}`,
      customerId: newDebt.customerId || undefined,
      customerName: newDebt.customerName,
      customerPhone: newDebt.customerPhone || undefined,
      amount,
      paidAmount: 0,
      remainingAmount: amount,
      createdAt: Date.now(),
      dueDate: newDebt.dueDate ? new Date(newDebt.dueDate).getTime() : undefined,
      status: 'pending',
      notes: newDebt.notes || undefined,
      payments: [],
      createdBy: currentUser.id
    };
    setDebts(prev => [debt, ...prev]);
    setShowAddModal(false);
    setNewDebt({ customerName: '', customerId: '', customerPhone: '', amount: '', dueDate: '', notes: '' });
  };

  const handlePayment = () => {
    if (!selectedDebt || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (amount <= 0 || amount > selectedDebt.remainingAmount) return;

    const payment: DebtPayment = {
      id: `PAY_${Date.now()}`,
      amount,
      paidAt: Date.now(),
      receivedBy: currentUser.id,
      notes: payNotes || undefined
    };

    const newPaid = selectedDebt.paidAmount + amount;
    const newRemaining = selectedDebt.amount - newPaid;
    const newStatus: Debt['status'] = newRemaining <= 0 ? 'paid' : 'partial';

    setDebts(prev => prev.map(d =>
      d.id === selectedDebt.id
        ? { ...d, paidAmount: newPaid, remainingAmount: Math.max(0, newRemaining), status: newStatus, payments: [...d.payments, payment] }
        : d
    ));
    setShowPayModal(false);
    setPayAmount('');
    setPayNotes('');
    setSelectedDebt(null);
  };

  const handleDeleteDebt = (id: string) => {
    if (!isAdmin) return;
    // Check if password confirmation required
    if (settings.security?.confirmDeleteInventory) {
      setDeletePassModal(id);
      setDeletePassInput('');
    } else {
      proceedDeleteDebt(id);
    }
  };

  const proceedDeleteDebt = (id: string) => {
    const debt = debts.find(d => d.id === id);
    if (!debt) return;
    setDebts(prev => prev.filter(d => d.id !== id));
    // Undo mechanism
    if (undoDebt?.timer) clearInterval(undoDebt.timer);
    let timeLeft = 8;
    const timer = setInterval(() => {
      setUndoDebt(prev => {
        if (!prev) return null;
        if (prev.timeLeft <= 1) { clearInterval(prev.timer); return null; }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    setUndoDebt({ debt, timer, timeLeft });
  };

  const statusColor = (s: Debt['status']) => {
    if (s === 'paid') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (s === 'partial') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  const statusLabel = (s: Debt['status']) => {
    if (s === 'paid') return t.paid || 'مدفوع';
    if (s === 'partial') return t.partial || 'جزئي';
    return t.pending || 'معلق';
  };

  const isOverdue = (d: Debt) => d.dueDate && d.dueDate < Date.now() && d.status !== 'paid';

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
            <CreditCard size={28} className="text-primary" />
            {t.debts || 'إدارة الديون'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{t.debts_subtitle || 'تتبع ديون الزبائن ومدفوعاتهم'}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all"
        >
          <Plus size={18} />
          {t.add_debt || 'إضافة دين'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.total_debts || 'إجمالي الديون', value: totalStats.total.toFixed(2), icon: <TrendingDown size={18} />, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: t.total_paid || 'المدفوع', value: totalStats.paid.toFixed(2), icon: <CheckCircle size={18} />, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: t.remaining || 'المتبقي', value: totalStats.remaining.toFixed(2), icon: <Clock size={18} />, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
          { label: t.overdue || 'متأخرة', value: totalStats.overdueCount, icon: <AlertTriangle size={18} />, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-3 border border-gray-100 dark:border-gray-700`}>
            <div className={`${s.color} mb-1`}>{s.icon}</div>
            <div className="text-lg font-black text-gray-800 dark:text-white">{s.value} {i < 3 ? cur : ''}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-3 start-3 text-gray-400" />
          <input
            type="text"
            placeholder={t.search_customer || 'بحث باسم الزبون أو الهاتف...'}
            className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'partial', 'paid'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                filterStatus === s ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {s === 'all' ? (t.all || 'الكل') : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Debts List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold text-lg">{t.no_debts || 'لا توجد ديون'}</p>
          </div>
        ) : (
          filtered.map(debt => (
            <div key={debt.id} className={`bg-white dark:bg-gray-800 rounded-xl border-2 shadow-sm overflow-hidden transition-all ${
              isOverdue(debt) ? 'border-orange-300 dark:border-orange-700' : 'border-gray-100 dark:border-gray-700'
            }`}>
              {/* Debt Header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-800 dark:text-white truncate">{debt.customerName}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColor(debt.status)}`}>
                          {statusLabel(debt.status)}
                        </span>
                        {isOverdue(debt) && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-600">
                            ⏰ {t.overdue || 'متأخرة'}
                          </span>
                        )}
                      </div>
                      {debt.customerPhone && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Phone size={12} />
                          <span dir="ltr">{debt.customerPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <div className="text-lg font-black text-gray-800 dark:text-white">
                      {debt.remainingAmount.toFixed(2)} <span className="text-xs text-gray-500">{cur}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {t.of || 'من'} {debt.amount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(100, (debt.paidAmount / debt.amount) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{t.paid || 'مدفوع'}: {debt.paidAmount.toFixed(2)} {cur}</span>
                  {debt.dueDate && (
                    <span className={isOverdue(debt) ? 'text-orange-500 font-bold' : ''}>
                      {t.due_date || 'الأجل'}: {new Date(debt.dueDate).toLocaleDateString('ar-DZ')}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  {debt.status !== 'paid' && (
                    <button
                      onClick={() => { setSelectedDebt(debt); setPayAmount(''); setShowPayModal(true); }}
                      className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all flex-1 justify-center"
                    >
                      <DollarSign size={14} />
                      {t.add_payment || 'تسجيل دفعة'}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => openEditDebt(debt)}
                      className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === debt.id ? null : debt.id)}
                    className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
                  >
                    <FileText size={14} />
                    {expandedId === debt.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteDebt(debt.id)}
                      className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded payments */}
              {expandedId === debt.id && (
                <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
                  {debt.notes && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 mb-3">
                      📝 {debt.notes}
                    </p>
                  )}
                  <h4 className="text-xs font-bold text-gray-500 mb-2">
                    {t.payment_history || 'سجل المدفوعات'} ({debt.payments.length})
                  </h4>
                  {debt.payments.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">{t.no_payments || 'لا توجد مدفوعات بعد'}</p>
                  ) : (
                    <div className="space-y-2">
                      {debt.payments.map(pay => (
                        <div key={pay.id} className="flex items-center justify-between text-xs bg-white dark:bg-gray-800 rounded-lg p-2">
                          <div className="text-gray-500">{new Date(pay.paidAt).toLocaleString('ar-DZ')}</div>
                          <div className="font-bold text-green-600">+{pay.amount.toFixed(2)} {cur}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    {t.created_at || 'تاريخ الإنشاء'}: {new Date(debt.createdAt).toLocaleDateString('ar-DZ')}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Debt Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-black text-gray-800 dark:text-white">{t.add_debt || 'إضافة دين جديد'}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Customer select */}
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  {t.customer || 'الزبون'}
                </label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newDebt.customerId}
                  onChange={e => {
                    const cust = customers.find(c => c.id === e.target.value);
                    setNewDebt(prev => ({
                      ...prev,
                      customerId: e.target.value,
                      customerName: cust?.name || prev.customerName,
                      customerPhone: cust?.phone || prev.customerPhone
                    }));
                  }}
                >
                  <option value="">{t.select_customer || '-- اختر زبوناً مسجلاً --'}</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  {t.customer_name || 'اسم الزبون'} *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newDebt.customerName}
                  onChange={e => setNewDebt(p => ({ ...p, customerName: e.target.value }))}
                  placeholder={t.enter_name || 'أدخل الاسم'}
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  {t.phone || 'الهاتف'}
                </label>
                <input
                  type="tel"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newDebt.customerPhone}
                  onChange={e => setNewDebt(p => ({ ...p, customerPhone: e.target.value }))}
                  placeholder="06XXXXXXXX"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  {t.amount || 'المبلغ'} ({cur}) *
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newDebt.amount}
                  onChange={e => setNewDebt(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  min="0" step="0.01"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  {t.due_date || 'تاريخ الاستحقاق'}
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newDebt.dueDate}
                  onChange={e => setNewDebt(p => ({ ...p, dueDate: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  {t.notes || 'ملاحظات'}
                </label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={2}
                  value={newDebt.notes}
                  onChange={e => setNewDebt(p => ({ ...p, notes: e.target.value }))}
                  placeholder={t.optional_notes || 'ملاحظات اختيارية...'}
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-bold text-sm"
              >
                {t.cancel || 'إلغاء'}
              </button>
              <button
                onClick={handleAddDebt}
                disabled={!newDebt.customerName || !newDebt.amount}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50"
              >
                {t.add || 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Debt Modal */}
      {showEditModal && editingDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-black text-gray-800 dark:text-white text-sm flex items-center gap-2">
                <Edit2 size={16} className="text-primary"/> تعديل الدين — {editingDebt.customerName}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 p-1"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">المبلغ الإجمالي ({cur})</label>
                <input
                  type="number" min="0" step="0.01"
                  value={editForm.amount}
                  onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-gray-400 mt-1">المدفوع: {editingDebt.paidAmount.toFixed(2)} {cur}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">رقم الهاتف</label>
                <input
                  type="tel" dir="ltr"
                  value={editForm.customerPhone}
                  onChange={e => setEditForm(p => ({ ...p, customerPhone: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-400">
                إلغاء
              </button>
              <button onClick={handleEditDebt} disabled={!editForm.amount} className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">
                ✓ حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && selectedDebt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden" style={{maxHeight: 'calc(100vh - 2rem)', maxWidth: 'calc(100vw - 2rem)'}}>
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-black text-gray-800 dark:text-white">{t.add_payment || 'تسجيل دفعة'}</h2>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3">
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{selectedDebt.customerName}</div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">{t.remaining || 'المتبقي'}:</span>
                  <span className="font-black text-red-600">{selectedDebt.remainingAmount.toFixed(2)} {cur}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  {t.payment_amount || 'مبلغ الدفعة'} *
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-3 rounded-xl border-2 border-primary bg-white dark:bg-gray-700 text-lg font-black text-center focus:outline-none"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  max={selectedDebt.remainingAmount}
                  min="0.01" step="0.01"
                  autoFocus
                />
                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[selectedDebt.remainingAmount / 4, selectedDebt.remainingAmount / 2, selectedDebt.remainingAmount * 0.75, selectedDebt.remainingAmount].map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setPayAmount(v.toFixed(2))}
                      className="py-2 text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-white transition-all"
                    >
                      {i === 3 ? (t.all || 'الكل') : `${Math.round((i + 1) * 25)}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  {t.notes || 'ملاحظات'}
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button onClick={() => setShowPayModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 font-bold text-sm">
                {t.cancel || 'إلغاء'}
              </button>
              <button
                onClick={handlePayment}
                disabled={!payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold text-sm disabled:opacity-50"
              >
                ✓ {t.confirm_payment || 'تأكيد الدفعة'}
              </button>
            </div>
          </div>
        </div>
      )}
    {/* Undo toast */}
    {undoDebt && (
      <div className="fixed bottom-24 md:bottom-6 start-4 end-4 md:start-auto md:end-6 md:w-80 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
        <span className="text-sm flex-1">🗑️ {t.debt_deleted || 'تم حذف الدين'} — <strong>{undoDebt.debt.customerName}</strong></span>
        <span className="text-xs text-gray-400 font-black w-5 text-center">{undoDebt.timeLeft}</span>
        <button onClick={() => {
          if (undoDebt.timer) clearInterval(undoDebt.timer);
          setDebts(prev => [undoDebt.debt, ...prev]);
          setUndoDebt(null);
        }} className="text-primary font-black text-sm hover:underline whitespace-nowrap">
          {t.undo || 'تراجع'}
        </button>
      </div>
    )}

    {/* Delete with password modal */}
    {deletePassModal && (
      <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
          <h3 className="font-black text-gray-800 dark:text-white mb-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            {t.confirm_delete || 'تأكيد الحذف'}
          </h3>
          <p className="text-xs text-gray-500 mb-1">{t.enter_admin_password || 'أدخل كلمة مرور المدير للتأكيد'}</p>
          {wrongPassDebt && <p className="text-xs text-red-500 font-bold mb-1">❌ {t.wrong_password || 'كلمة المرور خاطئة'}</p>}
          <input type="password" autoFocus value={deletePassInput}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if ((window as any).__matjariValidateAdminPass?.(deletePassInput)) {
                  proceedDeleteDebt(deletePassModal);
                  setDeletePassModal(null); setWrongPassDebt(false);
                } else {
                  setWrongPassDebt(true); setDeletePassInput('');
                }
              }
            }}
            onChange={e => { setDeletePassInput(e.target.value); setWrongPassDebt(false); }}
            placeholder="••••••"
            className={`w-full px-3 py-2.5 rounded-xl border ${wrongPassDebt?"border-red-400":"border-gray-200 dark:border-gray-600"} bg-white dark:bg-gray-700 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-center dark:text-white`} />
          <div className="flex gap-2">
            <button onClick={() => setDeletePassModal(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-400">
              {t.cancel || 'إلغاء'}
            </button>
            <button onClick={() => {
              if ((window as any).__matjariValidateAdminPass?.(deletePassInput)) {
                proceedDeleteDebt(deletePassModal!);
                setDeletePassModal(null);
              }
            }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold">
              {t.confirm || 'تأكيد'}
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
};
