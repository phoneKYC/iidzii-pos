import React, { useState, useEffect } from 'react';
import { Star, Calculator, Info, Bell, BellOff, Book, ChevronDown, ChevronUp, CheckCircle, Save } from 'lucide-react';
import { AppSettings, ZakatMadhab, ZakatRecord } from '../types';

interface ZakatProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  inventoryValue: number;
  totalDebtsReceivable: number;
  zakatRecords: ZakatRecord[];
  setZakatRecords: React.Dispatch<React.SetStateAction<ZakatRecord[]>>;
  t?: any;
}

const MADHABS = {
  hanafi: {
    name: 'الحنفية',
    nameEn: 'Hanafi',
    nisabGold: 85, // grams
    nisabSilver: 595, // grams  
    description: 'النصاب: 85 جرام ذهب أو 595 جرام فضة. تشمل الزكاة: المال النقدي والبضاعة والديون المرجوة.',
    rate: 0.025,
    notes: 'يُعتبر بالنصاب الأدنى (الفضة). عروض التجارة تُزكَّى بقيمتها السوقية.'
  },
  maliki: {
    name: 'المالكية',
    nameEn: 'Maliki',
    nisabGold: 85,
    nisabSilver: 595,
    description: 'النصاب: 85 جرام ذهب أو 595 جرام فضة. يُشترط الحول الكامل.',
    rate: 0.025,
    notes: 'عروض التجارة تُزكَّى بقيمة الشراء إذا لم تبلغ قيمتها السوقية النصاب.'
  },
  shafii: {
    name: 'الشافعية',
    nameEn: "Shafi'i",
    nisabGold: 85,
    nisabSilver: 595,
    description: 'النصاب: 85 جرام ذهب أو 595 جرام فضة. عروض التجارة تُزكَّى بقيمتها السوقية.',
    rate: 0.025,
    notes: 'يُحسب نصاب بداية الحول ونهايته.'
  },
  hanbali: {
    name: 'الحنابلة',
    nameEn: 'Hanbali',
    nisabGold: 85,
    nisabSilver: 595,
    description: 'النصاب: 85 جرام ذهب أو 595 جرام فضة. زكاة عروض التجارة بالقيمة السوقية.',
    rate: 0.025,
    notes: 'يُشترط أن تكون نية التجارة عند الشراء.'
  }
};

// أسعار الذهب والفضة التقريبية (بالدينار الجزائري)
const APPROX_GOLD_PRICE_PER_GRAM = 12000; // دج/جرام تقريباً
const APPROX_SILVER_PRICE_PER_GRAM = 130;

