import React, { useState, useMemo, useEffect } from 'react';
import { Search, UserPlus, Trash2, Edit2, Phone, Mail, MapPin, X, ChevronLeft, ChevronRight, RotateCcw, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { Customer, AppSettings, User, Language } from '../types';

interface CustomersProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  settings: AppSettings;
  currentUser: User;
  t: any;
}

const compressImage = (dataUrl: string, maxSize = 400, quality = 0.7): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * ratio; canvas.height = img.height * ratio;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });

export const Customers: React.FC<CustomersProps> = ({ customers, setCustomers, settings, currentUser, t }) => {
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<'all'>('all');
  const [expandedId, setExpandedId]   = useState<string|null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer|null>(null);
  const [form, setForm]               = useState<Partial<Customer>>({ name:'',phone:'',email:'',address:'',notes:'' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [wrongPass, setWrongPass]     = useState(false);
  const [undoDelete, setUndoDelete]   = useState<{customer:Customer,timer:any,timeLeft:number}|null>(null);
  const [passModal, setPassModal]     = useState<{show:boolean,customer:Customer|null,input:string}>({show:false,customer:null,input:''});

  const isAdmin = currentUser.role === 'admin';
  const isRTL   = settings.interfaceLanguage === Language.AR;
  const cur     = settings.currency;
  const PER_PAGE = 20;

  // Undo timer
  useEffect(() => {
    if (!undoDelete) return;
    const iv = setInterval(() => setUndoDelete(p => p ? (p.timeLeft <= 1 ? null : {...p, timeLeft: p.timeLeft-1}) : null), 1000);
    return () => clearInterval(iv);
  }, [undoDelete]);

  const filtered = useMemo(() => {
    let list = customers;
    if (search) { const q = search.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone?.includes(search)); }

    return list;
  }, [customers, search, filter, settings.minPointsForVoucher]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);

  const formatDate = (d: string) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString(isRTL ? 'ar-DZ' : 'en-GB');
  };

  const openAdd = () => {
    setEditingCustomer(null);
    setForm({ name:'',phone:'',email:'',address:'',notes:'' });
    setIsModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({ name:c.name, phone:c.phone||'', email:c.email||'', address:c.address||'', notes:c.notes||'', totalSpent:c.totalSpent });
    setIsModalOpen(true);
    setExpandedId(null);
  };

  const handleSave = () => {
    if (!form.name?.trim() || !form.phone?.trim()) return;
    if (editingCustomer) {
      setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? {...c,...form} as Customer : c));
    } else {
      const nc: Customer = {
        id: `CUST_${Date.now()}`, name: form.name!, phone: form.phone!,
        email: form.email||'', address: form.address||'', notes: form.notes||'',
        totalSpent: 0, points: 0, pointsRemainder: 0, vouchersUsed: 0,
        createdAt: new Date().toISOString(),
        visitStats: { monthly:0, semiAnnual:0, annual:0 }
      };
      setCustomers(prev => [nc, ...prev]);
    }
    setIsModalOpen(false); setEditingCustomer(null);
  };

  const doDelete = (c: Customer) => {
    setCustomers(prev => prev.filter(x => x.id !== c.id));
    if (undoDelete?.timer) clearInterval(undoDelete.timer);
    let tl = 10;
    const timer = setInterval(() => setUndoDelete(p => p ? (p.timeLeft <= 1 ? (clearInterval(p.timer), null) : {...p,timeLeft:p.timeLeft-1}) : null), 1000);
    setUndoDelete({ customer: c, timer, timeLeft: tl });
    setExpandedId(null);
  };

  const handleDelete = (c: Customer) => {
    if (!isAdmin) return;
    if (settings.security.confirmDeleteCustomers) {
      setPassModal({show:true, customer:c, input:''}); setWrongPass(false);
    } else {
      doDelete(c);
    }
  };

  const confirmPassDelete = () => {
    if (!passModal.customer) return;
    if ((window as any).__matjariValidateAdminPass?.(passModal.input)) {
      doDelete(passModal.customer);
      setPassModal({show:false,customer:null,input:''});
    } else {
      setWrongPass(true);
      setPassModal(p => ({...p, input:''}));
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(()=>{});

  return (
    <div className="space-y-4 font-cairo" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Undo toast */}
      {undoDelete && (
        <div className="fixed bottom-24 md:bottom-6 start-4 end-4 md:start-auto md:end-6 md:w-80 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          <span className="text-sm flex-1 truncate">🗑️ {undoDelete.customer.name}</span>
          <span className="text-xs text-gray-400 font-black w-5 text-center">{undoDelete.timeLeft}</span>
          <button onClick={() => { if (undoDelete.timer) clearInterval(undoDelete.timer); setCustomers(p => [undoDelete.customer,...p]); setUndoDelete(null); }}
            className="text-primary font-black text-sm hover:underline whitespace-nowrap flex items-center gap-1">
            <RotateCcw size={14} /> {t.undo || 'تراجع'}
          </button>
        </div>
      )}

      {/* Password modal */}
      {passModal.show && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={20} className="text-red-500" />
              <h3 className="font-black text-gray-800 dark:text-white">{t.confirm_delete || 'تأكيد الحذف'}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-1">{t.delete_customer || 'حذف الزبون'}: <strong>{passModal.customer?.name}</strong></p>
            <p className="text-xs text-gray-500 mb-3">{t.enter_admin_password || 'أدخل كلمة مرور المدير'}</p>
            {wrongPass && <p className="text-xs text-red-500 font-bold mb-2">❌ {t.wrong_password || 'كلمة المرور خاطئة'}</p>}
            <input type="password" autoFocus value={passModal.input}
              onChange={e => { setPassModal(p=>({...p,input:e.target.value})); setWrongPass(false); }}
              onKeyDown={e => e.key==='Enter' && confirmPassDelete()}
              placeholder="••••••"
              className={`w-full px-3 py-2.5 rounded-xl border ${wrongPass?'border-red-400':'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 text-sm text-center mb-3 focus:outline-none focus:ring-2 focus:ring-red-400 dark:text-white`} />
            <div className="flex gap-2">
              <button onClick={() => { setPassModal({show:false,customer:null,input:''}); setWrongPass(false); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-400">{t.cancel || 'إلغاء'}</button>
              <button onClick={confirmPassDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold">{t.confirm || 'تأكيد'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-800 dark:text-white">{t.customers_management || t.customers || 'الزبائن'}</h1>
          <p className="text-xs text-gray-500">{filtered.length} {t.customer || 'زبون'}</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-primary/90 transition-all">
          <UserPlus size={16} /> {t.add_customer || 'إضافة'}
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute top-3 start-3 text-gray-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder={t.search_customers_placeholder || 'ابحث عن زبون بالاسم أو الهاتف...'}
            className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:text-white" />
        </div>

      </div>

      {/* Customer list - compact cards */}
      <div className="space-y-2">
        {paged.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <UserPlus size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">{search ? (t.no_search_results||'لا نتائج') : (t.no_customers||'لا يوجد زبائن')}</p>
          </div>
        ) : paged.map(c => {
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id} className={`bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden transition-all border-gray-100 dark:border-gray-700`}>
              {/* Compact header - always visible */}
              <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                className="w-full flex items-center justify-between px-4 py-3 gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 bg-primary/10 text-primary`}>
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 text-start">
                    <div className="font-bold text-sm text-gray-800 dark:text-white truncate">{c.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span dir="ltr">{c.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="grid grid-cols-1 gap-3 mt-3">
                    {/* Stats */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
                      <div className="text-lg font-black text-primary">{c.totalSpent.toFixed(2)}</div>
                      <div className="text-[10px] text-gray-500">{cur} {t.total_spent||'مشتريات'}</div>
                    </div>
                  </div>
                  {/* Contact info */}
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone size={12} />
                      <span dir="ltr">{c.phone}</span>
                      <button onClick={() => copy(c.phone)} className="text-primary hover:underline ms-auto text-[10px]">نسخ</button>
                    </div>
                    {c.email && <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400"><Mail size={12}/><span className="truncate">{c.email}</span></div>}
                    {c.address && <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400"><MapPin size={12}/><span className="line-clamp-1">{c.address}</span></div>}
                    {c.createdAt && <div className="text-gray-400 text-[10px]">📅 {formatDate(c.createdAt)}</div>}
                    {c.notes && <div className="text-gray-500 text-[10px] italic">📝 {c.notes}</div>}
                  </div>
                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEdit(c)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all">
                        <Edit2 size={13} /> {t.edit||'تعديل'}
                      </button>
                      <button onClick={() => handleDelete(c)}
                        className="flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button onClick={() => setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 disabled:opacity-30">
            {isRTL ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
          </button>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 disabled:opacity-30">
            {isRTL ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
          </button>
        </div>
      )}

      {/* Add/Edit Modal - compact for mobile */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3" dir={isRTL?'rtl':'ltr'}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden" style={{maxHeight:'calc(100vh - 100px)'}}>
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <h3 className="font-black text-gray-800 dark:text-white text-base">
                {editingCustomer ? (t.edit_customer||'تعديل زبون') : (t.add_customer||'إضافة زبون')}
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }} className="text-gray-400 p-1"><X size={20}/></button>
            </div>

            {/* Modal body - scrollable */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {[
                { key:'name', label:(t.customer_name||'الاسم')+'  *', type:'text', placeholder:t.customer_name_placeholder||'اسم الزبون', required:true },
                { key:'phone', label:(t.phone||'الهاتف')+' *', type:'tel', placeholder:'06XXXXXXXX', required:true },
                { key:'email', label:t.email||'البريد الإلكتروني', type:'email', placeholder:'example@domain.com', required:false },
                { key:'address', label:t.address||'العنوان', type:'text', placeholder:t.address_placeholder||'العنوان...', required:false },
                { key:'notes', label:t.notes||'ملاحظات', type:'text', placeholder:t.notes_placeholder||'ملاحظات...', required:false },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">{field.label}</label>
                  <input type={field.type} value={(form as any)[field.key]||''}
                    onChange={e => setForm(p=>({...p,[field.key]:e.target.value}))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:text-white" />
                </div>
              ))}
              {editingCustomer && (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">{t.total_spent||'إجمالي المشتريات'}</label>
                    <input type="number" value={(form as any).totalSpent||0}
                      onChange={e=>setForm(p=>({...p,totalSpent:Number(e.target.value)}))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none dark:text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-2 flex-shrink-0">
              <button onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-400">
                {t.cancel||'إلغاء'}
              </button>
              <button onClick={handleSave} disabled={!form.name?.trim()||!form.phone?.trim()}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">
                {editingCustomer ? (t.update||'تحديث') : (t.add_customer||'إضافة')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
