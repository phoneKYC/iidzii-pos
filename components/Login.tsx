import React, { useState, useEffect } from 'react';
import { User as UserIcon, Lock, Shield, Github, Globe, Languages } from 'lucide-react';
import { User, Language } from '../types';
import { Logo } from './Logo.tsx';
import { translations } from '../i18n';

interface LoginProps {
  users: User[];
  onLogin: (user: User, selectedLanguage: Language) => void;
  initialLanguage?: Language;
}

export const Login: React.FC<LoginProps> = ({ users, onLogin, initialLanguage = Language.AR }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(initialLanguage);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const t = translations[selectedLanguage];

  // تحديث اتجاه الصفحة بناءً على اللغة المختارة
  useEffect(() => {
    document.documentElement.dir = selectedLanguage === Language.AR ? 'rtl' : 'ltr';
    document.documentElement.lang = selectedLanguage;
  }, [selectedLanguage]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user, selectedLanguage);
    } else {
      setError(t.invalid_credentials || 'خطأ في اسم المستخدم أو كلمة المرور');
    }
  };

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
    setShowLanguageDropdown(false);
  };

  const languageOptions = [
    { code: Language.AR, name: 'العربية', flag: '🇸🇦' },
    { code: Language.EN, name: 'English', flag: '🇺🇸' },
    { code: Language.FR, name: 'Français', flag: '🇫🇷' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 font-cairo">
    <div className="max-w-md w-full flex flex-col gap-6">
    {/* شريط اختيار اللغة */}
    <div className="flex justify-end">
    <div className="relative">
    <button
    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
    className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-800 text-white px-4 py-3 rounded-2xl border border-gray-700 transition-all"
    >
    <Languages size={18} />
    <span className="font-bold">
    {languageOptions.find(lang => lang.code === selectedLanguage)?.flag}
    </span>
    <span className="text-sm">
    {languageOptions.find(lang => lang.code === selectedLanguage)?.name}
    </span>
    </button>

    {showLanguageDropdown && (
      <div className="absolute top-full mt-2 right-0 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl z-50 min-w-[180px]">
      {languageOptions.map((language) => (
        <button
        key={language.code}
        onClick={() => handleLanguageChange(language.code)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-gray-700/50 transition-all ${
          selectedLanguage === language.code ? 'bg-primary/20 text-primary' : 'text-white'
        } ${language.code === Language.AR ? 'rounded-tr-2xl rounded-tl-2xl' : ''}
        ${language.code === Language.FR ? 'rounded-br-2xl rounded-bl-2xl' : ''}`}
        >
        <span className="text-xl">{language.flag}</span>
        <span className="font-bold flex-1">{language.name}</span>
        {selectedLanguage === language.code && (
          <div className="w-2 h-2 bg-primary rounded-full"></div>
        )}
        </button>
      ))}
      </div>
    )}
    </div>
    </div>

    <div className="bg-gray-800 rounded-[3rem] shadow-2xl p-10 border border-gray-700 relative overflow-hidden text-center">
    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>

    <div className="flex flex-col items-center mb-10 relative z-10">
    <Logo size={80} variant="white" className="mb-4" />
    <h1 className="text-2xl font-black text-white mb-2">
    {t.welcome || 'مرحباً بكم'}
    </h1>
    <p className="text-gray-400 mt-2 font-bold opacity-60">
    {t.open_source_project || 'نظام إدارة المبيعات المفتوح'}
    </p>
    </div>

    <form onSubmit={handleLogin} className="space-y-6 relative z-10">
    <div className="space-y-2" dir={selectedLanguage === Language.AR ? 'rtl' : 'ltr'}>
    <label className="text-gray-400 text-xs font-black uppercase tracking-widest block">
    {t.username || 'اسم المستخدم'}
    </label>
    <div className="relative">
    <UserIcon className={`absolute ${selectedLanguage === Language.AR ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-500`} size={20} />
    <input
    type="text"
    value={username}
    onChange={e => setUsername(e.target.value)}
    className={`w-full bg-gray-900/50 border-2 border-transparent focus:border-primary rounded-2xl py-4 ${
      selectedLanguage === Language.AR ? 'pr-12' : 'pl-12'
    } text-white outline-none transition-all font-bold`}
    placeholder={t.username_placeholder || 'admin / seller'}
    required
    />
    </div>
    </div>

    <div className="space-y-2" dir={selectedLanguage === Language.AR ? 'rtl' : 'ltr'}>
    <label className="text-gray-400 text-xs font-black uppercase tracking-widest block">
    {t.password || 'كلمة المرور'}
    </label>
    <div className="relative">
    <Lock className={`absolute ${selectedLanguage === Language.AR ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-500`} size={20} />
    <input
    type="password"
    value={password}
    onChange={e => setPassword(e.target.value)}
    className={`w-full bg-gray-900/50 border-2 border-transparent focus:border-primary rounded-2xl py-4 ${
      selectedLanguage === Language.AR ? 'pr-12' : 'pl-12'
    } text-white outline-none transition-all font-bold`}
    placeholder="••••••••"
    required
    />
    </div>
    </div>

    {error && (
      <p className="text-red-400 text-sm font-bold text-center animate-bounce" dir={selectedLanguage === Language.AR ? 'rtl' : 'ltr'}>
      {error}
      </p>
    )}

    <button
    type="submit"
    className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-primary/20 active:scale-95 text-lg"
    >
    {t.login_button || 'دخول للنظام'}
    </button>
    </form>

    {/* تلميح بيانات الدخول الافتراضية */}
    <div className="mt-6 bg-gray-900/60 border border-gray-700 rounded-2xl p-4 text-xs text-gray-400 space-y-1.5" dir={selectedLanguage === Language.AR ? 'rtl' : 'ltr'}>
      <p className="font-black text-gray-300 mb-2">{t.default_credentials_hint || '🔑 بيانات الدخول الافتراضية'}</p>
      <div className="flex justify-between items-center bg-gray-800/60 px-3 py-1.5 rounded-xl">
        <span className="text-gray-400">{t.role_admin || 'مدير'}</span>
        <span className="font-mono font-black text-primary tracking-widest">admin / admin</span>
      </div>
      <div className="flex justify-between items-center bg-gray-800/60 px-3 py-1.5 rounded-xl">
        <span className="text-gray-400">{t.role_seller || 'موظف'}</span>
        <span className="font-mono font-black text-primary tracking-widest">seller / seller</span>
      </div>
    </div>
    </div>

    {/* تذييل المطور ورابط المشروع */}
    <div className="flex flex-col items-center gap-4 bg-white/5 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-sm">
    <div className="flex items-center gap-6 text-gray-400">
    <div className="flex items-center gap-2">
    <Shield size={14} className="text-primary" />
    <span className="text-[10px] font-black uppercase tracking-widest">GNU GPL v3.0</span>
    </div>
    </div>

    <div className="w-full h-px bg-white/5"></div>

    <a
    href="https://github.com/imadIIDZII"
    target="_blank"
    rel="noopener noreferrer"
    className="flex flex-col items-center gap-2 group"
    >
    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
    {t.developed_by || 'تطوير وإشراف'}
    </p>
    <div className="flex items-center gap-3 text-white transition-all group-hover:text-primary">
    <Github size={20} />
    <span className="text-lg font-black tracking-tight">imad IIDZII</span>
    </div>
    <div className="flex items-center gap-1 text-[9px] text-primary font-bold opacity-60 group-hover:opacity-100 transition-opacity">
    <Globe size={10} />
    <span>github.com/imadIIDZII</span>
    </div>
    </a>

    <p className="text-[9px] text-gray-600 font-medium">مع شكر خاص لـ <a href="https://github.com/SalehGNUTUX" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SalahGnutox</a></p>
    </div>
    </div>

    {/* زر إغلاق dropdown عند النقر خارجها */}
    {showLanguageDropdown && (
      <div
      className="fixed inset-0 z-40"
      onClick={() => setShowLanguageDropdown(false)}
      />
    )}
    </div>
  );
};
