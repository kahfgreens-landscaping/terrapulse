// src/components/projects/BOQModal.tsx
import { useState } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Plus, Trash2, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Proposal, BOQItem } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface BOQModalProps {
  projectId: string;
  clientId: string;
  clientName: string;
  existingProposal?: Proposal | null;
  onClose: () => void;
}

export function BOQModal({ projectId, clientId, clientName, existingProposal, onClose }: BOQModalProps) {
  const [items, setItems] = useState<BOQItem[]>(existingProposal?.items || []);
  const [vatPercent, setVatPercent] = useState(existingProposal?.vatPercent ?? 5);
  const [advancePercent, setAdvancePercent] = useState(existingProposal?.advancePercent ?? 30);
  const [notes, setNotes] = useState(existingProposal?.notes || '');
  const [validUntil, setValidUntil] = useState(existingProposal?.validUntil || '');
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const vatAmount = (subtotal * vatPercent) / 100;
  const totalAmount = subtotal + vatAmount;
  const advanceAmount = (totalAmount * advancePercent) / 100;

  const handleAddItem = () => {
    setItems([...items, { id: uuidv4(), description: '', quantity: 1, unit: 'unit', unitPrice: 0, total: 0 }]);
  };

  const handleUpdateItem = (id: string, field: keyof BOQItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = (updated.quantity || 0) * (updated.unitPrice || 0);
        }
        return updated;
      }
      return item;
    }));
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleQuickAdd = (desc: string) => {
    setItems([...items, { id: uuidv4(), description: desc, quantity: 1, unit: 'unit', unitPrice: 0, total: 0 }]);
  };

  const handleSave = async (status: 'draft' | 'sent') => {
    if (items.length === 0) return alert('Add at least one item');
    setSaving(true);
    try {
      const payload = {
        projectId,
        clientId,
        clientName,
        items,
        subtotal,
        vatPercent,
        vatAmount,
        totalAmount,
        advancePercent,
        advanceAmount,
        notes,
        validUntil: validUntil || new Date(Date.now() + 30 * 86400000).toISOString(),
        status,
        revisionCount: existingProposal?.revisionCount || 0,
        updatedAt: new Date().toISOString(),
      };

      let pId = existingProposal?.id;

      if (existingProposal) {
        await updateDoc(doc(db, 'proposals', existingProposal.id), {
          ...payload,
          ...(status === 'sent' && existingProposal.status !== 'sent' ? { sentAt: new Date().toISOString() } : {})
        });
      } else {
        const res = await addDoc(collection(db, 'proposals'), {
          ...payload,
          createdAt: new Date().toISOString(),
          ...(status === 'sent' ? { sentAt: new Date().toISOString() } : {})
        });
        pId = res.id;
      }

      if (status === 'sent') {
        await updateDoc(doc(db, 'projects', projectId), {
          status: 'proposal_sent'
        });
        
        await addDoc(collection(db, 'notifications'), {
          userId: clientId,
          title: 'Proposal / BOQ Ready',
          body: 'Your project proposal is ready to review.',
          type: 'proposal',
          projectId,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
      
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error saving proposal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="text-xl font-bold">Create Proposal / BOQ</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {/* Quick Add */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-2 self-center">Quick Add:</span>
            {['Planting', 'Irrigation', 'Hardscaping', 'Labor', 'Materials'].map(cat => (
              <Button key={cat} size="sm" variant="outline" onClick={() => handleQuickAdd(cat)}>{cat}</Button>
            ))}
          </div>

          {/* Table */}
          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 font-medium">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 w-24">Qty</th>
                  <th className="px-4 py-3 w-24">Unit</th>
                  <th className="px-4 py-3 w-32">Unit Price</th>
                  <th className="px-4 py-3 w-32">Total</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="p-2">
                      <input type="text" value={item.description} onChange={e => handleUpdateItem(item.id, 'description', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 px-2" placeholder="Item description" />
                    </td>
                    <td className="p-2">
                      <input type="number" value={item.quantity} onChange={e => handleUpdateItem(item.id, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 px-2" />
                    </td>
                    <td className="p-2">
                      <input type="text" value={item.unit} onChange={e => handleUpdateItem(item.id, 'unit', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 px-2" />
                    </td>
                    <td className="p-2">
                      <input type="number" value={item.unitPrice} onChange={e => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 px-2" />
                    </td>
                    <td className="p-2 px-4 font-medium">{item.total.toLocaleString()}</td>
                    <td className="p-2 text-center">
                      <button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={handleAddItem} className="text-primary-600"><Plus className="w-4 h-4 mr-1"/> Add Row</Button>
            </div>
          </div>

          {/* Summary & Notes */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Notes / Terms</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm" placeholder="Scope notes, payment terms..."></textarea>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Valid Until</label>
                <input type="date" value={validUntil.split('T')[0]} onChange={e => setValidUntil(new Date(e.target.value).toISOString())} className="w-full h-10 px-3 rounded-xl border border-input bg-background" />
              </div>
            </div>

            <div className="bg-muted/30 p-6 rounded-xl space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">VAT (%)</span>
                <input type="number" value={vatPercent} onChange={e => setVatPercent(Number(e.target.value))} className="w-20 h-8 px-2 rounded border border-input bg-background text-right" />
              </div>
              <div className="flex justify-between items-center text-sm font-bold border-t border-border pt-4 text-lg">
                <span>Total</span>
                <span>{totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-muted-foreground">Advance (%)</span>
                <input type="number" value={advancePercent} onChange={e => setAdvancePercent(Number(e.target.value))} className="w-20 h-8 px-2 rounded border border-input bg-background text-right" />
              </div>
              <div className="flex justify-between items-center text-sm font-medium text-primary-600">
                <span>Advance Required</span>
                <span>{advanceAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20">
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving}>
            <Save className="w-4 h-4 mr-2"/> Save as Draft
          </Button>
          <Button onClick={() => handleSave('sent')} disabled={saving} className="bg-primary-600 text-white hover:bg-primary-700">
            <Send className="w-4 h-4 mr-2"/> Send to Client
          </Button>
        </div>
      </div>
    </div>
  );
}