export const Zakat: React.FC<ZakatProps> = ({
  settings, setSettings, inventoryValue, totalDebtsReceivable, zakatRecords, setZakatRecords, t = {}
}) => {
  const isRTL = settings.interfaceLanguage === 'ar';
  const cur = settings.currency || 'DZD';

  const [madhab, setMadhab] = useState<ZakatMadhab>(settings.zakatMadhab || 'maliki');
  const [goldPricePerGram, setGoldPricePerGram] = useState(APPROX_GOLD_PRICE_PER_GRAM);
  const [silverPricePerGram, setSilverPricePerGram] = useState(APPROX_SILVER_PRICE_PER_GRAM);
  const [cashAmount, setCashAmount] = useState('');
  const [customInventory, setCustomInventory] = useState(inventoryValue.toFixed(2));
  const [receivables, setReceivables] = useState(totalDebtsReceivable.toFixed(2));
  const [debtsOwed, setDebtsOwed] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hawlDate, setHawlDate] = useState(
    settings.zakatHawlDate ? new Date(settings.zakatHawlDate).toISOString().split('T')[0] : ''
  );
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const selectedMadhab = MADHABS[madhab];

  const nisabGoldValue = selectedMadhab.nisabGold * goldPricePerGram;
  const nisabSilverValue = selectedMadhab.nisabSilver * silverPricePerGram;
  // Most schools use silver nisab for trade (lower = more conservative = more zakat)
  const effectiveNisab = madhab === 'hanafi' ? nisabSilverValue : Math.min(nisabGoldValue, nisabSilverValue);

  const totalWealth =
    parseFloat(cashAmount || '0') +
    parseFloat(customInventory || '0') +
    parseFloat(receivables || '0') -
    parseFloat(debtsOwed || '0');

  const zakatableAmount = Math.max(0, totalWealth);
  const isAboveNisab = zakatableAmount >= effectiveNisab;
  const zakatAmount = isAboveNisab ? zakatableAmount * selectedMadhab.rate : 0;

  // Hawl reminder
  const isHawlDue = hawlDate && new Date(hawlDate).getTime() <= Date.now();
  const daysToHawl = hawlDate
    ? Math.ceil((new Date(hawlDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleSaveRecord = () => {
    const record: ZakatRecord = {
      id: `ZAKAT_${Date.now()}`,
      calculatedAt: Date.now(),
      madhab,
      nisabGold: selectedMadhab.nisabGold * goldPricePerGram,
      nisabSilver: selectedMadhab.nisabSilver * silverPricePerGram,
      cashAmount: parseFloat(cashAmount || '0'),
      inventoryValue: parseFloat(customInventory || '0'),
      receivables: parseFloat(receivables || '0'),
      debtsOwed: parseFloat(debtsOwed || '0'),
      zakatAmount,
      hawlDate: hawlDate ? new Date(hawlDate).getTime() : undefined,
      notes: notes || undefined
    };
    setZakatRecords(prev => [record, ...prev]);
    setSettings(prev => ({
      ...prev,
      zakatMadhab: madhab,
      zakatHawlDate: hawlDate ? new Date(hawlDate).getTime() : undefined
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleReminder = () => {
    setSettings(prev => ({ ...prev, zakatReminderEnabled: !prev.zakatReminderEnabled }));
  };

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
            <Star size={28} className="text-yellow-500 fill-yellow-500" />
            {t.zakat_calculator || 'حاسبة الزكاة'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t.zakat_subtitle || 'احسب زكاة تجارتك وفق المذاهب السنية الأربعة'}
          </p>
        </div>
        <button
          onClick={toggleReminder}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            settings.zakatReminderEnabled
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          {settings.zakatReminderEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          {settings.zakatReminderEnabled ? (t.reminder_on || 'التذكير مفعّل') : (t.reminder_off || 'تفعيل التذكير')}
        </button>
      </div>

      {/* Hawl Alert */}
      {isHawlDue && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 rounded-xl p-4 flex items-start gap-3">
          <Star size={24} className="text-yellow-500 fill-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-black text-yellow-800 dark:text-yellow-400">{t.zakat_due || '⚠️ الزكاة واجبة!'}</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
              {t.zakat_due_msg || 'لقد حال الحول، يجب أداء الزكاة في أقرب وقت. لا تؤخر ما فرض الله.'}
            </p>
          </div>
        </div>
      )}

      {daysToHawl && daysToHawl > 0 && daysToHawl <= 30 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
          <p className="text-sm text-blue-700 dark:text-blue-400 font-bold">
            ⏰ {t.hawl_in || 'الحول بعد'} {daysToHawl} {t.days || 'يوماً'} — {new Date(hawlDate!).toLocaleDateString('ar-DZ')}
          </p>
        </div>
      )}

      {/* Madhab selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-black text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Book size={18} className="text-primary" />
          {t.select_madhab || 'اختر المذهب'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(MADHABS) as ZakatMadhab[]).map(m => (
            <button
              key={m}
              onClick={() => setMadhab(m)}
              className={`p-3 rounded-xl text-center transition-all border-2 ${
                madhab === m
                  ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-yellow-300'
              }`}
            >
              <div className={`font-black text-sm ${madhab === m ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {MADHABS[m].name}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{MADHABS[m].nameEn}</div>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Info size={14} />
          {showInfo ? (t.hide_info || 'إخفاء التفاصيل') : (t.show_info || 'تفاصيل المذهب')}
          {showInfo ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showInfo && (
          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p>📌 {selectedMadhab.description}</p>
            <p>💡 {selectedMadhab.notes}</p>
            <p>📊 نسبة الزكاة: <strong>2.5%</strong></p>
          </div>
        )}
      </div>

      {/* Nisab prices */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-black text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Calculator size={18} className="text-primary" />
          {t.nisab_prices || 'أسعار النصاب'}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1.5">
              🥇 {t.gold_price || 'سعر الذهب'} ({cur}/جرام)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              value={goldPricePerGram}
              onChange={e => setGoldPricePerGram(parseFloat(e.target.value) || 0)}
              onFocus={e => e.currentTarget.select()}
            />
            <div className="text-xs text-gray-500 mt-1">
              نصاب الذهب: {(selectedMadhab.nisabGold * goldPricePerGram).toFixed(2)} {cur}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1.5">
              🥈 {t.silver_price || 'سعر الفضة'} ({cur}/جرام)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              value={silverPricePerGram}
              onChange={e => setSilverPricePerGram(parseFloat(e.target.value) || 0)}
              onFocus={e => e.currentTarget.select()}
            />
            <div className="text-xs text-gray-500 mt-1">
              نصاب الفضة: {(selectedMadhab.nisabSilver * silverPricePerGram).toFixed(2)} {cur}
            </div>
          </div>
        </div>
        <div className="mt-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-400">
          <strong>النصاب المعتمد:</strong> {effectiveNisab.toFixed(2)} {cur}
          {madhab === 'hanafi' && ' (الفضة - الأحوط)'}
        </div>
      </div>

      {/* Wealth inputs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-black text-gray-800 dark:text-white mb-4">
          💰 {t.your_wealth || 'أموالك'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              💵 {t.cash_amount || 'النقود والأرصدة'}
            </label>
            <input
              type="number"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
              value={cashAmount}
              onChange={e => setCashAmount(e.target.value)}
              onFocus={e => e.target.select()}
              placeholder="0.00" min="0" step="0.01"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              📦 {t.inventory_value || 'قيمة البضاعة (من المخزون)'}
            </label>
            <input
              type="number"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
              value={customInventory}
              onChange={e => setCustomInventory(e.target.value)}
              onFocus={e => e.target.select()}
              min="0" step="0.01"
            />
            <div className="text-xs text-primary mt-1">
              ✓ {t.auto_from_inventory || 'تم جلبه تلقائياً من المخزون'}
            </div>
          </div>
          {/* ── ديون لي: مبالغ يدين بها الزبائن → تُضاف ── */}
          <div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              🤝 ديون لي <span className="text-xs font-normal text-gray-500">(مبالغ مستحقة لك عند الغير)</span>
            </label>
            <input
              type="number"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-white"
              value={receivables}
              onChange={e => setReceivables(e.target.value)}
              onFocus={e => e.target.select()}
              placeholder="0.00" min="0" step="0.01"
            />
            <p className="text-[10px] text-green-500 font-bold mt-1">✚ تُضاف إلى الوعاء الزكوي</p>
          </div>
          {/* ── ديون علي: ما عليك من ديون → تُطرح ── */}
          <div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              📉 ديون علي <span className="text-xs font-normal text-gray-500">(ما تدين به لآخرين)</span>
            </label>
            <input
              type="number"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:text-white"
              value={debtsOwed}
              onChange={e => setDebtsOwed(e.target.value)}
              onFocus={e => e.target.select()}
              placeholder="0.00" min="0" step="0.01"
            />
            <p className="text-[10px] text-red-400 font-bold mt-1">✖ تُطرح من الوعاء الزكوي</p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              📅 {t.hawl_date || 'تاريخ اكتمال الحول'}
            </label>
            <input
              type="date"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
              value={hawlDate}
              onChange={e => setHawlDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Result */}
      <div className={`rounded-2xl p-6 shadow-lg border-2 ${
        isAboveNisab
          ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-400'
          : 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-300'
      }`}>
        <div className="text-center">
          <Star size={36} className={`mx-auto mb-3 ${isAboveNisab ? 'text-yellow-500 fill-yellow-500' : 'text-green-500'}`} />
          <div className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">
            {t.zakat_due_amount || 'مقدار الزكاة الواجبة'}
          </div>
          <div className={`text-4xl font-black mb-1 ${isAboveNisab ? 'text-yellow-700 dark:text-yellow-400' : 'text-green-700 dark:text-green-400'}`}>
            {zakatAmount.toFixed(2)}
          </div>
          <div className="text-lg text-gray-600 dark:text-gray-400 font-bold">{cur}</div>

          <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>{t.total_wealth || 'إجمالي المال الزكوي'}:</span>
              <span className="font-bold">{zakatableAmount.toFixed(2)} {cur}</span>
            </div>
            <div className="flex justify-between">
              <span>{t.nisab_amount || 'النصاب'}:</span>
              <span className="font-bold">{effectiveNisab.toFixed(2)} {cur}</span>
            </div>
            <div className={`font-bold text-center mt-2 py-2 rounded-xl ${
              isAboveNisab
                ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400'
                : 'bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-400'
            }`}>
              {isAboveNisab
                ? `✅ ${t.above_nisab || 'بلغ المال النصاب — الزكاة واجبة'}`
                : `ℹ️ ${t.below_nisab || 'لم يبلغ المال النصاب — لا زكاة'}`}
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-3">
        <div className="flex-1">
          <textarea
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
            placeholder={t.notes || 'ملاحظات...'}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <button
          onClick={handleSaveRecord}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow transition-all self-start ${
            saved ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          {saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saved ? (t.saved || 'تم الحفظ') : (t.save_record || 'حفظ السجل')}
        </button>
      </div>

      {/* History */}
      {zakatRecords.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <h2 className="font-black text-gray-800 dark:text-white">
              📜 {t.zakat_history || 'سجل الحسابات'} ({zakatRecords.length})
            </h2>
            {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {showHistory && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {zakatRecords.map(rec => (
                <div key={rec.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-gray-800 dark:text-white">
                      {MADHABS[rec.madhab].name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(rec.calculatedAt).toLocaleDateString('ar-DZ')}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="font-black text-yellow-600">{rec.zakatAmount.toFixed(2)} {cur}</div>
                    <div className="text-xs text-gray-500">{t.zakat || 'زكاة'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
