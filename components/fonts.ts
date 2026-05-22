// fonts.ts
import UbuntuArabicRegular from './fonts/UbuntuArabic-Regular.otf?url';
import UbuntuArabicBold from './fonts/UbuntuArabic-Bold.otf?url';

export const fontUrls = {
    regular: UbuntuArabicRegular,
    bold: UbuntuArabicBold
};

// هذه الدالة تحقن الخط في الصفحة
export function injectFonts() {
    const style = document.createElement('style');
    style.textContent = `
    @font-face {
        font-family: 'Ubuntu Arabic';
        src: url('${UbuntuArabicRegular}') format('opentype');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: 'Ubuntu Arabic';
        src: url('${UbuntuArabicBold}') format('opentype');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
    }
    `;
    document.head.appendChild(style);
}
