// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency?: string): string {
  let activeCurrency = currency;
  if (!activeCurrency && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('terrapulse-currency');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.state?.currency) {
          activeCurrency = parsed.state.currency;
        }
      }
    } catch {
      // ignore
    }
  }
  activeCurrency = activeCurrency || 'AED';

  if (activeCurrency === 'AED') {
    return `AED ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: activeCurrency }).format(amount);
  } catch {
    return `${activeCurrency} ${amount.toLocaleString('en-US')}`;
  }
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, yyyy');
}

export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    // Project statuses
    inquiry: 'bg-blue-100 text-blue-700',
    proposal_sent: 'bg-indigo-100 text-indigo-700',
    revision_requested: 'bg-orange-100 text-orange-700',
    awaiting_payment: 'bg-amber-100 text-amber-700',
    mobilization: 'bg-purple-100 text-purple-700',
    design: 'bg-pink-100 text-pink-700',
    approval: 'bg-yellow-100 text-yellow-700',
    scheduled: 'bg-cyan-100 text-cyan-700',
    in_progress: 'bg-green-100 text-green-700',
    completed: 'bg-emerald-100 text-emerald-800',
    on_hold: 'bg-gray-100 text-gray-600',
    // Design statuses
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    changes_requested: 'bg-orange-100 text-orange-700',
    rejected: 'bg-red-100 text-red-700',
    // Invoice statuses
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-400',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'proposal_sent': return 'Proposal Sent';
    case 'revision_requested': return 'Revision Requested';
    case 'awaiting_payment': return 'Awaiting Payment';
    case 'mobilization': return 'Mobilization';
    default:
      return status
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}

export function getProjectProgress(phases: { status: string }[]): number {
  if (!phases.length) return 0;
  const completed = phases.filter((p) => p.status === 'completed').length;
  return Math.round((completed / phases.length) * 100);
}
