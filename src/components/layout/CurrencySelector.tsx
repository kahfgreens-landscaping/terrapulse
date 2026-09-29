// src/components/layout/CurrencySelector.tsx
import { useState, useRef, useEffect } from 'react';
import { useCurrencyStore, CURRENCIES, type CurrencyCode } from '@/store/currency.store';
import { DirhamSymbol } from '@/components/ui/DirhamSymbol';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CurrencySelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { currency, setCurrency } = useCurrencyStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const active = CURRENCIES[currency] || CURRENCIES.AED;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-border bg-background hover:bg-muted text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        title="Select Display Currency"
        aria-label="Currency Selector"
      >
        <span className="text-base leading-none">{active.flag}</span>
        {active.code === 'AED' ? (
          <div className="flex items-center gap-1 font-semibold text-foreground">
            <DirhamSymbol className="w-3.5 h-3.5 text-primary-600" />
            <span>AED</span>
          </div>
        ) : (
          <span className="font-semibold text-foreground">{active.code}</span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-3 py-1.5 border-b border-border/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Select Currency
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
              const item = CURRENCIES[code];
              const isSelected = item.code === currency;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setCurrency(code);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted/70 transition-colors',
                    isSelected && 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 font-semibold'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base">{item.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        {item.code === 'AED' ? (
                          <DirhamSymbol className="w-3.5 h-3.5 text-primary-600 inline" />
                        ) : null}
                        <span>{item.code}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
