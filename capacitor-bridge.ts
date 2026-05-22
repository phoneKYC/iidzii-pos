/**
 * IIDZII POS Capacitor Bridge
 * Handles: print (PDF on Android), save image, camera permission
 */

const isNativeAndroid = (): boolean =>
  !!(window as any).Capacitor?.isNativePlatform?.() &&
  (window as any).Capacitor?.getPlatform?.() === 'android';

const isElectron = (): boolean => !!(window as any).electronAPI;

// ─────────────────────────────────────────────────────────────────
// PRINT
// ─────────────────────────────────────────────────────────────────
export const printOrShare = async (
  htmlContent: string,
  saleId: string,
  receiptElement?: HTMLElement   // pass the DOM element for PDF generation
): Promise<{ success: boolean; error?: string }> => {

  // ── Electron / AppImage ───────────────────────────────────────
  if (isElectron()) {
    try {
      const r = await (window as any).electronAPI.printInvoice(htmlContent);
      return r;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ── Android — convert receipt DOM to PNG then share ──────────
  // Sharing as PNG allows printer apps, WhatsApp, Drive, etc.
  if (isNativeAndroid()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      let imageBase64: string | null = null;

      if (receiptElement) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(receiptElement, {
            scale: 4,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: 320,
            windowWidth: 320,
            scrollX: 0,
            scrollY: -window.scrollY,
            imageTimeout: 5000,
            allowTaint: true,
          });
          // Remove 'data:image/png;base64,' prefix
          imageBase64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
        } catch {}
      }

      if (imageBase64) {
        const filename = `فاتورة_${saleId}.png`;
        await Filesystem.writeFile({
          path: filename,
          data: imageBase64,
          directory: Directory.Cache,
        });
        const { uri } = await Filesystem.getUri({
          path: filename,
          directory: Directory.Cache,
        });
        await Share.share({
          title: `فاتورة ${saleId}`,
          text: `IIDZII POS فاتورة — ${saleId}`,
          url: uri,
          // dialogTitle يظهر نص التوجيه في قائمة Share
          dialogTitle: '🖨 اختر: تطبيق الطباعة أو معرض الصور أو مشاركة',
        });
        return { success: true };
      }

      // Fallback: share HTML — استخدام PDF viewer / مكتبي إذا كان متاحاً
      const { Encoding } = await import('@capacitor/filesystem');
      const fname2 = `فاتورة_${saleId}.html`;
      await Filesystem.writeFile({
        path: fname2, data: htmlContent,
        directory: Directory.Cache, encoding: Encoding.UTF8,
      });
      const { uri: uri2 } = await Filesystem.getUri({ path: fname2, directory: Directory.Cache });
      await Share.share({
        title: `فاتورة ${saleId}`,
        text: `IIDZII POS فاتورة — ${saleId}`,
        url: uri2,
        dialogTitle: '🖨 اختر تطبيق الطباعة أو المستندات',
      });
      return { success: true };

    } catch (e: any) {
      return webBlobPrint(htmlContent, saleId);
    }
  }

  // ── Web / PWA fallback ────────────────────────────────────────
  return webBlobPrint(htmlContent, saleId);
};

function webBlobPrint(
  html: string,
  saleId: string
): { success: boolean; error?: string } {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, '_blank');
    if (w) { setTimeout(() => URL.revokeObjectURL(url), 30000); return { success: true }; }
    const a = document.createElement('a');
    a.href = url; a.download = `Invoice_${saleId}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// SAVE IMAGE
// ─────────────────────────────────────────────────────────────────
export const saveImage = async (
  dataUrl: string,
  filename: string
): Promise<{ success: boolean }> => {
  if (isNativeAndroid()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = dataUrl.split(',')[1];
      // Write to cache (always writable, no permission needed)
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      const { uri } = await Filesystem.getUri({
        path: filename,
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        text: filename,
        url: uri,
        dialogTitle: '🖼 حفظ الصورة — اختر معرض الصور أو التخزين',
      } as any);
      return { success: true };
    } catch { /* fallback */ }
  }
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename; a.click();
  return { success: true };
};

// ─────────────────────────────────────────────────────────────────
// CAMERA PERMISSION
// ─────────────────────────────────────────────────────────────────
export const requestCameraPermission = async (): Promise<boolean> => {
  if (isNativeAndroid()) {
    try {
      const { Camera } = await import('@capacitor/camera');
      const s = await Camera.requestPermissions({ permissions: ['camera'] });
      return s.camera === 'granted';
    } catch { return false; }
  }
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    return true;
  } catch { return false; }
};

// ─────────────────────────────────────────────────────────────────
// EXTERNAL LINKS — open in system browser, not WebView
// ─────────────────────────────────────────────────────────────────
export const openExternalLink = async (url: string): Promise<void> => {
  if (isNativeAndroid()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch { /* fallback */ }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};
