import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export default function Textarea({
  className = '',
  label,
  error,
  id,
  rows = 4,
  ...props
}: TextareaProps) {
  const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label ? (
        <label htmlFor={textareaId} className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        rows={rows}
        className={`w-full p-3 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 transition-all duration-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 ${
          error ? 'border-red-900/50 focus:ring-red-900/10 focus:border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-red-500 mt-0.5">{error}</p>
      ) : null}
    </div>
  );
}
