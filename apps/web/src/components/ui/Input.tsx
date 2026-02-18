import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ 
  label, 
  error, 
  hint, 
  icon,
  iconRight,
  className = '', 
  ...props 
}) => (
  <div className="space-y-1.5">
    {label && (
      <label className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
    )}
    <div className="relative">
      {icon && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <div className="text-slate-400">{icon}</div>
        </div>
      )}
      <input
        className={`w-full rounded-lg border ${
          error 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
        } px-3 py-2.5 text-sm placeholder-slate-400 focus:border-2 focus:outline-none focus:ring-1 disabled:background-slate-50 disabled:text-slate-500 transition-all duration-200 ${icon ? 'pl-10' : ''} ${iconRight ? 'pr-10' : ''} ${className}`}
        {...props}
      />
      {iconRight && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <div className="text-slate-400">{iconRight}</div>
        </div>
      )}
    </div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    {hint && !error && <p className="text-sm text-slate-500">{hint}</p>}
  </div>
);

export default Input;
