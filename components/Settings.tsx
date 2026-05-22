import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, LogOut, ShoppingBag, Lock, UserPlus, Trash2, ShieldAlert, Download, Github, Sun, Moon, Users, RefreshCcw, X, UserCog, Edit2, RotateCcw, Settings2, Key, Globe, Shield, CreditCard, Languages, Printer } from 'lucide-react';
import { AppSettings, User as AuthUser, ReceiptSize, Language } from '../types';
import { openExternalLink } from '../capacitor-bridge';

interface SettingsProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  users: AuthUser[];
  setUsers: React.Dispatch<React.SetStateAction<AuthUser[]>>;
  currentUser: AuthUser;
  onUpdateCurrentUser: (user: AuthUser) => void;
  onLogout: () => void;
  onResetSystem: () => void;
  products: any[];
  sales: any[];
  customers: any[];
  suppliers: any[];
  debts?: any[];
  t: any;
}

export const Settings: React.FC<SettingsProps> = ({
  settings, setSettings, users, setUsers, currentUser, onUpdateCurrentUser, onLogout, onResetSystem, products, sales, customers, suppliers, debts = [], t = {}
}) => {
  const [resetStep, setResetStep] = useState<'none' | 'auth' | 'warning'>('none');
  const [inputPass, setInputPass] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState<string|null>(null);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'seller' as const });
  const [securityPending, setSecurityPending] = useState<keyof AppSettings['security'] | 'staff-management' | 'reset-system' | 'allowEmployeeCartPriceEdit' | null>(null);
  const [undoDelete, setUndoDelete] = useState<{ user: AuthUser, timer: any, timeLeft: number } | null>(null);

  const [staffPasswordModal, setStaffPasswordModal] = useState<{
    show: boolean;
    action: 'add' | 'edit' | 'delete' | null;
    user?: AuthUser | null;
    passwordInput: string;
  }>({
    show: false,
    action: null,
    user: null,
    passwordInput: ''
  });

  const [oldPasswordModal, setOldPasswordModal] = useState<{
    show: boolean;
    newUser: { username: string; password: string; role: 'seller' | 'admin' };
    editingUser: AuthUser;
    passwordInput: string;
  } | null>(null);

  const [passwordChanged, setPasswordChanged] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser.role === 'admin';

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // إضافة تأثير للكشف عن اللغة تلقائياً
  useEffect(() => {
    if (settings.autoDetectLanguage) {
      const browserLanguage = navigator.language || navigator.languages?.[0] || 'ar';
      let detectedLanguage = Language.AR;

      if (browserLanguage.startsWith('en')) {
        detectedLanguage = Language.EN;
      } else if (browserLanguage.startsWith('fr')) {
        detectedLanguage = Language.FR;
      }
      // بالنسبة للغة العربية أو أي لغة أخرى، نستخدم العربية كافتراضي

      if (detectedLanguage !== settings.interfaceLanguage) {
        // تحديث اللغة فقط إذا كانت مختلفة عن اللغة الحالية
        setSettings(prev => ({
          ...prev,
          interfaceLanguage: detectedLanguage
        }));
      }
    }
  }, [settings.autoDetectLanguage, setSettings]);

  useEffect(() => {
    let interval: any;
    if (undoDelete) {
      interval = setInterval(() => {
        setUndoDelete(prev => {
          if (!prev) return null;
          if (prev.timeLeft <= 1) {
            clearInterval(interval);
            return null;
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [undoDelete]);

  const handleToggleSecurity = (key: keyof AppSettings['security'] | 'staff-management' | 'reset-system') => {
    if (!isAdmin) return;

    if (key === 'staff-management' || key === 'reset-system') {
      setSecurityPending(key);
      return;
    }

    setSecurityPending(key);
  };

  const confirmSecurityAction = () => {
    if (inputPass === currentUser.password) {
      if (securityPending === 'staff-management') {
        setIsAddUserOpen(true);
      } else if (securityPending === 'reset-system') {
        setResetStep('warning');
      } else if (securityPending === 'allowEmployeeCartPriceEdit') {
        setSettings(s => ({ ...s, allowEmployeeCartPriceEdit: !(s as any).allowEmployeeCartPriceEdit }));
      } else if (securityPending && securityPending in settings.security) {
        setSettings({
          ...settings,
          security: {
            ...settings.security,
            [securityPending]: !settings.security[securityPending as keyof AppSettings['security']]
          }
        });
      }
      setSecurityPending(null);
      setInputPass('');
    } else {
      alert(t.wrong_password || 'كلمة المرور خاطئة! الدخول محجوز للمدير.');
    }
  };

  const saveUserChanges = (userData: typeof newUser, targetUser: AuthUser | null) => {
    const existingUser = targetUser ? users.find(u => u.id === targetUser.id) : null;

    let passwordToSave = userData.password;

    if (targetUser?.id === currentUser.id) {
      if (!passwordToSave) {
        passwordToSave = existingUser?.password || '';
      } else {
        setPasswordChanged(true);
      }
    } else if (targetUser && !passwordToSave) {
      passwordToSave = existingUser?.password || '';
    }

    if (!targetUser && !passwordToSave) {
      alert(t.password_required_new_user || 'كلمة المرور مطلوبة للمستخدم الجديد');
      return;
    }

    if (targetUser?.id === currentUser.id && userData.role !== 'admin') {
      alert(t.cannot_remove_admin || 'لا يمكنك سحب صلاحية المدير عن حسابك النشط لتفادي إقفال النظام.');
      return;
    }

    let updatedUser: AuthUser;

    if (targetUser) {
      updatedUser = {
        ...targetUser,
        username: userData.username,
        password: passwordToSave,
        role: userData.role
      };

      const updatedUsers = users.map(u => u.id === targetUser.id ? updatedUser : u);
      setUsers(updatedUsers);
      localStorage.setItem('users', JSON.stringify(updatedUsers));

      if (targetUser.id === currentUser.id) {
        onUpdateCurrentUser(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));

        if (passwordToSave !== currentUser.password) {
          alert(t.password_changed_success || 'تم تغيير كلمة المرور بنجاح! يرجى تسجيل الدخول مرة أخرى.');
          setTimeout(() => {
            onLogout();
          }, 1500);
        }
      }
    } else {
      updatedUser = {
        id: Math.random().toString(36).substr(2, 6),
        username: userData.username,
        password: passwordToSave,
        role: userData.role
      };
      const updatedUsers = [...users, updatedUser];
      setUsers(updatedUsers);
      localStorage.setItem('users', JSON.stringify(updatedUsers));
    }

    setIsAddUserOpen(false);
    setEditingUser(null);
    setNewUser({ username: '', password: '', role: 'seller' });
    setPasswordChanged(false);

    alert(targetUser ? t.staff_updated_success || 'تم تحديث بيانات الموظف بنجاح' : t.staff_added_success || 'تم إضافة الموظف بنجاح');
  };

  const handleSaveUser = () => {
    if (formRef.current) {
      const inputs = formRef.current.querySelectorAll('input');
      inputs.forEach(input => input.blur());
    }

    if (!newUser.username) {
      alert(t.username_required || 'اسم المستخدم مطلوب');
      return;
    }

    if (editingUser?.id === currentUser.id && newUser.password) {
      setOldPasswordModal({
        show: true,
        newUser: { ...newUser },
        editingUser,
        passwordInput: ''
      });
      return;
    }

    saveUserChanges(newUser, editingUser);
  };

  const handleDeleteUser = (u: AuthUser) => {
    if (!isAdmin || u.id === currentUser.id) return;

    if (settings.security.confirmDeleteUsers) {
      setStaffPasswordModal({
        show: true,
        action: 'delete',
        user: u,
        passwordInput: ''
      });
      return;
    }

    const updatedUsers = users.filter(x => x.id !== u.id);
    setUsers(updatedUsers);
    localStorage.setItem('users', JSON.stringify(updatedUsers));

    if (undoDelete) {
      clearTimeout(undoDelete.timer);
    }

    const timer = setTimeout(() => {
      setUndoDelete(null);
    }, 10000);

    setUndoDelete({ user: u, timer, timeLeft: 10 });
  };

  const confirmStaffPasswordAction = () => {
    if (staffPasswordModal.passwordInput === currentUser.password) {
      switch (staffPasswordModal.action) {
        case 'add':
          setIsAddUserOpen(true);
          break;
        case 'edit':
          if (staffPasswordModal.user) {
            setEditingUser(staffPasswordModal.user);
            setNewUser({
              username: staffPasswordModal.user.username,
              password: '',
              role: staffPasswordModal.user.role
            });
            setIsAddUserOpen(true);
          }
          break;
        case 'delete':
          if (staffPasswordModal.user) {
            const u = staffPasswordModal.user;
            const updatedUsers = users.filter(x => x.id !== u.id);
            setUsers(updatedUsers);
            localStorage.setItem('users', JSON.stringify(updatedUsers));

            if (undoDelete) {
              clearTimeout(undoDelete.timer);
            }

            const timer = setTimeout(() => {
              setUndoDelete(null);
            }, 10000);

            setUndoDelete({ user: u, timer, timeLeft: 10 });
          }
          break;
      }

      setStaffPasswordModal({
        show: false,
        action: null,
        user: null,
        passwordInput: ''
      });
    } else {
      alert(t.wrong_password || 'كلمة المرور خاطئة! العملية ملغاة.');
      setStaffPasswordModal(prev => ({ ...prev, passwordInput: '' }));
    }
  };

  const performUndo = () => {
    if (undoDelete) {
      clearTimeout(undoDelete.timer);
      const updatedUsers = [...users, undoDelete.user];
      setUsers(updatedUsers);
      localStorage.setItem('users', JSON.stringify(updatedUsers));
      setUndoDelete(null);
    }
  };

  const handleExportData = async () => {
    const data = { products, customers, suppliers, sales, settings, users, debts };
    const jsonStr = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `iidzii-pos-backup-${dateStr}.json`;

    const isAndroid = !!(window as any).Capacitor?.isNativePlatform?.() &&
      (window as any).Capacitor?.getPlatform?.() === 'android';

    if (isAndroid) {
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        await Filesystem.writeFile({
          path: filename, data: jsonStr,
          directory: Directory.Cache, encoding: Encoding.UTF8,
        });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({
          title: filename,
          url: uri,
          dialogTitle: 'حفظ النسخة الاحتياطية — اختر Drive أو مدير الملفات',
        });
      } catch (e: any) {
        console.error('Backup share error:', e);
      }
      return;
    }

    // Web / Electron
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const getStaffPasswordActionTitle = () => {
    switch (staffPasswordModal.action) {
      case 'add': return t.add_new_staff || 'إضافة موظف جديد';
      case 'edit': return t.edit_staff_data || 'تعديل بيانات موظف';
      case 'delete': return t.delete_staff || 'حذف موظف';
      default: return t.confirm_password || 'تأكيد كلمة المرور';
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 font-cairo pb-20 animate-in fade-in select-none" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] gap-3 border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
      <div className="flex items-center gap-4">
      <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center gap-3">
      <LogOut size={20} /> {t.logout || 'خروج'}
      </button>
      <button
      onClick={() => setSettings(s => ({...s, theme: s.theme === 'dark' ? 'light' : 'dark'}))}
      className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl text-gray-400 hover:text-primary transition-colors hover:scale-105 active:scale-95"
      title={settings.theme === 'dark' ? t.light || 'فاتح' : t.dark || 'داكن'}
      >
      {settings.theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
      </button>
      </div>
      <div className="text-left">
      <h1 className="text-xl sm:text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter leading-none flex items-center gap-2">
      <Settings2 size={32} className="text-primary" />
      {t.settings || 'الإعدادات'}
      </h1>
      <p className="text-[10px] text-gray-400 font-bold mt-2">نظام IIDZII POS v2.9.5</p>
      </div>
      </div>

      <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1e293b] p-16 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm min-h-[400px]">
      <div className="text-center space-y-8">
      <div className="flex justify-center">
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-[2rem]">
      <Lock size={80} className="text-red-500" />
      </div>
      </div>

      <div>
      <h2 className="text-3xl font-black text-gray-800 dark:text-white mb-4">{t.limited_permissions || 'صلاحيات محدودة'}</h2>
      <p className="text-gray-600 dark:text-gray-300 text-lg max-w-lg mx-auto">
      {t.welcome_seller || 'مرحباً'} <span className="font-bold text-primary">{currentUser.username}</span>،<br/>
      {t.settings_admin_only || 'قسم الإعدادات متاح فقط للمديرين ذوي الصلاحيات الكاملة.'}
      </p>
      <p className="text-gray-500 dark:text-gray-400 text-sm mt-4">
      {t.seller_settings_note || 'يمكنك استخدام الأزرار أعلاه للخروج أو تغيير وضع العرض (فاتح/داكن)'}
      </p>
      </div>

      <div className="flex items-center justify-center gap-6 mt-8">
      <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-2xl">
      <p className="text-[10px] font-black text-primary uppercase tracking-widest">{t.current_permission || 'الصلاحية الحالية'}</p>
      <p className="text-lg font-black dark:text-white mt-1">{t.seller || 'بائع'}</p>
      </div>
      <div className="bg-green-500/5 dark:bg-green-500/10 p-5 rounded-2xl">
      <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">{t.active_user || 'المستخدم النشط'}</p>
      <p className="text-lg font-black dark:text-white mt-1">{currentUser.username}</p>
      </div>
      </div>
      </div>
      </div>

      <div className="flex flex-col items-center gap-6 bg-white/5 dark:bg-black/20 p-10 rounded-[2.5rem] border border-white/10 dark:border-white/5 backdrop-blur-sm mt-10">
      <div className="flex items-center gap-6 text-gray-400">
      <div className="flex items-center gap-2">
      <ShieldAlert size={14} className="text-primary" />
      <span className="text-[10px] font-black uppercase tracking-widest">GNU GPL v3.0</span>
      </div>
      </div>

      <div className="w-full h-px bg-white/5 dark:bg-gray-700"></div>

      <div className="flex flex-col items-center gap-2 group">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.2em]">{t.open_source_project || 'مشروع IIDZII POS مفتوح المصدر'}</p>
      <button
      onClick={() => openExternalLink("https://github.com/imadIIDZII/iidzii-pos")}
      className="flex items-center gap-3 text-white transition-all group-hover:text-primary"
      >
      <Github size={20} />
      <span className="text-lg font-black tracking-tight">imad IIDZII / IIDZII POS</span>
      </button>
      <div className="flex items-center gap-1 text-[9px] text-primary font-bold opacity-60 group-hover:opacity-100 transition-opacity">
      <Globe size={10} />
      <span>github.com/imadIIDZII/iidzii-pos</span>
      </div>
      <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold mt-2 text-center">
      {t.built_with_passion || 'مبني بشغف لتجار العالم العربي'}
      </p>
      </div>
      </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-cairo pb-20 animate-in fade-in select-none" dir="rtl" key="settings-main">
    {undoDelete && (
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-5 rounded-3xl shadow-2xl z-[5000] flex items-center gap-6 animate-in slide-in-from-bottom-10 border border-white/20">
      <p className="font-black">{t.staff_deleted || 'تم حذف الموظف'}: {undoDelete.user.username}</p>
      <button onClick={performUndo} className="bg-white text-red-600 px-5 py-2 rounded-xl font-black flex items-center gap-2 text-xs">
      <RotateCcw size={18} /> {t.undo || 'تراجع'} ({undoDelete.timeLeft}{t.second_abbr || 'ث'})
      </button>
      </div>
    )}

    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] gap-3 border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
    <div className="flex items-center gap-4">
    <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center gap-3">
    <LogOut size={20} /> {t.logout || 'خروج'}
    </button>
    <button
    onClick={() => setSettings(s => ({...s, theme: s.theme === 'dark' ? 'light' : 'dark'}))}
    className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl text-gray-400 hover:text-primary transition-colors hover:scale-105 active:scale-95"
    title={settings.theme === 'dark' ? t.light || 'فاتح' : t.dark || 'داكن'}
    >
    {settings.theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
    </button>
    </div>
    <div className="text-left">
    <h1 className="text-xl sm:text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter leading-none flex items-center gap-2">
    <Settings2 size={32} className="text-primary" />
    {t.settings || 'الإعدادات'}
    </h1>
    <p className="text-[10px] text-gray-400 font-bold mt-2">نظام IIDZII POS v2.9.5</p>
    </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <section className="bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
    <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-3 justify-end opacity-80 mb-8">{t.store_identity || 'الهوية التجارية'} <ShoppingBag size={20} className="text-primary" /></h2>
    <div className="space-y-6">
    <div className="bg-gray-50 dark:bg-[#111827] p-6 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.store_name || 'اسم المتجر'}</label>
    <input value={settings.storeName} onChange={e => setSettings({...settings, storeName: e.target.value})} className="w-full bg-transparent p-2 text-center dark:text-white font-black text-2xl outline-none focus:text-primary transition-all" />
    </div>
    {/* ── شعار المتجر ── */}
    <div className="bg-gray-50 dark:bg-[#111827] p-4 rounded-3xl border border-gray-100 dark:border-white/5">
      <label className="text-[10px] font-black text-gray-400 uppercase block mb-3">شعار المتجر في الفواتير</label>
      <div className="flex items-center gap-4">
        {/* معاينة الشعار */}
        <div className="w-20 h-20 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
          {(settings as any).storeLogo ? (
            <img src={(settings as any).storeLogo} className="w-full h-full object-contain p-1" alt="logo" />
          ) : (
            <span className="text-3xl">🏪</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <button type="button"
            onClick={() => { const inp = document.getElementById('logo-upload') as HTMLInputElement; inp?.click(); }}
            className="w-full bg-primary text-white py-2.5 rounded-xl font-black text-sm active:scale-95 transition-all">
            📷 {(settings as any).storeLogo ? 'تغيير الشعار' : 'رفع شعار المتجر'}
          </button>
          {(settings as any).storeLogo && (
            <button type="button"
              onClick={() => setSettings(prev => ({ ...prev, storeLogo: undefined }))}
              className="w-full bg-red-50 dark:bg-red-900/20 text-red-500 py-2 rounded-xl font-bold text-xs active:scale-95">
              🗑 حذف الشعار
            </button>
          )}
          <p className="text-[9px] text-gray-400">PNG أو JPG — يظهر في الفواتير والسندات</p>
        </div>
      </div>
      <input id="logo-upload" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            // ضغط الشعار
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX = 200;
              const r = Math.min(MAX/img.width, MAX/img.height, 1);
              canvas.width = Math.round(img.width * r);
              canvas.height = Math.round(img.height * r);
              canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
              setSettings(prev => ({ ...prev, storeLogo: canvas.toDataURL('image/png', 0.85) }));
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />
    </div>
    <div className="bg-gray-50 dark:bg-[#111827] p-6 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.store_subtitle || 'وصف الفاتورة'}</label>
    <input value={settings.storeSubtitle} onChange={e => setSettings({...settings, storeSubtitle: e.target.value})} className="w-full bg-transparent p-2 text-center dark:text-white font-bold outline-none focus:text-primary transition-all" />
    </div>
    {/* ── رقم هاتف المتجر ── */}
    <div className="bg-gray-50 dark:bg-[#111827] p-6 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.store_phone || 'رقم هاتف المتجر'}</label>
    <input
    value={settings.storePhone || ''}
    onChange={e => setSettings({...settings, storePhone: e.target.value})}
    className="w-full bg-transparent p-2 text-center dark:text-white font-bold outline-none focus:text-primary transition-all"
    placeholder="أدخل رقم هاتف المتجر (يظهر في الإيصال)"
    dir="ltr"
    />
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">{t.store_phone_note || 'سيظهر هذا الرقم في الإيصالات المطبوعة'}</p>
    </div>
    <div className="bg-gray-50 dark:bg-[#111827] p-6 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.currency || 'العملة المعتمدة'}</label>
    <input
    value={settings.currency}
    onChange={e => setSettings({...settings, currency: e.target.value})}
    className="w-full bg-transparent p-2 text-center dark:text-white font-black text-2xl outline-none focus:text-primary transition-all"
    placeholder="DZD أو دينار"
    />
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">{t.currency_note || 'ستظهر هذه العملة في الفواتير والإحصائيات'}</p>
    </div>
    {/* ── ملاحظة الإيصال ── */}
    <div className="bg-gray-50 dark:bg-[#111827] p-6 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.receipt_footer || 'ملاحظة الإيصال'}</label>
    <textarea
    value={settings.receiptFooter || ''}
    onChange={e => setSettings({...settings, receiptFooter: e.target.value})}
    className="w-full bg-transparent p-2 text-center dark:text-white font-bold outline-none focus:text-primary transition-all resize-none"
    placeholder="ملاحظة تظهر أسفل كل إيصال"
    rows={2}
    />
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">{t.receipt_footer_note || 'ملاحظة مخصصة تظهر أسفل كل إيصال مطبوع'}</p>
    </div>
    </div>
    </section>

    <section className="bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
    <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-3 justify-end opacity-80 mb-8">{t.language_settings || 'إعدادات اللغة'} <Languages size={20} className="text-blue-500" /></h2>
    <div className="space-y-6">
    <div className="bg-gray-50 dark:bg-[#111827] p-6 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.interface_language || 'لغة الواجهة الرئيسية'}</label>
    <select
    value={settings.interfaceLanguage}
    onChange={e => setSettings({...settings, interfaceLanguage: e.target.value as Language})}
    className="w-full bg-transparent p-2 text-center dark:text-white font-bold outline-none focus:text-primary transition-all"
    >
    <option value={Language.AR}>العربية 🇩🇿</option>
    <option value={Language.EN}>English 🇺🇸</option>
    <option value={Language.FR}>Français 🇫🇷</option>
    </select>
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">{t.interface_language_note || 'لغة القوائم والنوافذ في البرنامج'}</p>
    </div>

    <div className="bg-gray-50 dark:bg-[#111827] p-6 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.receipt_language || 'لغة الفواتير المطبوعة'}</label>
    <select
    value={settings.receiptLanguage}
    onChange={e => setSettings({...settings, receiptLanguage: e.target.value as Language})}
    className="w-full bg-transparent p-2 text-center dark:text-white font-bold outline-none focus:text-primary transition-all"
    >
    <option value={Language.AR}>العربية 🇩🇿</option>
    <option value={Language.EN}>English 🇺🇸</option>
    <option value={Language.FR}>Français 🇫🇷</option>
    </select>
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
    {t.receipt_language_note || 'هذه اللغة ستظهر على الفواتير المطبوعة والمحفوظة'}
    </p>
    </div>

    <div className="flex items-center justify-between bg-gray-50 dark:bg-[#111827] p-5 rounded-3xl border border-gray-100 dark:border-white/5">
    <div className="flex items-center gap-3">
    <Globe size={20} className="text-blue-500" />
    <span className="dark:text-white font-black text-sm">{t.auto_detect_language || 'اكتشاف اللغة تلقائياً'}</span>
    </div>
    <button
    onClick={() => {
      // عند تفعيل اكتشاف اللغة تلقائياً، قم بتطبيق اللغة المكتشفة مباشرة
      const newAutoDetectValue = !settings.autoDetectLanguage;
      if (newAutoDetectValue) {
        const browserLanguage = navigator.language || navigator.languages?.[0] || 'ar';
        let detectedLanguage = Language.AR;

        if (browserLanguage.startsWith('en')) {
          detectedLanguage = Language.EN;
        } else if (browserLanguage.startsWith('fr')) {
          detectedLanguage = Language.FR;
        }

        setSettings({
          ...settings,
          autoDetectLanguage: newAutoDetectValue,
          interfaceLanguage: detectedLanguage
        });
      } else {
        setSettings({
          ...settings,
          autoDetectLanguage: newAutoDetectValue
        });
      }
    }}
    className={`w-14 h-7 rounded-full transition-all relative ${settings.autoDetectLanguage ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
    >
    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${settings.autoDetectLanguage ? 'left-1' : 'left-8'}`}></div>
    </button>
    </div>

    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-500/30">
    <p className="text-xs text-blue-600 dark:text-blue-300 font-bold text-center">
    ⚠️ {t.language_change_warning || 'تغيير لغة الواجهة يتطلب إعادة تحميل البرنامج لتفعيل التغييرات'}
    </p>
    <button
    onClick={() => window.location.reload()}
    className="mt-2 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-xl text-xs font-black w-full transition-all"
    >
    {t.reload_now || 'إعادة تحميل الآن'}
    </button>
    </div>
    </div>
    </section>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <section className="bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
    <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-3 justify-end opacity-80 mb-8">{t.system_options || 'خيارات النظام'} <Settings2 size={20} className="text-primary" /></h2>
    <div className="space-y-4">
    <div className="bg-gray-50 dark:bg-[#111827] p-5 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.paper_size || 'مقاس الورق'}</label>
    <select value={settings.receiptSize} onChange={e => setSettings({...settings, receiptSize: e.target.value as ReceiptSize})} className="w-full bg-transparent p-2 text-center dark:text-white font-black outline-none appearance-none cursor-pointer">
    <option value="thermal">{t.thermal || 'حراري 80mm'} (80mm)</option>
    <option value="thermal58">{t.thermal58 || 'حراري 58mm'} (58mm)</option>
    <option value="A4">A4</option>
    <option value="A5">A5</option>
    </select>
    </div>
    {/* تعديل سعر السلة — للمدير */}
    <div className="bg-gray-50 dark:bg-[#111827] p-4 rounded-2xl flex items-start justify-between gap-3 border border-gray-100 dark:border-white/5">
      <div className="flex-1 min-w-0">
        <div className="font-black text-sm text-gray-800 dark:text-white flex items-center gap-2">
          ✏️ {t.allow_cart_price_edit || 'تعديل سعر المنتج في السلة'}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{t.allow_cart_price_edit_desc || 'يتيح للمدير تعديل سعر أي منتج مباشرةً داخل سلة المبيعة'}</div>
      </div>
      <button
        onClick={() => setSettings(s => ({ ...s, allowCartPriceEdit: !(s as any).allowCartPriceEdit }))}
        className={`w-14 h-7 rounded-full transition-all relative flex-shrink-0 ${(settings as any).allowCartPriceEdit ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${(settings as any).allowCartPriceEdit ? 'left-1' : 'left-8'}`}></div>
      </button>
    </div>

    {/* منح الموظف صلاحية تعديل سعر السلة */}
    {(settings as any).allowCartPriceEdit && (
    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-2xl flex items-start justify-between gap-3 border border-yellow-200 dark:border-yellow-500/20">
      <div className="flex-1 min-w-0">
        <div className="font-black text-sm text-gray-800 dark:text-white flex items-center gap-2">
          🔓 {t.allow_employee_cart_price_edit || 'منح الموظف صلاحية التعديل'}
        </div>
        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">{t.allow_employee_cart_price_edit_desc || 'يتيح لموظف المبيعات تعديل الأسعار في السلة — يتطلب كلمة مرور المدير'}</div>
      </div>
      <button
        onClick={() => setSecurityPending('allowEmployeeCartPriceEdit')}
        className={`w-14 h-7 rounded-full transition-all relative flex-shrink-0 ${(settings as any).allowEmployeeCartPriceEdit ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${(settings as any).allowEmployeeCartPriceEdit ? 'left-1' : 'left-8'}`}></div>
      </button>
    </div>
    )}
    </div>
    </section>

    {/* ===== إعدادات طباعة الباركود ===== */}
    <section className="bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
    <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-3 justify-end opacity-80 mb-8">{t.barcode_print_settings || 'إعدادات طباعة الباركود'} <Printer size={20} className="text-purple-500" /></h2>
    <div className="space-y-4">
    <div className="bg-gray-50 dark:bg-[#111827] p-5 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.barcode_width_mm || 'العرض (مم)'}</label>
    <input
    type="number"
    min="10"
    max="200"
    value={settings.barcodePrintConfig?.width ?? 40}
    onChange={e => setSettings(s => ({
      ...s,
      barcodePrintConfig: { ...s.barcodePrintConfig, width: Number(e.target.value) || 40 }
    }))}
    className="bg-transparent p-2 text-center dark:text-white font-black text-3xl outline-none w-24"
    />
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">مم — الافتراضي: 40</p>
    </div>

    <div className="bg-gray-50 dark:bg-[#111827] p-5 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.barcode_height_mm || 'الارتفاع (مم)'}</label>
    <input
    type="number"
    min="5"
    max="200"
    value={settings.barcodePrintConfig?.height ?? 25}
    onChange={e => setSettings(s => ({
      ...s,
      barcodePrintConfig: { ...s.barcodePrintConfig, height: Number(e.target.value) || 25 }
    }))}
    className="bg-transparent p-2 text-center dark:text-white font-black text-3xl outline-none w-24"
    />
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">مم — الافتراضي: 25</p>
    </div>

    <div className="bg-gray-50 dark:bg-[#111827] p-5 rounded-3xl flex items-center justify-between border border-gray-100 dark:border-white/5">
    <div className="flex items-center gap-3">
    <span className="text-lg">💰</span>
    <span className="dark:text-white font-black text-sm">{t.barcode_show_price || 'إظهار السعر'}</span>
    </div>
    <button
    onClick={() => setSettings(s => ({
      ...s,
      barcodePrintConfig: { ...s.barcodePrintConfig, showPrice: !s.barcodePrintConfig.showPrice }
    }))}
    className={`w-14 h-7 rounded-full transition-all relative ${settings.barcodePrintConfig?.showPrice !== false ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}>
    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${settings.barcodePrintConfig?.showPrice !== false ? 'left-1' : 'left-8'}`}></div>
    </button>
    </div>

    <div className="bg-gray-50 dark:bg-[#111827] p-5 rounded-3xl flex items-center justify-between border border-gray-100 dark:border-white/5">
    <div className="flex items-center gap-3">
    <span className="text-lg">🏷️</span>
    <span className="dark:text-white font-black text-sm">{t.barcode_show_name || 'إظهار الاسم'}</span>
    </div>
    <button
    onClick={() => setSettings(s => ({
      ...s,
      barcodePrintConfig: { ...s.barcodePrintConfig, showName: !s.barcodePrintConfig.showName }
    }))}
    className={`w-14 h-7 rounded-full transition-all relative ${settings.barcodePrintConfig?.showName !== false ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}>
    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${settings.barcodePrintConfig?.showName !== false ? 'left-1' : 'left-8'}`}></div>
    </button>
    </div>

    <div className="bg-gray-50 dark:bg-[#111827] p-5 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.barcode_font_size_pt || 'حجم الخط (نقطة)'}</label>
    <input
    type="number"
    min="6"
    max="36"
    value={settings.barcodePrintConfig?.fontSize ?? 10}
    onChange={e => setSettings(s => ({
      ...s,
      barcodePrintConfig: { ...s.barcodePrintConfig, fontSize: Number(e.target.value) || 10 }
    }))}
    className="bg-transparent p-2 text-center dark:text-white font-black text-3xl outline-none w-24"
    />
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">pt — الافتراضي: 10</p>
    </div>

    <div className="bg-gray-50 dark:bg-[#111827] p-5 rounded-3xl border border-gray-100 dark:border-white/5 relative">
    <label className="text-[10px] font-black text-gray-400 block mb-1 mr-2 uppercase absolute -top-2 right-4 bg-white dark:bg-[#1e293b] px-2">{t.barcode_copies || 'عدد النسخ'}</label>
    <input
    type="number"
    min="1"
    max="20"
    value={settings.barcodePrintConfig?.copies ?? 1}
    onChange={e => setSettings(s => ({
      ...s,
      barcodePrintConfig: { ...s.barcodePrintConfig, copies: Math.max(1, Number(e.target.value)) || 1 }
    }))}
    className="bg-transparent p-2 text-center dark:text-white font-black text-3xl outline-none w-24"
    />
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">— الافتراضي: 1</p>
    </div>
    </div>
    </section>
    </div>

    {/* ===== إعدادات الزكاة ===== */}
    <section className="bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
    <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-3 justify-end mb-6">
    {t.zakat_settings || 'إعدادات الزكاة'} <span className="text-yellow-500 text-2xl">⭐</span>
    </h2>
    <div className="space-y-4">
    <div className="flex items-center justify-between bg-gray-50 dark:bg-[#111827] p-4 rounded-2xl">
    <div>
    <div className="font-bold text-sm text-gray-800 dark:text-white">{t.zakat_reminder || 'تذكير الزكاة'}</div>
    <div className="text-xs text-gray-500">{t.zakat_reminder_desc || 'إشعار عند اقتراب موعد الزكاة'}</div>
    </div>
    <button onClick={() => setSettings(s => ({...s, zakatReminderEnabled: !s.zakatReminderEnabled}))}
    className={'w-14 h-7 rounded-full transition-colors ' + (settings.zakatReminderEnabled ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600')}>
    <div className={'w-5 h-5 bg-white rounded-full shadow m-1 transition-transform ' + (settings.zakatReminderEnabled ? 'translate-x-7' : '')} />
    </button>
    </div>
    <div className="bg-gray-50 dark:bg-[#111827] p-4 rounded-2xl">
    <label className="text-xs font-black text-gray-500 block mb-2">{t.select_madhab || 'المذهب الفقهي'}</label>
    <select value={settings.zakatMadhab || 'maliki'}
    onChange={e => setSettings(s => ({...s, zakatMadhab: e.target.value as any}))}
    className="w-full bg-transparent dark:text-white font-bold outline-none">
    <option value="hanafi">الحنفية</option>
    <option value="maliki">المالكية</option>
    <option value="shafii">الشافعية</option>
    <option value="hanbali">الحنابلة</option>
    </select>
    </div>
    <div className="bg-gray-50 dark:bg-[#111827] p-4 rounded-2xl">
    <label className="text-xs font-black text-gray-500 block mb-2">{t.hawl_date || 'تاريخ اكتمال الحول'}</label>
    <input type="date" value={settings.zakatHawlDate ? new Date(settings.zakatHawlDate).toISOString().split('T')[0] : ''}
    onChange={e => setSettings(s => ({...s, zakatHawlDate: e.target.value ? new Date(e.target.value).getTime() : undefined}))}
    className="w-full bg-transparent dark:text-white font-bold outline-none" />
    </div>
    </div>
    </section>

    <section className="bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <button
    onClick={() => {
      if (settings.security.confirmDeleteUsers) {
        setStaffPasswordModal({
          show: true,
          action: 'add',
          user: null,
          passwordInput: ''
        });
        return;
      }
      setIsAddUserOpen(true);
    }}
    className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-3 transition-all w-full md:w-auto justify-center shadow-md hover:shadow-lg active:scale-95"
    >
    <UserPlus size={18} /> {t.add_seller || 'إضافة بائع'}
    </button>
    <h2 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-3 justify-center md:justify-end">
    {t.staff_management || 'إدارة الطاقم'} <Users size={24} className="text-primary" />
    </h2>
    </div>

    {/* Staff accordion list */}
    <div className="space-y-2">
    {users.map(u => {
      const isExpanded = expandedStaffId === u.id;
      const isCurrent = u.id === currentUser.id;
      return (
        <div key={u.id} className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
          <button onClick={() => setExpandedStaffId(isExpanded ? null : u.id)}
            className="w-full flex items-center justify-between px-4 py-3 gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${u.role==='admin'?'bg-primary text-white':'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {u.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-start flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-800 dark:text-white truncate flex items-center gap-2">
                  {u.username}
                  {isCurrent && <span className="text-[9px] bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded-full font-bold">{t.active_user||'نشط'}</span>}
                </div>
                <div className="text-xs text-gray-500">
                  <span className={`font-bold ${u.role==='admin'?'text-primary':'text-gray-400'}`}>{u.role==='admin'?(t.admin||'مدير'):(t.seller||'بائع')}</span>
                </div>
              </div>
            </div>
            {isExpanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0"/> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0"/>}
          </button>
          {isExpanded && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#0d1424]">
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between"><span>{t.role||'الدور'}:</span><span className={`font-bold ${u.role==='admin'?'text-primary':''}`}>{u.role==='admin'?(t.admin||'مدير'):(t.seller||'بائع')}</span></div>
                <div className="flex justify-between"><span>{t.status||'الحالة'}:</span><span className={`font-bold ${isCurrent?'text-green-500':'text-gray-400'}`}>{isCurrent?(t.active_user||'نشط'):(t.inactive||'غير نشط')}</span></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => {
                  if(settings.security.confirmDeleteUsers){setStaffPasswordModal({show:true,action:'edit',user:u,passwordInput:''});return;}
                  setEditingUser(u);setNewUser({username:u.username,password:'',role:u.role});setIsAddUserOpen(true);setExpandedStaffId(null);
                }} className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all">
                  <Edit2 size={13}/> {t.edit||'تعديل'}
                </button>
                {u.id !== currentUser.id && (
                  <button onClick={() => handleDeleteUser(u)} className="flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all">
                    <Trash2 size={13}/>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    })}
    </div>

    {/* إضافة فاصل وتذييل للمعلومات */}
    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
    <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-gray-500 dark:text-gray-400">
    <div className="flex items-center gap-3">
    <div className="w-4 h-4 rounded-full bg-primary"></div>
    <span className="font-bold">{t.admin || 'مدير'}: {users.filter(u => u.role === 'admin').length}</span>
    </div>
    <div className="flex items-center gap-3">
    <div className="w-4 h-4 rounded-full bg-gray-400"></div>
    <span className="font-bold">{t.seller || 'بائع'}: {users.filter(u => u.role === 'seller').length}</span>
    </div>
    <div className="flex items-center gap-3">
    <div className="w-4 h-4 rounded-full bg-green-500"></div>
    <span className="font-bold">{t.active_user || 'نشط'}: 1</span>
    </div>
    <div className="flex items-center gap-3">
    <div className="w-4 h-4 rounded-full bg-gray-300"></div>
    <span className="font-bold">{t.available || 'المجموع'}: {users.length}</span>
    </div>
    </div>
    </div>
    </section>

    <section className="bg-white dark:bg-[#1e293b] p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
    <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-3 justify-end opacity-80 mb-8">{t.delete_locks || 'أقفال الحذف (تأكيد المدير)'} <Lock size={20} className="text-red-500" /></h2>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {[
      { label: t.staff_management || 'إدارة الطاقم', key: 'confirmDeleteUsers' as keyof AppSettings['security'], icon: <Key size={20} /> },
      { label: t.delete_suppliers || 'حذف الموردين', key: 'confirmDeleteSuppliers' as keyof AppSettings['security'], icon: <Lock size={20} /> },
      { label: t.delete_customers || 'حذف الزبائن', key: 'confirmDeleteCustomers' as keyof AppSettings['security'], icon: <Lock size={20} /> },
      { label: t.delete_products || 'حذف المنتجات', key: 'confirmDeleteInventory' as keyof AppSettings['security'], icon: <Lock size={20} /> },
    ].map(item => (
      <button
      key={item.key}
      onClick={() => handleToggleSecurity(item.key)}
      className={`p-8 rounded-[2.5rem] border-2 flex flex-col items-center gap-5 transition-all ${settings.security[item.key] ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-gray-50 dark:bg-[#111827]/50 border-gray-100 dark:border-transparent text-gray-400'}`}
      >
      <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
      <div className={`p-5 rounded-3xl ${settings.security[item.key] ? 'bg-red-500 text-white shadow-xl' : 'bg-gray-200 dark:bg-gray-800'}`}>
      {item.icon}
      </div>
      <span className="text-[9px] font-bold">
      {settings.security[item.key] ? t.enabled || 'مفعل' : t.disabled || 'معطل'}
      </span>
      </button>
    ))}
    </div>
    <p className="text-gray-500 dark:text-gray-400 text-xs text-center mt-6">
    ⚠️ {t.delete_locks_note || 'عند تفعيل أي قفل، سيطلب النظام كلمة المرور عند كل عملية حذف أو تعديل'}
    </p>
    </section>

    <section className="bg-red-600/5 p-6 sm:p-16 rounded-2xl sm:rounded-[4rem] border-4 border-dashed border-red-600/20 text-center space-y-10 shadow-sm">
    <ShieldAlert className="mx-auto text-red-600 opacity-80" size={72} />
    <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter">{t.maintenance_zone || 'منطقة الصيانة والعمليات الخطرة'}</h2>
    <div className="flex flex-col md:flex-row justify-center gap-10">
    <button onClick={handleExportData} className="bg-primary hover:bg-[#0284c7] text-white px-16 py-6 rounded-[2.5rem] font-black text-xl flex items-center gap-4 shadow-2xl active:scale-95 transition-all"><Download size={28} /> {t.export_backup || 'تصدير نسخة احتياطية'}</button>
    <button onClick={() => handleToggleSecurity('reset-system')} className="bg-red-600 hover:bg-red-700 text-white px-16 py-6 rounded-[2.5rem] font-black text-xl flex items-center gap-4 shadow-2xl active:scale-95 transition-all"><RefreshCcw size={28} /> {t.full_system_reset || 'تصفير شامل للنظام'}</button>
    </div>
    {resetStep === 'warning' && (
      <div className="bg-white dark:bg-[#111827] p-10 rounded-[3rem] border-4 border-red-600/40 max-w-lg mx-auto animate-in zoom-in shadow-2xl">
      <h3 className="text-red-600 font-black text-2xl mb-4">{t.final_security_warning || 'تحذير أمني أخير!'}</h3>
      <p className="text-gray-600 dark:text-gray-400 font-bold mb-8">{t.reset_warning || 'سيتم مسح كافة البيانات نهائياً. يرجى التأكد من أنك قمت بتحميل نسخة احتياطية أولاً.'}</p>
      <div className="flex gap-4">
      <button onClick={onResetSystem} className="flex-[2] bg-red-600 text-white py-5 rounded-2xl font-black text-lg">{t.yes_reset_now || 'نعم، تصفير الآن'}</button>
      <button onClick={() => setResetStep('none')} className="flex-1 bg-gray-100 dark:bg-gray-800 dark:text-white py-5 rounded-2xl font-black">{t.cancel || 'إلغاء'}</button>
      </div>
      </div>
    )}
    </section>

    <div className="flex flex-col items-center gap-6 bg-white/5 dark:bg-black/20 p-10 rounded-[2.5rem] border border-white/10 dark:border-white/5 backdrop-blur-sm mt-10">
    <div className="flex items-center gap-6 text-gray-400">
    <div className="flex items-center gap-2">
    <ShieldAlert size={14} className="text-primary" />
    <span className="text-[10px] font-black uppercase tracking-widest">GNU GPL v3.0</span>
    </div>
    </div>

    <div className="w-full h-px bg-white/5 dark:bg-gray-700"></div>

    <div className="flex flex-col items-center gap-2 group">
    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.2em]">{t.open_source_project || 'مشروع IIDZII POS مفتوح المصدر'}</p>
    <button
    onClick={() => openExternalLink("https://github.com/imadIIDZII/iidzii-pos")}
    className="flex items-center gap-3 text-white transition-all group-hover:text-primary"
    >
    <Github size={20} />
    <span className="text-lg font-black tracking-tight">imad IIDZII / IIDZII POS</span>
    </button>
    <div className="flex items-center gap-1 text-[9px] text-primary font-bold opacity-60 group-hover:opacity-100 transition-opacity">
    <Globe size={10} />
    <span>github.com/imadIIDZII/iidzii-pos</span>
    </div>
    <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold mt-2 text-center">
    {t.built_with_passion || 'مبني بشغف لتجار العالم العربي'}
    </p>
    </div>
    </div>

    {securityPending && (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[6000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e293b] p-5 sm:p-12 rounded-2xl sm:rounded-[4rem] w-full max-w-md shadow-2xl border border-gray-100 dark:border-white/10 text-center">
      <ShieldAlert className="mx-auto text-orange-500 mb-8" size={60} />
      <h3 className="text-gray-800 dark:text-white font-black text-2xl mb-2 tracking-tighter uppercase">{t.manager_identity_verification || 'التحقق من هوية المدير'}</h3>
      <input
      type="password"
      value={inputPass}
      onChange={e => setInputPass(e.target.value)}
      className="w-full p-6 bg-gray-50 dark:bg-black/30 rounded-3xl text-center dark:text-white text-2xl sm:text-4xl font-black mb-4 sm:mb-8 outline-none border-2 border-transparent focus:border-primary transition-all shadow-inner"
      placeholder={t.password || 'كلمة المرور'}
      autoFocus
      />
      <div className="flex gap-4">
      <button onClick={confirmSecurityAction} className="flex-[2] bg-primary text-white py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all">{t.confirm || 'تأكيد'}</button>
      <button onClick={() => { setSecurityPending(null); setInputPass(''); }} className="flex-1 bg-gray-100 dark:bg-gray-800 dark:text-white py-5 rounded-2xl font-black transition-all">{t.cancel || 'إلغاء'}</button>
      </div>
      </div>
      </div>
    )}

    {staffPasswordModal.show && (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[6000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e293b] p-5 sm:p-12 rounded-2xl sm:rounded-[4rem] w-full max-w-md shadow-2xl border border-gray-100 dark:border-white/10 text-center">
      <Shield className="mx-auto text-orange-500 mb-8" size={60} />
      <h3 className="text-gray-800 dark:text-white font-black text-2xl mb-2 tracking-tighter uppercase">{getStaffPasswordActionTitle()}</h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">{t.manager_password_required || 'يجب إدخال كلمة مرور المدير للمتابعة'}</p>
      <input
      type="password"
      value={staffPasswordModal.passwordInput}
      onChange={e => setStaffPasswordModal(prev => ({ ...prev, passwordInput: e.target.value }))}
      className="w-full p-6 bg-gray-50 dark:bg-black/30 rounded-3xl text-center dark:text-white text-2xl sm:text-4xl font-black mb-4 sm:mb-8 outline-none border-2 border-transparent focus:border-primary transition-all shadow-inner"
      placeholder={t.password || 'كلمة المرور'}
      autoFocus
      />
      <div className="flex gap-4">
      <button onClick={confirmStaffPasswordAction} className="flex-[2] bg-primary text-white py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all">{t.confirm || 'تأكيد'}</button>
      <button onClick={() => {
        setStaffPasswordModal({
          show: false,
          action: null,
          user: null,
          passwordInput: ''
        });
      }} className="flex-1 bg-gray-100 dark:bg-gray-800 dark:text-white py-5 rounded-2xl font-black transition-all">{t.cancel || 'إلغاء'}</button>
      </div>
      </div>
      </div>
    )}

    {oldPasswordModal && (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[6000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e293b] p-5 sm:p-12 rounded-2xl sm:rounded-[4rem] w-full max-w-md shadow-2xl border border-gray-100 dark:border-white/10 text-center">
      <ShieldAlert className="mx-auto text-orange-500 mb-8" size={60} />
      <h3 className="text-gray-800 dark:text-white font-black text-2xl mb-2 tracking-tighter uppercase">
      {t.verify_old_password || 'التحقق من كلمة المرور القديمة'}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
      {t.old_password_security_note || 'لأمان حسابك، يرجى إدخال كلمة المرور القديمة قبل التغيير'}
      </p>
      <input
      type="password"
      value={oldPasswordModal.passwordInput}
      onChange={e => setOldPasswordModal(prev => prev ? {
        ...prev,
        passwordInput: e.target.value
      } : null)}
      className="w-full p-6 bg-gray-50 dark:bg-black/30 rounded-3xl text-center dark:text-white text-2xl font-black mb-8 outline-none border-2 border-transparent focus:border-primary transition-all shadow-inner"
      placeholder={t.old_password || 'كلمة المرور القديمة'}
      autoFocus
      />
      <div className="flex gap-4">
      <button
      onClick={() => {
        if (oldPasswordModal.passwordInput === currentUser.password) {
          saveUserChanges(oldPasswordModal.newUser, oldPasswordModal.editingUser);
          setOldPasswordModal(null);
        } else {
          alert(t.wrong_old_password || 'كلمة المرور القديمة غير صحيحة!');
          setOldPasswordModal(prev => prev ? { ...prev, passwordInput: '' } : null);
        }
      }}
      className="flex-[2] bg-primary text-white py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all"
      >
      {t.confirm_change || 'تأكيد التغيير'}
      </button>
      <button
      onClick={() => {
        setOldPasswordModal(null);
        setNewUser({ username: '', password: '', role: 'seller' });
        setEditingUser(null);
      }}
      className="flex-1 bg-gray-100 dark:bg-gray-800 dark:text-white py-5 rounded-2xl font-black transition-all"
      >
      {t.cancel || 'إلغاء'}
      </button>
      </div>
      </div>
      </div>
    )}

    {isAddUserOpen && isAdmin && (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[4000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e293b] p-5 sm:p-12 rounded-2xl sm:rounded-[4rem] w-full max-w-xl shadow-2xl border border-gray-100 dark:border-white/10" ref={formRef}>
      <div className="flex justify-between items-center mb-12 text-gray-800 dark:text-white">
      <h3 className="font-black text-3xl flex items-center gap-5 uppercase tracking-tighter"><UserCog size={40} className="text-primary"/> {editingUser ? t.edit_staff_data || 'تعديل بيانات الطاقم' : t.new_staff || 'موظف جديد'}</h3>
      <X onClick={() => {
        setIsAddUserOpen(false);
        setEditingUser(null);
        setNewUser({ username: '', password: '', role: 'seller' });
      }} className="cursor-pointer opacity-30 hover:opacity-100 transition-opacity" size={32} />
      </div>
      <div className="space-y-8">
      <div className="bg-gray-50 dark:bg-[#111827] rounded-[2.5rem] p-8 border border-gray-100 dark:border-white/5 relative group">
      <label className="text-[11px] font-black text-gray-400 block mb-3 uppercase tracking-widest">{t.username || 'اسم المستخدم'}</label>
      <input
      value={newUser.username}
      onChange={e => setNewUser({...newUser, username: e.target.value})}
      className="w-full bg-transparent dark:text-white outline-none font-black text-2xl"
      autoFocus
      />
      </div>
      <div className="bg-gray-50 dark:bg-[#111827] rounded-[2.5rem] p-8 border border-gray-100 dark:border-white/5 relative group">
      <label className="text-[11px] font-black text-gray-400 block mb-3 uppercase tracking-widest">
      {t.password || 'كلمة المرور'} {editingUser ? (editingUser.id === currentUser.id ? t.required_for_change || '(مطلوبة للتغيير)' : t.leave_empty_keep_old || '(اتركها فارغة للحفاظ على القديمة)') : t.required || '(مطلوبة)'}
      </label>
      <input
      type="password"
      value={newUser.password}
      onChange={e => setNewUser({...newUser, password: e.target.value})}
      className="w-full bg-transparent dark:text-white outline-none font-black text-2xl"
      placeholder={editingUser && editingUser.id !== currentUser.id ? t.leave_empty_keep_old || 'اتركها فارغة للحفاظ على القديمة' : t.password || 'كلمة المرور'}
      />
      {editingUser?.id === currentUser.id && (
        <p className="text-xs text-primary font-bold mt-2">
        ⚠️ {t.admin_password_change_note || 'يجب إدخال كلمة مرور جديدة لتغيير كلمة مرور المدير الحالي'}
        </p>
      )}
      </div>
      <div className="bg-gray-50 dark:bg-[#111827] rounded-[2.5rem] p-8 border border-gray-100 dark:border-white/5 relative group">
      <label className="text-[11px] font-black text-gray-400 block mb-3 uppercase tracking-widest">{t.permission || 'الصلاحية'}</label>
      <select
      disabled={editingUser?.id === currentUser.id}
      value={newUser.role}
      onChange={e => setNewUser({...newUser, role: e.target.value as any})}
      className="w-full bg-transparent dark:text-white outline-none font-black text-xl cursor-pointer appearance-none"
      >
      <option value="seller">{t.seller_limited_permission || 'بائع (صلاحية محدودة)'}</option>
      <option value="admin">{t.admin_full_permission || 'مدير (كامل الصلاحيات)'}</option>
      </select>
      {editingUser?.id === currentUser.id && newUser.role !== 'admin' && (
        <p className="text-xs text-red-500 font-bold mt-2">
        ⚠️ {t.cannot_remove_admin_self || 'لا يمكنك سحب صلاحية المدير عن حسابك النشط'}
        </p>
      )}
      </div>
      <button
      onClick={handleSaveUser}
      className="w-full bg-primary text-white py-7 rounded-[2.5rem] font-black text-2xl shadow-2xl active:scale-95 transition-all mt-10 hover:bg-primary/90"
      >
      {editingUser ? t.update_data || 'تحديث البيانات' : t.add_staff || 'إضافة موظف'}
      </button>
      </div>
      </div>
      </div>
    )}
    </div>
  );
};
