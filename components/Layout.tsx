import React, { useState } from 'react';
import {
  ShoppingBag, Package, LayoutDashboard, Users, Settings as SettingsIcon,
  Truck, Search, Github, Heart, CreditCard, Star, Menu, X, LogOut
} from 'lucide-react';
import { AppSettings, User, Language } from '../types';
import { openExternalLink } from '../capacitor-bridge';
import { Logo } from './Logo.tsx';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: AppSettings;
  currentUser: User;
  t: any;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, settings, currentUser, t }) => {
  const isAdmin = currentUser.role === 'admin';
  const isRTL = settings.interfaceLanguage === Language.AR;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const allItems = [
    { id: 'pos',       icon: <ShoppingBag size={20} />,    label: t.pos || 'نقطة البيع',    visible: true },
    { id: 'search',    icon: <Search size={20} />,         label: t.search || 'البحث الشامل', visible: true },
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: t.dashboard || 'لوحة التحكم', visible: true },
    { id: 'inventory', icon: <Package size={20} />,        label: t.inventory || 'المخزون',  visible: isAdmin },
    { id: 'suppliers', icon: <Truck size={20} />,          label: t.suppliers || 'الموردون', visible: isAdmin },
    { id: 'debts',     icon: <CreditCard size={20} />,     label: t.debts || 'الديون',       visible: true },
    { id: 'zakat',     icon: <Star size={20} />,           label: t.zakat || 'الزكاة',       visible: true },
    { id: 'customers', icon: <Users size={20} />,          label: t.customers || 'الزبائن',  visible: true },
    { id: 'settings',  icon: <SettingsIcon size={20} />,   label: t.settings || 'الإعدادات', visible: true },
  ].filter(i => i.visible);

  // Mobile bottom nav: 5 primary items
  const primaryItems = ['pos', 'dashboard', 'debts', 'search', 'settings'];
  const bottomNavItems = allItems.filter(i => primaryItems.includes(i.id));

  const SidebarItem = ({ item }: { item: typeof allItems[0] }) => (
    <button
      onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
        activeTab === item.id
          ? 'bg-primary text-white font-bold shadow-sm'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
      }`}
      
    >
      <span className={activeTab === item.id ? 'text-white' : 'text-primary opacity-80'}>{item.icon}</span>
      <span className="hidden lg:block text-sm font-medium truncate">{item.label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-[#0a0f1a] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden md:flex flex-col w-16 lg:w-56 bg-white dark:bg-[#111827] border-e border-gray-200 dark:border-white/5 shadow-sm flex-shrink-0 no-print">
        {/* Logo */}
        <div className="flex flex-col items-center lg:items-start p-3 lg:p-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-black text-gray-800 dark:text-white truncate">{currentUser.name || currentUser.username}</p>
              <p className="text-[10px] text-primary font-bold uppercase tracking-wide">
                {currentUser.role === 'admin' ? (t.admin || 'مدير') : (t.seller || 'بائع')}
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {allItems.map(item => <SidebarItem key={item.id} item={item} />)}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-gray-100 dark:border-white/5 hidden lg:block">
          <a href="#" onClick={(e) => { e.preventDefault(); openExternalLink("https://github.com/SalehGNUTUX"); }}
            className="flex items-center justify-center gap-1.5 text-gray-400 hover:text-primary transition-colors py-1">
            <Heart size={10} className="text-red-400 fill-red-400" />
            <span className="text-[9px] font-bold">SalehGNUTUX</span>
            <Github size={10} />
          </a>
          <p className="text-[9px] text-gray-400 text-center font-bold">v2.9.5-beta</p>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#111827] border-b border-gray-200 dark:border-white/5 sticky top-0 z-40 no-print">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="text-xs font-black text-gray-700 dark:text-gray-200">
              {allItems.find(i => i.id === activeTab)?.label || ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-bold">{currentUser.name || currentUser.username}</span>
            <button onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 md:p-4 pb-24 md:pb-6 no-print" dir={isRTL ? 'rtl' : 'ltr'}>
          {children}
        </main>
      </div>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-[#111827] border-t border-gray-200 dark:border-white/5 z-50 no-print safe-area-bottom">
        <div className="flex justify-around items-stretch py-0.5 px-1">
          {bottomNavItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl flex-1 transition-all ${
                activeTab === item.id ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
              }`}>
              {React.cloneElement(item.icon, { size: 20 })}
              <span className="text-[9px] font-bold leading-none mt-0.5">{item.label}</span>
            </button>
          ))}
          {/* More button */}
          <button onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl flex-1 transition-all ${
              allItems.filter(i => !primaryItems.includes(i.id)).some(i => i.id === activeTab)
                ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
            }`}>
            <Menu size={22} />
            <span className="text-[9px] font-bold leading-none mt-0.5">{t.more || 'المزيد'}</span>
          </button>
        </div>
      </nav>

      {/* ===== MOBILE FULL MENU DRAWER ===== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] no-print" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className={`absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-[#111827] shadow-2xl flex flex-col`}>
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <Logo size={32} />
                <div>
                  <p className="text-sm font-black text-gray-800 dark:text-white">{currentUser.name || currentUser.username}</p>
                  <p className="text-xs text-primary font-bold">{currentUser.role === 'admin' ? (t.admin || 'مدير') : (t.seller || 'بائع')}</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
                <X size={20} />
              </button>
            </div>

            {/* All nav items */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {allItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
                    activeTab === item.id ? 'bg-primary text-white font-bold shadow' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                  }`} >
                  <span className={activeTab === item.id ? 'text-white' : 'text-primary'}>{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-gray-100 dark:border-white/5 text-center">
              <a href="#" onClick={(e) => { e.preventDefault(); openExternalLink("https://github.com/SalehGNUTUX"); }}
                className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
                <Heart size={10} className="text-red-400 fill-red-400" />
                <span>SalehGNUTUX</span>
                <Github size={10} />
              </a>
              <p className="text-[9px] text-gray-400 font-bold mt-1">IIDZII POS v2.9.5-beta</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
