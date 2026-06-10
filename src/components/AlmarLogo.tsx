import React from 'react';

interface AlmarLogoProps {
  className?: string;
  iconOnly?: boolean;
}

export const AlmarLogo: React.FC<AlmarLogoProps> = ({ className = 'h-10', iconOnly = false }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Three connected loops (emblem matching the corporate branding) */}
      <svg
        viewBox="0 0 160 120"
        className="h-full w-auto select-none shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g filter="drop-shadow(0px 2px 8px rgba(20, 184, 166, 0.25))">
          {/* Loop left-middle */}
          <path
            d="M 62 60 C 42 60, 42 35, 62 35 C 75 35, 80 48, 88 60 C 96 72, 101 85, 114 85 C 134 85, 134 60, 114 60"
            stroke="#14b8a6"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Loop right-middle */}
          <path
            d="M 114 60 C 134 60, 134 35, 114 35 C 101 35, 96 48, 88 60 C 80 72, 75 85, 62 85 C 42 85, 42 60, 62 60"
            stroke="#14b8a6"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Top connecting loop loop */}
          <path
            d="M 88 56 C 88 36, 68 36, 68 56 C 68 69, 78 74, 88 82 C 98 74, 108 69, 108 56 C 108 36, 88 36, 88 56"
            stroke="#14b8a6"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      
      {!iconOnly && (
        <div className="flex flex-col justify-center text-left">
          <span className="text-white font-black text-lg tracking-[0.25em] leading-none uppercase font-sans">
            ALMAR
          </span>
          <span className="text-teal-400 font-extrabold text-[8px] uppercase tracking-[0.16em] leading-none mt-1 font-mono">
            GRUPO ACUÍCOLA
          </span>
        </div>
      )}
    </div>
  );
};
