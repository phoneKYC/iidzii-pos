
import React from 'react';

interface LogoProps {
  size?: number;
  variant?: 'light' | 'dark' | 'white';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 50, variant = 'light', className = "" }) => {
  const isWhite = variant === 'white';
  const isDark = variant === 'dark';
  
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M32 35V28C32 18 40 10 50 10C60 10 68 18 68 28V35" 
          stroke={isWhite ? "white" : "#0ea5e9"} 
          strokeWidth="8" 
          strokeLinecap="round"
        />
        <rect 
          x="15" 
          y="35" 
          width="70" 
          height="55" 
          rx="15" 
          fill={isWhite ? "white" : "#0ea5e9"} 
        />
        <path 
          d="M40 55L50 65L60 55" 
          stroke={isWhite ? "#0ea5e9" : "white"} 
          strokeWidth="6" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      
      <div className="text-center leading-tight">
        <div className={`text-sm font-black ${isWhite ? "text-white" : isDark ? "text-black" : "text-gray-800 dark:text-white"}`}>IIDZII POS</div>
        <div className={`text-[8px] font-black tracking-widest uppercase ${isWhite ? "text-white/80" : isDark ? "text-gray-600" : "text-primary"}`}>IIDZII POS</div>
      </div>
    </div>
  );
};
