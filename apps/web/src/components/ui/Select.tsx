import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ 
  label, 
  error, 
  hint, 
  options,
  icon,
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
      <select
        className={`w-full appearance-none rounded-lg border ${
          error 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
        } px-3 py-2.5 text-sm focus:border-2 focus:outline-none focus:ring-1 disabled:background-slate-50 disabled:text-slate-500 transition-all duration-200 ${icon ? 'pl-10' : ''} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    {hint && !error && <p className="text-sm text-slate-500">{hint}</p>}
  </div>
);

export default Select;
