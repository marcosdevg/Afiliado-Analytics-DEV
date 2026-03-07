"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
}

export default function CustomSelect({ value, onChange, options, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Botão do Select */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="appearance-none w-full pl-4 pr-10 py-2.5 bg-dark-card border-2 border-dark-border rounded-full text-text-primary text-sm font-medium hover:border-shopee-orange/50 focus:outline-none focus:ring-2 focus:ring-shopee-orange/30 focus:border-shopee-orange cursor-pointer transition-all text-left"
      >
        {selectedOption?.label}
      </button>

      {/* Ícone Chevron */}
      <ChevronDown 
        className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none transition-all duration-200 ${
          isOpen ? 'rotate-180 text-shopee-orange' : ''
        }`}
      />

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 right-0 mt-2 border border-dark-border rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in"
          style={{ backgroundColor: '#1F1F23' }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-sm font-medium text-left flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'text-shopee-orange'
                    : 'text-text-primary'
                }`}
                style={{
                  backgroundColor: isSelected 
                    ? 'rgba(238, 77, 45, 0.1)' 
                    : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#3A3A40';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
