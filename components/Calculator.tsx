import React, { useState, useEffect, useCallback } from 'react';
import { X, Delete, Calculator as CalcIcon } from 'lucide-react';

interface CalculatorProps {
  onClose?: () => void;
  onInsertAmount?: (amount: number) => void;
  compact?: boolean;
  theme?: 'light' | 'dark';
  t?: any;
}

export const Calculator: React.FC<CalculatorProps> = ({ onClose, onInsertAmount, compact = false, theme = 'dark', t = {} }) => {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [memory, setMemory] = useState(0);

  const handleKey = useCallback((key: string) => {
    if (key === 'C') {
      setDisplay('0');
      setExpression('');
      setJustEvaluated(false);
      return;
    }
    if (key === '⌫') {
      if (display.length > 1) setDisplay(d => d.slice(0, -1));
      else setDisplay('0');
      return;
    }
    if (key === '=') {
      try {
        const expr = expression + display;
        const cleaned = expr
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/,/g, '');
        const result = Function('"use strict"; return (' + cleaned + ')')();
        const rounded = parseFloat(result.toFixed(6)).toString();
        setHistory(h => [`${expr} = ${rounded}`, ...h.slice(0, 9)]);
        setDisplay(rounded);
        setExpression('');
        setJustEvaluated(true);
      } catch {
        setDisplay('خطأ');
        setExpression('');
      }
      return;
    }
    if (['+', '-', '×', '÷', '%'].includes(key)) {
      if (display === 'خطأ') return;
      if (justEvaluated) {
        setExpression(display + key);
        setDisplay('0');
        setJustEvaluated(false);
        return;
      }
      if (expression && display === '0') {
        setExpression(expr => expr.slice(0, -1) + key);
        return;
      }
      setExpression(e => e + display + key);
      setDisplay('0');
      return;
    }
    if (key === '±') {
      setDisplay(d => d.startsWith('-') ? d.slice(1) : '-' + d);
      return;
    }
    if (key === 'MR') { setDisplay(memory.toString()); return; }
    if (key === 'M+') { setMemory(m => m + parseFloat(display || '0')); return; }
    if (key === 'M-') { setMemory(m => m - parseFloat(display || '0')); return; }
    if (key === 'MC') { setMemory(0); return; }

    // number/dot input
    if (justEvaluated) {
      setDisplay(key === '.' ? '0.' : key);
      setJustEvaluated(false);
      return;
    }
    if (key === '.') {
      if (!display.includes('.')) setDisplay(d => d + '.');
      return;
    }
    setDisplay(d => d === '0' ? key : d.length < 15 ? d + key : d);
  }, [display, expression, justEvaluated, memory]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['0','1','2','3','4','5','6','7','8','9'].includes(e.key)) handleKey(e.key);
      else if (e.key === '+') handleKey('+');
      else if (e.key === '-') handleKey('-');
      else if (e.key === '*') handleKey('×');
      else if (e.key === '/') { e.preventDefault(); handleKey('÷'); }
      else if (e.key === '%') handleKey('%');
      else if (e.key === '.') handleKey('.');
      else if (e.key === 'Enter' || e.key === '=') handleKey('=');
      else if (e.key === 'Backspace') handleKey('⌫');
      else if (e.key === 'Escape') handleKey('C');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  const isDark = theme === 'dark';
  const baseBg = isDark ? 'bg-gray-900' : 'bg-white';
  const displayBg = isDark ? 'bg-gray-800' : 'bg-gray-50';
  const numberBtn = isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  const opBtn = isDark ? 'bg-primary/80 text-white hover:bg-primary' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white';
  const eqBtn = 'bg-primary text-white hover:bg-primary/90 active:scale-95';
  const memBtn = isDark ? 'bg-gray-600 text-xs text-gray-200 hover:bg-gray-500' : 'bg-gray-200 text-xs text-gray-600 hover:bg-gray-300';

  const buttons = compact ? [
    ['C', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '⌫', '='],
  ] : [
    ['MC', 'MR', 'M+', 'M-'],
    ['C', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '⌫', '='],
  ];

  const getButtonStyle = (key: string) => {
    if (key === '=') return `${eqBtn} text-lg font-black`;
    if (['+', '-', '×', '÷', '%'].includes(key)) return `${opBtn} font-bold`;
    if (['MC', 'MR', 'M+', 'M-'].includes(key)) return `${memBtn} font-bold`;
    if (['C', '±', '⌫'].includes(key)) return isDark ? 'bg-red-600/80 text-white hover:bg-red-600 font-bold' : 'bg-red-100 text-red-600 hover:bg-red-200 font-bold';
    return `${numberBtn} font-medium`;
  };

  return (
    <div className={`${baseBg} rounded-2xl shadow-2xl overflow-hidden select-none ${compact ? 'w-72' : 'w-80'}`}>
      {/* Title bar */}
      {!compact && (
        <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'bg-gray-800 border-b border-gray-700' : 'bg-gray-100 border-b border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <CalcIcon size={16} className="text-primary" />
            <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{t.calculator || 'آلة حاسبة'}</span>
            {memory !== 0 && <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full">M={memory}</span>}
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Display */}
      <div className={`${displayBg} px-4 py-3`}>
        <div className={`text-xs text-end h-5 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {expression || '\u00A0'}
        </div>
        <div className={`text-3xl font-black text-end truncate mt-1 ${isDark ? 'text-white' : 'text-gray-900'} ${display.length > 10 ? 'text-xl' : ''}`}>
          {display}
        </div>
      </div>

      {/* History mini */}
      {!compact && history.length > 0 && (
        <div className={`px-4 py-2 text-xs ${isDark ? 'text-gray-500 border-b border-gray-700' : 'text-gray-400 border-b border-gray-100'} truncate`}>
          {history[0]}
        </div>
      )}

      {/* Buttons */}
      <div className="p-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {buttons.flat().map((key, i) => (
          <button
            key={i}
            onPointerDown={(e) => { e.preventDefault(); handleKey(key); }}
            className={`aspect-square flex items-center justify-center rounded-xl text-lg transition-all active:scale-90 ${getButtonStyle(key)}`}
            style={{ fontSize: key.length > 1 ? '0.7rem' : undefined }}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Insert button */}
      {onInsertAmount && !isNaN(parseFloat(display)) && (
        <div className="px-3 pb-3">
          <button
            onClick={() => onInsertAmount(parseFloat(display))}
            className="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-all"
          >
            ✓ {t.insert_amount || 'إدراج المبلغ'}: {parseFloat(display).toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
};
