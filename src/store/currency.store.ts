// src/store/currency.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CurrencyCode = 'AED' | 'USD' | 'EUR' | 'GBP' | 'SAR' | 'QAR';

export interface CurrencyConfig {
  code: CurrencyCode;
  label: string;
  symbol: string;
  flag: string;
  rateFromUSD: number; // For clean display conversion if needed
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  AED: {
    code: 'AED',
    label: 'UAE Dirham',
    symbol: 'AED',
    flag: '🇦🇪',
    rateFromUSD: 3.67,
  },
  USD: {
    code: 'USD',
    label: 'US Dollar',
    symbol: '$',
    flag: '🇺🇸',
    rateFromUSD: 1.0,
  },
  EUR: {
    code: 'EUR',
    label: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
    rateFromUSD: 0.92,
  },
  GBP: {
    code: 'GBP',
    label: 'British Pound',
    symbol: '£',
    flag: '🇬🇧',
    rateFromUSD: 0.79,
  },
  SAR: {
    code: 'SAR',
    label: 'Saudi Riyal',
    symbol: 'SAR',
    flag: '🇸🇦',
    rateFromUSD: 3.75,
  },
  QAR: {
    code: 'QAR',
    label: 'Qatari Riyal',
    symbol: 'QAR',
    flag: '🇶🇦',
    rateFromUSD: 3.64,
  },
};

interface CurrencyState {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: 'AED', // Default currency is UAE Dirham
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'terrapulse-currency',
    }
  )
);
