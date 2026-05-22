import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Edit2, Truck, Phone, Mail, MapPin, X, ChevronDown, ChevronUp, RotateCcw, Shield } from 'lucide-react';
import { Supplier, Product, AppSettings, User, Language } from '../types';

interface SuppliersProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  products: Product[];
  settings: AppSettings;
  currentUser: User;
  t?: any;
}

const EMOJI_MAP: Record<string, string> = {
  'غذاء': '🍖', 'food': '🍖', 'nourriture': '🍖',
  'دواء': '💊', 'حيوان': '🐾', 'طيور': '🦜', 'سمك': '🐟',
  'أدوات': '🔧', 'منظفات': '🧴', 'cleaning': '🧴',
  'إلكترونيات': '💻', 'electronics': '💻',
};

const getEmoji = (cat?: string) => {
  if (!cat) return '📦';
  const c = cat.toLowerCase();
  for (const [k, v] of Object.entries(EMOJI_MAP)) if (c.includes(k)) return v;
  return '📦';
};

export const Suppliers: React.FC<SuppliersProps> = ({ suppliers, setSuppliers, products, settings, currentUser, t = {} }) => {
  const [search, setSearch]           = useState('');
  const [expandedId, setExpandedId]   = useState<string|null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState<Supplier|null>(null);
  const [form, setForm]               = useState<Partial<Supplier>>({});
  const [undoDelete, setUndoDelete]   = useState<{supplier:Supplier,timer:any,timeLeft:number}|null>(null);
  const [passModal, setPassModal]     = useState<{show:boolean,supplier:Supplier|null,input:string,wrong:boolean}>({show:false,supplier:null,input:'',wrong:false});

  const isAdmin = currentUser.role === 'admin';
  const isRTL   = settings.interfaceLanguage === Language.AR;

  // Undo timer
  React.useEffect(() => {
    if (!undoDelete) return;
    const iv = setInterval(() => setUndoDelete(p => p ? (p.timeLeft <= 1 ? (clearInterval(p.timer), null) : {...p,timeLeft:p.timeLeft-1}) : null), 1000);
    return () => clearInterval(iv);
  }, [undoDelete]);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || s.phone?.includes(search) || s.category?.toLowerCase().includes(q));
  }, [suppliers, search]);

  const productCount = (supplierId: string) => products.filter(p => p.supplierId === supplierId).length;

  const openAdd = () => {
    setEditing(null); setForm({ name:'',phone:'',email:'',address:'',category:'',notes:'' });
    setIsModalOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s); setForm({ name:s.name, phone:s.phone||'', email:s.email||'', address:s.address||'', category:s.category||'', notes:s.notes||'' });
    setIsModalOpen(true); setExpandedId(null);
  };

  const handleSave = () => {
    if (!form.name?.trim()) return;
    if (editing) {
      setSuppliers(prev => prev.map(s => s.id === editing.id ? {...s,...form} as Supplier : s));
    } else {
      const ns: Supplier = { id:`SUP_${Date.now()}`, name:form.name!, phone:form.phone||'', email:form.email||'', address:form.address||'', category:form.category||'', notes:form.notes||'', createdAt:new Date().toISOString() };
      setSuppliers(prev => [ns, ...prev]);
    }
    setIsModalOpen(false); setEditing(null);
  };

  const doDelete = (s: Supplier) => {
    setSuppliers(prev => prev.filter(x => x.id !== s.id));
    if (undoDelete?.timer) clearInterval(undoDelete.timer);
    const timer = setInterval(() => {}, 1000);
    setUndoDelete({ supplier:s, timer, timeLeft:10 });
    setExpandedId(null);
  };

  const handleDelete = (s: Supplier) => {
    if (!isAdmin) return;
    if (settings.security?.confirmDeleteInventory) {
      setPassModal({show:true,supplier:s,input:'',wrong:false});
    } else doDelete(s);
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(()=>{});

  return (
    <div className="space-y-4 font-cairo" dir={isRTL?'rtl':'ltr'}>

      {/* Undo toast */}
      {undoDelete && (
        <div className="fixed bottom-24 md:bottom-6 start-4 end-4 md:start-auto md:end-6 md:w-80 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          <span className="text-sm flex-1 truncate">🗑️ {undoDelete.supplier.name}</span>
          <span className="text-xs text-gray-400 font-black w-5 text-center">{undoDelete.timeLeft}</span>
          <button onClick={() => { if(undoDelete.timer) clearInterval(undoDelete.timer); setSuppliers(p=>[undoDelete.supplier,...p]); setUndoDelete(null); }}
            className="text-primary font-black text-sm hover:underline whitespace-nowrap flex items-center gap-1">
            <RotateCcw size={14}/> {t.undo||'تراجع'}
          </button>
        </div>
      )}

      {/* Password modal */}
      {passModal.show && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-2"><Shield size={18} className="text-red-500"/><h3 className="font-black dark:text-white text-sm">{t.confirm_delete||'تأكيد الحذف'}</h3></div>
            <p className="text-xs text-gray-500 mb-1">{t.delete||'حذف'}: <strong>{passModal.supplier?.name}</strong></p>
            {passModal.wrong && <p className="text-xs text-red-500 font-bold mb-1">❌ {t.wrong_password||'كلمة المرور خاطئة'}</p>}
            <input type="password" autoFocus value={passModal.input}
              onChange={e => setPassModal(p=>({...p,input:e.target.value,wrong:false}))}
              onKeyDown={e => { if(e.key==='Enter') { if((window as any).__matjariValidateAdminPass?.(passModal.input)){doDelete(passModal.supplier!);setPassModal({show:false,supplier:null,input:'',wrong:false});}else setPassModal(p=>({...p,wrong:true,input:''})); } }}
              placeholder="••••••"
              className={`w-full px-3 py-2.5 rounded-xl border ${passModal.wrong?'border-red-400':'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 text-sm text-center mb-3 focus:outline-none dark:text-white`} />
            <div className="flex gap-2">
              <button onClick={()=>setPassModal({show:false,supplier:null,input:'',wrong:false})} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-400">{t.cancel||'إلغاء'}</button>
              <button onClick={()=>{ if((window as any).__matjariValidateAdminPass?.(passModal.input)){doDelete(passModal.supplier!);setPassModal({show:false,supplier:null,input:'',wrong:false});}else setPassModal(p=>({...p,wrong:true,input:''})); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold">{t.confirm||'تأكيد'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2"><Truck size={20} className="text-primary"/>{t.suppliers||'الموردون'}</h1>
          <p className="text-xs text-gray-500">{filtered.length} {t.supplier||'مورد'}</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-primary/90 transition-all">
            <Plus size={16}/> {t.add_supplier||'إضافة'}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute top-3 start-3 text-gray-400"/>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={t.search||'بحث...'}
          className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"/>
      </div>

      {/* Supplier list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Truck size={48} className="mx-auto mb-3 opacity-30"/>
            <p className="font-bold">{t.no_suppliers||'لا يوجد موردون'}</p>
          </div>
        ) : filtered.map(s => {
          const isExpanded = expandedId === s.id;
          const pCount = productCount(s.id);
          return (
            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <button onClick={()=>setExpandedId(isExpanded?null:s.id)}
                className="w-full flex items-center justify-between px-4 py-3 gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                    {getEmoji(s.category)}
                  </div>
                  <div className="flex-1 min-w-0 text-start">
                    <div className="font-bold text-sm text-gray-800 dark:text-white truncate">{s.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      {s.category && <span>{s.category}</span>}
                      {pCount > 0 && <span className="text-primary font-bold">{pCount} {t.products||'منتج'}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.phone && <span className="hidden sm:inline text-[10px] text-gray-400" dir="ltr">{s.phone}</span>}
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="mt-3 space-y-1.5 text-xs">
                    {s.phone && <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400"><Phone size={12}/><span dir="ltr">{s.phone}</span><button onClick={()=>copy(s.phone)} className="text-primary ms-auto">نسخ</button></div>}
                    {s.email && <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400"><Mail size={12}/><span className="truncate">{s.email}</span></div>}
                    {s.address && <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400"><MapPin size={12}/><span>{s.address}</span></div>}
                    {s.notes && <div className="text-gray-500 italic">📝 {s.notes}</div>}
                    {pCount > 0 && (
                      <div className="mt-2 bg-primary/5 rounded-xl p-2 text-center">
                        <span className="font-bold text-primary">{pCount}</span> {t.products_in_inventory||'منتج في المخزون'}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={()=>openEdit(s)} className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all">
                        <Edit2 size={13}/> {t.edit||'تعديل'}
                      </button>
                      <button onClick={()=>handleDelete(s)} className="flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden" style={{maxHeight:'calc(100vh - 80px)'}}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <h3 className="font-black text-gray-800 dark:text-white text-base">{editing?(t.edit_supplier||'تعديل مورد'):(t.add_supplier||'إضافة مورد')}</h3>
              <button onClick={()=>{setIsModalOpen(false);setEditing(null);}} className="text-gray-400 p-1"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {[
                {key:'name',label:(t.supplier_name||'الاسم')+' *',type:'text',ph:t.supplier_name_placeholder||'اسم المورد'},
                {key:'phone',label:t.phone||'الهاتف',type:'tel',ph:'06XXXXXXXX'},
                {key:'email',label:t.email||'البريد',type:'email',ph:'example@domain.com'},
                {key:'address',label:t.address||'العنوان',type:'text',ph:t.address_placeholder||'العنوان'},
                {key:'category',label:t.category||'الفئة',type:'text',ph:t.eg_food||'غذاء، إلكترونيات...'},
                {key:'notes',label:t.notes||'ملاحظات',type:'text',ph:t.notes_placeholder||'ملاحظات...'},
              ].map(f=>(
                <div key={f.key}>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"/>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-2 flex-shrink-0">
              <button onClick={()=>{setIsModalOpen(false);setEditing(null);}} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-400">{t.cancel||'إلغاء'}</button>
              <button onClick={handleSave} disabled={!form.name?.trim()} className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">{editing?(t.update||'تحديث'):(t.add_supplier||'إضافة')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
