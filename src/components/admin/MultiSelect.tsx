import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Option {
  value: string;
  label: string;
  icon?: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  label: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, placeholder, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOptions = options.filter(opt => selected.includes(opt.value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    onChange(Array.from(newSelected));
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
      <div className="input-base !p-2 !bg-deep-navy/50">
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map(option => (
            <div key={option.value} className="flex items-center gap-1 bg-electric-blue/20 text-electric-blue text-xs font-semibold px-2 py-1 rounded">
              {option.label}
              <button type="button" onClick={() => toggleOption(option.value)} className="hover:text-white">
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex-1 flex items-center justify-between text-left min-w-[100px]"
          >
            {selected.length === 0 && <span className="text-text-disabled ml-1">{placeholder}</span>}
            <span/>
            <ChevronDown className={`transition-transform text-text-disabled ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 w-full bg-navy-accent border border-disabled rounded-xl shadow-lg z-10 p-2 max-h-48 overflow-y-auto"
          >
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleOption(option.value)}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-electric-blue/10 rounded-lg"
              >
                <div className={`w-4 h-4 rounded border-2 ${selected.includes(option.value) ? 'bg-electric-blue border-electric-blue' : 'border-disabled'}`} />
                <span className="text-text-primary">{option.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
