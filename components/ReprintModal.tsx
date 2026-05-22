import React, { useRef, useState } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Sale, AppSettings, User } from '../types';
import { printOrShare, saveImage } from '../capacitor-bridge';


interface ReprintModalProps {
  sale: Sale;
  settings: AppSettings;
  currentUser: User;
  t: any;
  onClose: () => void;
}

const truncate = (s: string, n = 18) => s.length > n ? s.slice(0, n - 1) + '…' : s;

export const ReprintModal: React.FC<ReprintModalProps> = ({
  sale, settings, currentUser, t, onClose
}) => {
  const receiptRef  = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const cur  = settings.currency || 'DZD';
  const isRTL = settings.interfaceLanguage === 'ar';

  // Serial-only — no JSON dump

  const logoHTML = (settings as any).storeLogo
    ? `<img src="${String((settings as any).storeLogo || '')}" style="width:60px;height:60px;object-fit:contain;margin-bottom:4px" />`
    : `<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M32 35V28C32 18 40 10 50 10C60 10 68 18 68 28V35" stroke="#3b82f6" stroke-width="8" stroke-linecap="round" fill="none"/><rect x="15" y="35" width="70" height="55" rx="15" fill="#3b82f6"/><path d="M40 55L50 65L60 55" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

  const generateHTML = (): string => `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<style>
@font-face{font-family:'UbuntuAr';src:url('./fonts/Ubuntu Arabic Regular.otf') format('opentype')}
*{margin:0;padding:0;box-sizing:border-box;font-family:'UbuntuAr','Cairo',sans-serif}
body{background:#fff;color:#111;width:80mm;font-size:11px}
.c{width:76mm;padding:4mm;margin:0 auto}
.center{text-align:center}.bold{font-weight:700}.bolder{font-weight:900}
.divider{border-top:1px dashed #999;margin:5px 0}
.divider2{border-top:2px solid #3b82f6;margin:6px 0}
.row{display:flex;justify-content:space-between;margin:3px 0;font-size:10px}
.total-box{background:#f0f9ff;border:2px solid #3b82f6;border-radius:6px;padding:8px;text-align:center;margin:8px 0}
.total-val{font-size:20px;font-weight:900;color:#1e40af}
table{width:100%;border-collapse:collapse;font-size:9px}
th{border-bottom:1px solid #3b82f6;padding:3px;text-align:right;font-weight:700;color:#1e40af}
td{padding:3px;border-bottom:1px dashed #ddd}
.footer{text-align:center;font-size:8px;color:#666;margin-top:8px}
@media print{@page{size:80mm auto;margin:2mm}body{width:76mm}}
</style></head><body><div class="c">
<div class="center" style="margin-bottom:8px">${logoHTML}
<div class="bolder" style="font-size:14px;color:#1e3a8a;margin-top:4px">${settings.storeName}</div>
<div style="font-size:9px;color:#555">${settings.storeSubtitle}</div></div>
<div class="divider2"></div>
<div class="row"><span class="bold">رقم الفاتورة:</span><span class="bolder">#${sale.id}</span></div>
<div class="row"><span class="bold">التاريخ:</span><span>${new Date(sale.timestamp).toLocaleString('ar-DZ')}</span></div>
<div class="row"><span class="bold">الزبون:</span><span class="bold">${sale.customerName || 'زبون عابر'}</span></div>
<div class="row"><span class="bold">البائع:</span><span>${sale.sellerName || currentUser.name || currentUser.username}</span></div>
${settings.storePhone ? `<div class="row"><span>هاتف:</span><span>${settings.storePhone}</span></div>` : ''}
<div class="divider"></div>
<table><thead><tr><th>الصنف</th><th style="text-align:center">الكمية</th><th style="text-align:center">سعر الوحدة</th><th style="text-align:left">المجموع</th></tr></thead>
<tbody>${sale.items.map(i => `<tr><td>${truncate(i.name, 20)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:center">${i.price.toFixed(2)}</td><td style="text-align:left">${(i.price * i.quantity).toFixed(2)} ${cur}</td></tr>`).join('')}</tbody></table>
<div class="divider"></div>
${sale.discount > 0 ? `<div class="row"><span>الخصم:</span><span style="color:#dc2626">-${sale.discount.toFixed(2)} ${cur}</span></div>` : ''}
<div class="total-box"><div style="font-size:10px;color:#555;margin-bottom:2px">الإجمالي النهائي</div>
<div class="total-val">${sale.total.toFixed(2)} ${cur}</div></div>
<div class="row"><span class="bold">المدفوع:</span><span>${sale.amountPaid.toFixed(2)} ${cur}</span></div>
${sale.changeDue > 0 ? `<div class="row"><span class="bold">الباقي:</span><span style="color:#059669">${sale.changeDue.toFixed(2)} ${cur}</span></div>` : ''}
<div class="row"><span class="bold">طريقة الدفع:</span><span>${sale.paymentMethod === 'cash' ? 'نقدي' : sale.paymentMethod === 'card' ? 'بطاقة' : 'دين'}</span></div>
<div style="text-align:center;margin:6px 0"><div style="font-size:8px;color:#555;margin-bottom:3px">رقم الفاتورة</div><div style="font-family:monospace;font-size:11px;font-weight:900;letter-spacing:1px">${sale.id}</div></div>
${settings.receiptFooter ? `<div style="text-align:center;font-size:8px;color:#888;margin:4px 0">${settings.receiptFooter}</div>` : ''}
<div class="footer">شكراً لزيارتكم — © ${new Date().getFullYear()} ${settings.storeName} | IIDZII POS</div>
</div></body></html>`;

  const handlePrint = async () => {
    setLoading(true); setError('');
    try {
      const r = await printOrShare(generateHTML(), sale.id, receiptRef.current || undefined);
      if (!r.success) setError(r.error || 'خطأ في الطباعة');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!receiptRef.current) return;
    setLoading(true); setError('');
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 4, useCORS: true, backgroundColor: '#ffffff', width: 320, windowWidth: 320, imageTimeout: 5000 });
      await saveImage(canvas.toDataURL('image/png', 1.0), `فاتورة_${sale.id}.png`);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[9000] flex items-center justify-center p-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h3 className="font-black text-gray-800 dark:text-white text-base">
            {t.receipt_preview || 'معاينة الفاتورة'} #{sale.id}
          </h3>
          <button onClick={onClose} className="text-gray-400 p-1 hover:text-gray-600"><X size={20} /></button>
        </div>

        {error && (
          <div className="mx-4 mt-2 p-2 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">{error}</div>
        )}

        {/* Receipt preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
          <div ref={receiptRef} className="bg-white p-4 mx-auto w-64 font-cairo text-black rounded-xl shadow text-xs" dir="rtl">
            <div className="text-center mb-2">
              <svg width="32" height="32" viewBox="0 0 100 100" className="mx-auto mb-1" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 35V28C32 18 40 10 50 10C60 10 68 18 68 28V35" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" fill="none"/>
                <rect x="15" y="35" width="70" height="55" rx="15" fill="#3b82f6"/>
                <path d="M40 55L50 65L60 55" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <div className="font-black text-sm">{settings.storeName}</div>
              <div className="text-[9px] text-gray-400">{settings.storeSubtitle}</div>
            </div>
            <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-1.5 my-1.5 space-y-0.5">
              <div className="flex justify-between"><span className="font-bold">رقم:</span><span className="font-black">#{sale.id}</span></div>
              <div className="flex justify-between"><span>التاريخ:</span><span>{new Date(sale.timestamp).toLocaleString('ar-DZ')}</span></div>
              <div className="flex justify-between"><span>الزبون:</span><span className="font-bold">{sale.customerName || 'زبون عابر'}</span></div>
              {settings.storePhone && <div className="flex justify-between"><span>هاتف:</span><span dir="ltr">{settings.storePhone}</span></div>}
            </div>
            <table className="w-full mb-1.5">
              <thead><tr className="border-b border-gray-300"><th className="text-right py-0.5 font-bold">الصنف</th><th className="text-center">الكمية</th><th className="text-center">سعر الوحدة</th><th className="text-left">المجموع</th></tr></thead>
              <tbody>
                {sale.items.map((item, i) => (
                  <tr key={i} className="border-b border-dashed border-gray-100">
                    <td className="py-0.5 font-bold">{truncate(item.name, 16)}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-center">{item.price.toFixed(2)}</td>
                    <td className="text-left">{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t-2 border-gray-900 pt-1 space-y-0.5">
              {sale.discount > 0 && <div className="flex justify-between text-red-500"><span>خصم:</span><span>-{sale.discount.toFixed(2)} {cur}</span></div>}
              <div className="flex justify-between font-black text-sm"><span>الإجمالي:</span><span>{sale.total.toFixed(2)} {cur}</span></div>
              <div className="flex justify-between"><span>المدفوع:</span><span>{sale.amountPaid.toFixed(2)} {cur}</span></div>
              {sale.changeDue > 0 && <div className="flex justify-between text-green-500"><span>الباقي:</span><span>{sale.changeDue.toFixed(2)} {cur}</span></div>}
              <div className="flex justify-between text-gray-500"><span>الدفع:</span><span>{sale.paymentMethod === 'cash' ? 'نقدي' : sale.paymentMethod === 'card' ? 'بطاقة' : 'دين'}</span></div>
            </div>
            <div className="mt-2 text-center">
              <QRCodeSVG value={sale.id} size={80} level="H" includeMargin />
              <p className="text-[9px] text-gray-400 font-mono tracking-widest mt-1">{sale.id}</p>
            </div>
            {settings.receiptFooter && <div className="text-center text-[8px] text-gray-400 mt-1">{settings.receiptFooter}</div>}
            <div className="text-center text-[9px] text-gray-400 mt-1">شكراً لزيارتكم — IIDZII POS</div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handlePrint} disabled={loading}
              className="flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Printer size={15}/>}
              {t.print_receipt || 'طباعة'}
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex items-center justify-center gap-2 bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Download size={15}/>}
              {t.save_receipt || 'حفظ PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
