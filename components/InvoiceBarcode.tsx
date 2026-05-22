/**
 * InvoiceBarcode — Code 128B SVG renderer (no external library)
 * Renders a slim horizontal barcode containing only the invoice serial number.
 * Pattern source: Code 128 spec (START B = 104, STOP = 106, checksum mod-103)
 */
import React from 'react';

// ── Code 128B encoding table ──────────────────────────────────────────────────
// Each entry = 11-bit bar pattern (1=bar, 0=space), index = code value
const C128_PATTERNS: string[] = [
  '11011001100','11001101100','11001100110','10010011000','10010001100',
  '10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110',
  '10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100',
  '11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000',
  '10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110',
  '10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000',
  '11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100',
  '10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010',
  '11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100',
  '10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110',
  '10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000',
  '11010011100','1100011101011', // index 103 = START B (special, skip below)
];
const START_B_PATTERN = '11010010000'; // value 104
const STOP_PATTERN    = '1100011101011'; // value 106

function encodeCode128B(text: string): string {
  // values: START_B=104, then each char as (ASCII - 32), then checksum, then STOP
  let checksum = 104; // START B value
  let bars = START_B_PATTERN;
  for (let i = 0; i < text.length; i++) {
    const v = text.charCodeAt(i) - 32;
    checksum += v * (i + 1);
    bars += C128_PATTERNS[v] || C128_PATTERNS[0];
  }
  bars += C128_PATTERNS[checksum % 103];
  bars += STOP_PATTERN;
  return bars;
}

interface InvoiceBarcodeProps {
  value: string;       // e.g. "MTJR-242V8A"
  width?: number;      // total SVG width in px
  height?: number;     // bar height in px
  showText?: boolean;
  className?: string;
}

export const InvoiceBarcode: React.FC<InvoiceBarcodeProps> = ({
  value,
  width = 240,
  height = 40,
  showText = true,
  className = '',
}) => {
  const textHeight = showText ? 14 : 0;
  const paddingX   = 10;
  const bars       = encodeCode128B(value);
  const barCount   = bars.length;
  const barWidth   = (width - paddingX * 2) / barCount;
  const svgHeight  = height + textHeight + 4;

  const rects: React.ReactNode[] = [];
  let x = paddingX;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === '1') {
      // collect consecutive 1s for a wide bar
      let w = 0;
      while (i < bars.length && bars[i] === '1') { w++; i++; }
      i--; // outer loop will increment
      rects.push(
        <rect key={x} x={x} y={0} width={barWidth * w} height={height} fill="#000" />
      );
    }
    x += barWidth;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${svgHeight}`}
      width={width}
      height={svgHeight}
      className={className}
      style={{ display: 'block' }}
    >
      <rect x={0} y={0} width={width} height={svgHeight} fill="#fff" />
      {rects}
      {showText && (
        <text
          x={width / 2}
          y={height + textHeight}
          textAnchor="middle"
          fontSize={10}
          fontFamily="monospace"
          fill="#333"
          letterSpacing="1"
        >
          {value}
        </text>
      )}
    </svg>
  );
};

// Generates a serial like "MTJR-XXXXXX" from random base36
export const generateInvoiceSerial = (): string => {
  const part = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `MTJR-${part}`;
};
