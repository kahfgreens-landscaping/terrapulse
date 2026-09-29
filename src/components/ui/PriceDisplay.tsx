// src/components/ui/PriceDisplay.tsx
import React from 'react';
import { useCurrencyStore, CURRENCIES, type CurrencyCode } from '@/store/currency.store';
import { DirhamSymbol } from './DirhamSymbol';
import { cn } from '@/lib/utils';

interface PriceDisplayProps {
  amount: number;
  currency?: CurrencyCode;
  className?: string;
  symbolClassName?: string;
  showDecimals?: boolean;
  compact?: boolean;
}

export function PriceDisplay({
  amount,
  currency: propCurrency,
  className,
  symbolClassName,
  showDecimals = false,
  compact = false,
}: PriceDisplayProps) {
  const storeCurrency = useCurrencyStore((s) => s.currency);
  const activeCurrency = propCurrency || storeCurrency || 'AED';
  const config = CURRENCIES[activeCurrency] || CURRENCIES.AED;

  const formattedNumber = compact
    ? amount >= 1000000
      ? `${(amount / 1000000).toFixed(1)}M`
      : amount >= 1000
      ? `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`
      : amount.toLocaleString('en-US', {
          minimumFractionDigits: showDecimals ? 2 : 0,
          maximumFractionDigits: showDecimals ? 2 : 0,
        })
    : amount.toLocaleString('en-US', {
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
      });

  if (activeCurrency === 'AED') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 font-semibold', className)}>
        <DirhamSymbol className={cn('w-[0.95em] h-[0.95em] text-current shrink-0', symbolClassName)} />
        <span>{formattedNumber}</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center font-semibold', className)}>
      <span className={cn('mr-1', symbolClassName)}>{config.symbol}</span>
      <span>{formattedNumber}</span>
    </span>
  );
}
