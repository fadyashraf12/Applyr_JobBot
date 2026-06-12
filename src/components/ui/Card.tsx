import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export default function Card({ children, className = '', hoverable = false, ...props }: CardProps) {
  return (
    <div
      className={`bg-slate-900/65 border border-slate-800/80 rounded-xl p-6 backdrop-blur-sm shadow-xl transition-all duration-300 ${
        hoverable ? 'hover:border-slate-700/60 hover:translate-y-[-2px] hover:shadow-indigo-500/5' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
