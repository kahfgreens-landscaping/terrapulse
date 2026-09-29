// src/app/documents/DocumentsPage.tsx
import { motion } from 'framer-motion';
import { where, orderBy } from 'firebase/firestore';
import { FileText, Download, CreditCard, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency, formatBytes, statusColor, statusLabel } from '@/lib/utils';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import type { Invoice, Document } from '@/types';
import { useState } from 'react';

export function DocumentsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'invoices' | 'documents'>('invoices');

  const { data: invoices } = useCollection<Invoice>(
    'invoices',
    where('clientId', '==', user?.uid ?? ''),
    orderBy('createdAt', 'desc')
  );

  const { data: documents } = useCollection<Document>(
    'documents',
    orderBy('uploadedAt', 'desc')
  );

  const totalOwed = invoices
    .filter((i) => ['sent', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + i.amount, 0);

  const invoiceStatusIcon = (status: Invoice['status']) => {
    if (status === 'paid') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === 'overdue') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-yellow-600" />;
  };

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Documents & Invoices</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your contracts, estimates, and payments</p>
      </div>

      {/* Summary */}
      {totalOwed > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-5 mb-6 flex items-center justify-between"
        >
          <div>
            <p className="text-sm text-yellow-800 font-medium">Outstanding Balance</p>
            <PriceDisplay amount={totalOwed} className="text-3xl font-bold text-yellow-900 mt-1" />
          </div>
          <Button variant="accent">
            <CreditCard className="w-4 h-4 mr-2" />
            Pay Now
          </Button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted rounded-xl p-1 w-fit">
        {(['invoices', 'documents'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No invoices yet</p>
            </div>
          ) : (
            invoices.map((invoice, i) => (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <Card className="card-hover">
                  <CardContent className="pt-4 pb-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                      {invoiceStatusIcon(invoice.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">Invoice #{invoice.invoiceNumber}</p>
                        <span className={`status-badge text-xs ${statusColor(invoice.status)}`}>
                          {statusLabel(invoice.status)}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span>Due {formatDate(invoice.dueDate)}</span>
                        {invoice.paidAt && <span>Paid {formatDate(invoice.paidAt)}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <PriceDisplay amount={invoice.amount} className="font-bold text-lg" />
                      {['sent', 'overdue'].includes(invoice.status) && (
                        <Button size="sm" variant="accent" className="mt-1">
                          <CreditCard className="w-3 h-3 mr-1" /> Pay
                        </Button>
                      )}
                      {invoice.pdfUrl && (
                        <a href={invoice.pdfUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="mt-1">
                            <Download className="w-3 h-3 mr-1" /> PDF
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No documents yet</p>
            </div>
          ) : (
            documents.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <Card className="card-hover">
                  <CardContent className="pt-4 pb-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span className="capitalize">{doc.type}</span>
                        <span>{formatBytes(doc.size)}</span>
                        <span>{formatDate(doc.uploadedAt)}</span>
                      </div>
                    </div>
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      <Button size="icon-sm" variant="ghost">
                        <Download className="w-4 h-4" />
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
