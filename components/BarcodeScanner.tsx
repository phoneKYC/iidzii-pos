/**
 * BarcodeScanner v2.9.4 — Live continuous scanning
 *
 * Uses Html5Qrcode.start() which handles Android Capacitor WebView camera
 * permissions correctly — no manual photo button needed.
 * Custom overlay: dark mask + animated laser + corner brackets.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ImageIcon } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
  t?: any;
}

const isNativeAndroid = () =>
  !!(window as any).Capacitor?.isNativePlatform?.() &&
  (window as any).Capacitor?.getPlatform?.() === 'android';

// Decode still image dataUrl with jsQR
async function decodeDataUrl(dataUrl: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = async () => {
      const MAX = 1400;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w=Math.round(w*r); h=Math.round(h*r); }
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      const ctx = c.getContext('2d')!; ctx.drawImage(img,0,0,w,h);
      const d = ctx.getImageData(0,0,w,h);
      try {
        const jsQR = (await import('jsqr')).default;
        const r1 = jsQR(d.data,w,h,{inversionAttempts:'dontInvert'});
        if (r1?.data) { resolve(r1.data); return; }
        const r2 = jsQR(d.data,w,h,{inversionAttempts:'onlyInvert'});
        resolve(r2?.data||null);
      } catch { resolve(null); }
    };
    img.onerror = ()=>resolve(null);
    img.src = dataUrl;
  });
}

async function h5ScanFile(file: File): Promise<string|null> {
  const id='bsc-h5-'+Date.now();
  const div=document.createElement('div'); div.id=id;
  div.style.cssText='position:fixed;top:-9999px;width:1px;height:1px;overflow:hidden';
  document.body.appendChild(div);
  try {
    const {Html5Qrcode}=await import('html5-qrcode');
    const s=new Html5Qrcode(id);
    const r=await s.scanFileV2(file,false);
    try{s.clear();}catch{}
    document.body.removeChild(div);
    return r?.decodedText||null;
  } catch { try{document.body.removeChild(div);}catch{}; return null; }
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan, onClose,
  title='مسح منتج',
  hint='وجّه الكاميرا نحو الباركود — سيتم المسح تلقائياً',
  t={}
}) => {
  const [mode, setMode]       = useState<'camera'|'image'|'manual'>('camera');
  const [manual, setManual]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady]     = useState(false);   // camera is live
  const [flashGreen, setFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const scannerRef  = useRef<any>(null);
  const lockedRef   = useRef(false);
  const laserRef    = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const videoBoxId  = 'h5qr-live-box';

  /* ── success callback ──────────────────────────────────────── */
  const success = useCallback((code: string) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    try { navigator.vibrate?.(80); } catch {}
    setFlash(true);
    setTimeout(()=>{ onScan(code); onClose(); }, 280);
  }, [onScan, onClose]);

  /* ── stop scanner ──────────────────────────────────────────── */
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setReady(false);
    setLoading(false);
  }, []);

  /* ── start live scanner via Html5Qrcode.start() ────────────── *
   * This works in Capacitor WebView on Android because           *
   * html5-qrcode handles the WebView permission request          *
   * internally via its own MediaStream management.               */
  const startLiveScanner = useCallback(async () => {
    await stopScanner();
    setLoading(true); setError(''); lockedRef.current = false;

    // Ensure the container div exists in DOM before starting
    await new Promise(r => setTimeout(r, 80));

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(videoBoxId, { verbose: false } as any);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          // qrbox must be smaller than the video — centre crop
          qrbox: (vw: number, vh: number) => ({
            width:  Math.floor(vw * 0.76),
            height: Math.floor(vh * 0.52),
          }),
          aspectRatio: 1.4,
          disableFlip: false,
          formatsToSupport: undefined, // all formats: QR, EAN-13, Code128, etc.
        },
        (decodedText: string) => success(decodedText),
        () => {}   // per-frame error — ignore
      );

      // Hide html5-qrcode's own UI chrome (we draw our own overlay)
      const box = document.getElementById(videoBoxId);
      if (box) {
        // Remove their default header/footer controls
        const spans = box.querySelectorAll('span, button, img[alt="Info icon"], .html5-qrcode-element');
        spans.forEach(el => { (el as HTMLElement).style.display = 'none'; });
        // Make video fill the container
        const video = box.querySelector('video');
        if (video) {
          video.style.cssText = 'width:100%!important;height:100%!important;object-fit:cover;border-radius:0';
        }
      }

      setLoading(false);
      setReady(true);
    } catch (e: any) {
      setLoading(false);
      setReady(false);
      const msg = e?.message || '';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
        setError(t.camera_permission_hint || 'لم يتم منح إذن الكاميرا — افتح إعدادات التطبيق وأذن الوصول للكاميرا');
      } else {
        setError(msg || t.camera_error || 'تعذّر تشغيل الكاميرا');
      }
    }
  }, [success, stopScanner, t]);

  /* ── torch toggle ──────────────────────────────────────────── */
  const toggleTorch = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (torchOn) await (Html5Qrcode as any).applyVideoConstraints?.({ torch: false });
      else         await (Html5Qrcode as any).applyVideoConstraints?.({ torch: true  });
    } catch {}
    // Fallback via MediaStreamTrack
    const video = document.querySelector(`#${videoBoxId} video`) as HTMLVideoElement|null;
    const track = (video?.srcObject as MediaStream)?.getVideoTracks()[0];
    if (track) {
      try { await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] }); } catch {}
    }
    setTorchOn(v=>!v);
  };

  /* ── Android native camera (gallery or camera app) ─────────── */
  const androidCapture = async (src: 'camera'|'photos') => {
    setLoading(true); setError('');
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 90, resultType: CameraResultType.DataUrl,
        source: src==='camera' ? CameraSource.Camera : CameraSource.Photos,
        allowEditing: false, correctOrientation: true, width: 1280,
      });
      if (!photo.dataUrl) { setLoading(false); return; }
      const code = await decodeDataUrl(photo.dataUrl);
      if (code) { success(code); return; }
      const blob = await (await fetch(photo.dataUrl)).blob();
      const code2 = await h5ScanFile(new File([blob],'sc.jpg',{type:'image/jpeg'}));
      if (code2) { success(code2); return; }
      setError(t.scan_failed || 'لم يُعثر على رمز — جرّب إضاءة أفضل أو أدخله يدوياً');
    } catch (e:any) {
      if (!e.message?.toLowerCase().includes('cancel'))
        setError(e.message || 'خطأ في الكاميرا');
    }
    setLoading(false);
  };

  /* ── file input (web/desktop) ──────────────────────────────── */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true); setError('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const code = await decodeDataUrl(dataUrl);
      if (code) { success(code); return; }
      const code2 = await h5ScanFile(file);
      if (code2) { success(code2); return; }
      setError(t.scan_failed || 'لم يُعثر على رمز — حاول صورة أوضح أو أدخله يدوياً');
      setLoading(false);
    };
    reader.readAsDataURL(file);
    e.target.value='';
  };

  /* ── laser animation ───────────────────────────────────────── */
  useEffect(() => {
    if (!ready) return;
    let pos=0; let dir=1;
    const iv = setInterval(()=>{
      pos += dir*1.8;
      if (pos>=100) dir=-1;
      if (pos<=0)   dir=1;
      if (laserRef.current) laserRef.current.style.top=`${pos}%`;
    }, 14);
    return ()=>clearInterval(iv);
  }, [ready]);

  /* ── lifecycle ─────────────────────────────────────────────── */
  useEffect(()=>{
    if (mode==='camera') startLiveScanner();
    return ()=>{ stopScanner(); };
  }, [mode]);

  const switchMode = (m:'camera'|'image'|'manual') => {
    stopScanner(); setError(''); lockedRef.current=false; setMode(m);
  };

  const tabs = [
    { key:'camera' as const, icon:'📷', label: t.scan_barcode||'كاميرا' },
    { key:'image'  as const, icon:'🖼',  label: 'صورة' },
    { key:'manual' as const, icon:'⌨',  label: t.manual_barcode||'يدوي' },
  ];

  return (
    <div className="fixed inset-0 z-[5000] flex flex-col" style={{backgroundColor:'#000'}}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
        <h3 className="text-white font-black text-base">{title}</h3>
        <button onPointerDown={e=>{e.preventDefault();onClose();}}
          className="text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10">
          <X size={20}/>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pb-2 shrink-0">
        <div className="flex gap-1 bg-white/10 p-1 rounded-2xl">
          {tabs.map(tab=>(
            <button key={tab.key}
              onPointerDown={e=>{e.preventDefault(); switchMode(tab.key);}}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all
                ${mode===tab.key?'bg-primary text-white shadow':'text-white/60 hover:text-white'}`}>
              <span style={{fontSize:13}}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">

        {/* ═══ CAMERA ═══ */}
        {mode==='camera' && (
          <div className="relative w-full h-full">

            {/* html5-qrcode mounts its video here — we hide their UI and draw ours */}
            <div
              id={videoBoxId}
              className="absolute inset-0 w-full h-full overflow-hidden"
              style={{background:'#000'}}
            />

            {/* ── Success green flash ── */}
            {flashGreen && (
              <div className="absolute inset-0 z-30 pointer-events-none"
                style={{background:'rgba(74,222,128,0.35)'}}/>
            )}

            {/* ── Custom overlay (only when camera is live) ── */}
            {ready && !error && (
              <>
                {/* Dark mask with transparent scan window */}
                <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
                  <defs>
                    <mask id="scanWindow">
                      <rect width="100%" height="100%" fill="white"/>
                      {/* Transparent scanning rectangle — centred */}
                      <rect x="12%" y="27%" width="76%" height="44%" rx="14" fill="black"/>
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#scanWindow)"/>

                  {/* Corner L-brackets */}
                  <polyline points="12%,34% 12%,27% 20%,27%" fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round"/>
                  <polyline points="80%,27% 88%,27% 88%,34%" fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round"/>
                  <polyline points="88%,64% 88%,71% 80%,71%" fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round"/>
                  <polyline points="20%,71% 12%,71% 12%,64%" fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round"/>
                </svg>

                {/* Laser line — animated via JS in useEffect */}
                <div ref={laserRef} className="absolute z-20 pointer-events-none" style={{
                  left:'12%', width:'76%', height:'2px',
                  top:'27%', transform:'translateY(-50%)',
                  background:'linear-gradient(90deg,transparent,#60a5fa,#3b82f6,#60a5fa,transparent)',
                  boxShadow:'0 0 10px 3px rgba(59,130,246,0.7)',
                  borderRadius:'2px',
                }}/>

                {/* Hint text */}
                <div className="absolute bottom-10 inset-x-0 z-20 text-center pointer-events-none">
                  <p className="text-white font-bold text-sm drop-shadow-lg">{hint}</p>
                </div>

                {/* Torch button */}
                <div className="absolute bottom-20 inset-x-0 z-20 flex justify-center">
                  <button onPointerDown={e=>{e.preventDefault();toggleTorch();}}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all
                      ${torchOn?'bg-yellow-400 text-black':'bg-white/15 text-white border border-white/20'}`}>
                    {torchOn?'🔦 إطفاء الضوء':'🔦 تشغيل الضوء'}
                  </button>
                </div>
              </>
            )}

            {/* Loading */}
            {loading && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"/>
                <p className="text-white/70 text-sm font-bold">جاري تشغيل الكاميرا...</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="absolute inset-x-4 top-4 z-30">
                <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-sm rounded-2xl p-4 text-center">
                  {error}
                </div>
                <button onPointerDown={e=>{e.preventDefault();startLiveScanner();}}
                  className="w-full mt-3 bg-primary text-white py-3 rounded-xl font-bold text-sm active:scale-95">
                  🔄 إعادة المحاولة
                </button>
                {/* Android fallback */}
                {isNativeAndroid() && (
                  <div className="mt-3 space-y-2">
                    <button onPointerDown={e=>{e.preventDefault();androidCapture('camera');setError('');}}
                      className="w-full bg-white/10 text-white py-3 rounded-xl font-bold text-sm active:scale-95">
                      📷 فتح كاميرا النظام
                    </button>
                    <button onPointerDown={e=>{e.preventDefault();androidCapture('photos');setError('');}}
                      className="w-full bg-white/10 text-white py-3 rounded-xl font-bold text-sm active:scale-95">
                      🖼 اختر من المعرض
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ IMAGE ═══ */}
        {mode==='image' && (
          <div className="flex flex-col items-center justify-center h-full gap-5 px-6">
            {error&&<div className="bg-red-500/20 border border-red-400/40 text-red-200 text-sm rounded-2xl p-3 text-center w-full max-w-xs">{error}</div>}
            {loading?(
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"/>
                <p className="text-white/60 text-sm">جاري التحليل...</p>
              </div>
            ):(
              <>
                <ImageIcon size={52} className="text-white/30"/>
                <p className="text-white/60 text-sm text-center">اختر صورة تحتوي على باركود أو QR</p>
                {isNativeAndroid()?(
                  <div className="w-full max-w-xs space-y-3">
                    <button onPointerDown={e=>{e.preventDefault();androidCapture('photos');}}
                      className="w-full bg-primary text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95">
                      <ImageIcon size={18}/> اختر من المعرض
                    </button>
                    <button onPointerDown={e=>{e.preventDefault();androidCapture('camera');}}
                      className="w-full bg-white/10 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95">
                      📷 التقط صورة
                    </button>
                  </div>
                ):(
                  <>
                    <button onPointerDown={e=>{e.preventDefault();fileRef.current?.click();}}
                      className="w-full max-w-xs bg-primary text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95">
                      <ImageIcon size={18}/> اختر صورة
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile}/>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ MANUAL ═══ */}
        {mode==='manual' && (
          <div className="flex flex-col items-center justify-center h-full gap-5 px-6">
            <p className="text-white/60 text-sm">أدخل الرمز يدوياً</p>
            <input autoFocus value={manual} onChange={e=>setManual(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&manual.trim()&&success(manual.trim())}
              placeholder="0123456789..."
              className="w-full max-w-sm px-4 py-4 rounded-2xl bg-white/10 text-white text-center text-xl font-mono outline-none border-2 border-transparent focus:border-primary"
            />
            <button onPointerDown={e=>{e.preventDefault();manual.trim()&&success(manual.trim());}}
              disabled={!manual.trim()}
              className="w-full max-w-sm bg-primary text-white py-4 rounded-2xl font-black disabled:opacity-50 text-base active:scale-95">
              ✓ {t.confirm||'تأكيد'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
