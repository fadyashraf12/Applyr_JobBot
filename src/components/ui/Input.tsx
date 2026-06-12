import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  className = '',
  label,
  error,
  type = 'text',
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 align-left text-left">
      {label ? (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-400 tracking-wider uppercase text-left">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        type={type}
        className={`w-full px-4 h-10 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 transition-all duration-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 ${
          error ? 'border-red-900 focus:ring-red-900/10 focus:border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-red-500 mt-0.5 text-left">{error}</p>
      ) : null}
    </div>
  );
}
