// src/components/projects/ProposalTabContent.tsx
import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, AlertCircle, RefreshCw, Upload, Check, X } from 'lucide-react';
import { updateDoc, doc, collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Project, Proposal, PaymentProof } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ProposalTabContentProps {
  project: Project;
  proposals: Proposal[];
  paymentProofs: PaymentProof[];
  onOpenBOQModal: () => void;
}

export function ProposalTabContent({ project, proposals, paymentProofs, onOpenBOQModal }: ProposalTabContentProps) {
  const { user } = useAuth();
  const proposal = proposals[0];
  const advancePaymentProof = paymentProofs.find(p => p.paymentType === 'advance');
  
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isRequestingRevision, setIsRequestingRevision] = useState(false);
  const [isUploadingPayment, setIsUploadingPayment] = useState(false);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectingPayment, setRejectingPayment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!proposal && user?.role === 'client') {
    return (
      <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed border-border p-8">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-primary-600" />
        <p className="font-semibold text-foreground text-sm">Proposal not yet ready</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Your project manager is currently preparing your BOQ and proposal. You will be notified when it is ready for review.
        </p>
      </div>
    );
  }

  if (!proposal && user?.role === 'admin') {
    return (
      <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed border-border p-8">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-primary-600" />
        <p className="font-semibold text-foreground text-sm">No Proposal Found</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
          Create a detailed BOQ and proposal for the client to review.
        </p>
        <Button onClick={onOpenBOQModal}>Create BOQ/Proposal</Button>
      </div>
    );
  }

  const handleClientAction = async (action: 'accepted' | 'revision_requested') => {
    if (action === 'revision_requested' && !revisionNotes.trim()) {
      return alert('Please provide details for the revision request.');
    }
    try {
      await updateDoc(doc(db, 'proposals', proposal.id), {
        status: action,
        ...(action === 'revision_requested' ? { revisionNotes, revisionCount: proposal.revisionCount + 1 } : {}),
        respondedAt: new Date().toISOString()
      });

      if (action === 'accepted') {
        await updateDoc(doc(db, 'projects', project.id), { status: 'awaiting_payment' });
      }

      await addDoc(collection(db, 'notifications'), {
        userId: project.pmId || '', // Send to PM or Admin
        title: `Proposal ${action === 'accepted' ? 'Accepted' : 'Revision Requested'}`,
        body: `Client has ${action === 'accepted' ? 'accepted the proposal' : 'requested a revision'} for ${project.title}.`,
        type: 'proposal',
        projectId: project.id,
        read: false,
        createdAt: new Date().toISOString()
      });

      setIsRequestingRevision(false);
      setRevisionNotes('');
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    }
  };

  const handleUploadPayment = async () => {
    if (!paymentFile) return;
    setIsUploadingPayment(true);
    try {
      const filename = `payments/${uuidv4()}_${paymentFile.name}`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, paymentFile);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'paymentProofs'), {
        projectId: project.id,
        proposalId: proposal.id,
        clientId: user?.uid,
        amount: proposal.advanceAmount,
        paymentType: 'advance',
        proofUrl: url,
        proofFileName: paymentFile.name,
        status: 'pending_review',
        createdAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: project.pmId || '', // notify admin/pm
        title: 'Payment Proof Uploaded',
        body: `Client uploaded payment proof for ${project.title}.`,
        type: 'payment',
        projectId: project.id,
        read: false,
        createdAt: new Date().toISOString()
      });
      
      setPaymentFile(null);
    } catch (err) {
      console.error(err);
      alert('Error uploading payment proof');
    } finally {
      setIsUploadingPayment(false);
    }
  };

  const handleReviewPayment = async (status: 'confirmed' | 'rejected') => {
    if (!advancePaymentProof) return;
    if (status === 'rejected' && !adminNotes.trim()) {
      return alert('Please provide a reason for rejection.');
    }
    try {
      await updateDoc(doc(db, 'paymentProofs', advancePaymentProof.id), {
        status,
        ...(status === 'rejected' ? { adminNotes } : {}),
        ...(status === 'confirmed' ? { confirmedAt: new Date().toISOString(), confirmedBy: user?.uid } : {})
      });

      if (status === 'confirmed') {
        await updateDoc(doc(db, 'projects', project.id), { status: 'mobilization' });
      }

      await addDoc(collection(db, 'notifications'), {
        userId: project.clientId,
        title: `Payment ${status === 'confirmed' ? 'Confirmed' : 'Rejected'}`,
        body: status === 'confirmed' ? 'Your payment has been confirmed! Project enters mobilization.' : `Payment proof rejected: ${adminNotes}`,
        type: 'payment',
        projectId: project.id,
        read: false,
        createdAt: new Date().toISOString()
      });

      setRejectingPayment(false);
      setAdminNotes('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Project Proposal & BOQ
              <Badge variant={proposal.status === 'accepted' ? 'success' : proposal.status === 'draft' ? 'secondary' : 'warning'}>
                {proposal.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </CardTitle>
          </div>
          {user?.role === 'admin' && (
            <div className="flex gap-2">
              {(proposal.status === 'draft' || proposal.status === 'revision_requested' || proposal.status === 'sent') && (
                <Button variant="outline" size="sm" onClick={onOpenBOQModal}>Edit BOQ</Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {proposal.status === 'revision_requested' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="font-bold mb-1 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Client Revision Notes:</div>
              <div className="text-sm">{proposal.revisionNotes}</div>
            </div>
          )}

          {proposal.status === 'accepted' && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div className="font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Client accepted this proposal on {new Date(proposal.respondedAt || '').toLocaleDateString()}</div>
            </div>
          )}

          {/* Table */}
          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 font-medium">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proposal.items.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{item.unit}</td>
                    <td className="px-4 py-3">{item.unitPrice.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-8 justify-between">
            <div className="flex-1 min-w-[300px]">
              <div className="font-bold mb-2">Terms & Notes</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{proposal.notes || 'No specific terms provided.'}</div>
            </div>
            <div className="bg-muted/30 p-6 rounded-xl space-y-3 min-w-[300px]">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{proposal.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT ({proposal.vatPercent}%)</span>
                <span>{proposal.vatAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border pt-3 text-lg">
                <span>Total Amount</span>
                <span>{proposal.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-primary-600 pt-2">
                <span>Advance Required ({proposal.advancePercent}%)</span>
                <span>{proposal.advanceAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Client Action Buttons */}
          {user?.role === 'client' && (proposal.status === 'sent' || proposal.status === 'revision_requested') && (
            <div className="border-t border-border pt-6 mt-6">
              {!isRequestingRevision ? (
                <div className="flex gap-4">
                  <Button onClick={() => setIsRequestingRevision(true)} variant="outline" className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2"/> Request Revision
                  </Button>
                  <Button onClick={() => handleClientAction('accepted')} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white">
                    <CheckCircle2 className="w-4 h-4 mr-2"/> Accept Proposal
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-bold">Request Revision</h4>
                  <textarea 
                    value={revisionNotes} 
                    onChange={e => setRevisionNotes(e.target.value)} 
                    className="w-full p-3 rounded-xl border border-input text-sm" 
                    rows={4} 
                    placeholder="Describe what changes you would like..."
                  />
                  <div className="flex gap-3">
                    <Button onClick={() => setIsRequestingRevision(false)} variant="outline">Cancel</Button>
                    <Button onClick={() => handleClientAction('revision_requested')} className="bg-primary-600 text-white">Submit Request</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Proof Section for Client */}
      {proposal.status === 'accepted' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advance Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!advancePaymentProof && user?.role === 'client' && (
              <div className="p-6 bg-muted/20 border border-border rounded-xl">
                <div className="text-center mb-6">
                  <h4 className="font-bold text-lg text-primary-600 mb-2">Advance Amount: AED {proposal.advanceAmount.toLocaleString()}</h4>
                  <p className="text-sm text-muted-foreground">Please transfer the advance payment to our bank account:</p>
                  <div className="mt-4 inline-block text-left bg-background p-4 rounded-lg border border-border text-sm">
                    <div><span className="text-muted-foreground">Bank:</span> Emirates NBD</div>
                    <div><span className="text-muted-foreground">IBAN:</span> AE07 0331 2345 6789 0123 456</div>
                    <div><span className="text-muted-foreground">Ref:</span> {project.title.substring(0, 15).toUpperCase()}</div>
                  </div>
                </div>
                
                <div className="flex flex-col items-center gap-4">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={e => setPaymentFile(e.target.files?.[0] || null)} />
                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2"/> Select File
                    </Button>
                    {paymentFile && (
                      <Button onClick={handleUploadPayment} disabled={isUploadingPayment} className="bg-primary-600 text-white">
                        {isUploadingPayment ? 'Uploading...' : 'Submit Payment Proof'}
                      </Button>
                    )}
                  </div>
                  {paymentFile && <p className="text-sm text-muted-foreground">Selected: {paymentFile.name}</p>}
                </div>
              </div>
            )}

            {advancePaymentProof && advancePaymentProof.status === 'pending_review' && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 rounded-xl border border-amber-200 flex justify-between items-center">
                <div>
                  <div className="font-bold flex items-center gap-2"><Clock className="w-5 h-5"/> Awaiting Admin Confirmation</div>
                  <div className="text-sm mt-1">Payment proof submitted. We will review it within 24 hours.</div>
                </div>
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <a href={advancePaymentProof.proofUrl} target="_blank" rel="noreferrer" className="text-sm underline mr-4 self-center">View Proof</a>
                    {!rejectingPayment ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setRejectingPayment(true)}>Reject</Button>
                        <Button size="sm" className="bg-primary-600 text-white" onClick={() => handleReviewPayment('confirmed')}>Confirm</Button>
                      </>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <input type="text" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Reason for rejection" className="h-8 px-2 rounded border text-sm w-48 text-black" />
                        <Button size="sm" onClick={() => handleReviewPayment('rejected')} className="bg-red-600 text-white hover:bg-red-700">Submit</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejectingPayment(false)}><X className="w-4 h-4"/></Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {advancePaymentProof && advancePaymentProof.status === 'confirmed' && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200 rounded-xl border border-emerald-200">
                <div className="font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Payment Confirmed!</div>
                <div className="text-sm mt-1">Advance payment of AED {advancePaymentProof.amount.toLocaleString()} was confirmed. Project is now in Mobilization phase.</div>
              </div>
            )}
            
            {advancePaymentProof && advancePaymentProof.status === 'rejected' && user?.role === 'client' && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200 rounded-xl border border-red-200 space-y-4">
                <div className="font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5"/> Payment Proof Rejected</div>
                <div className="text-sm">Reason: {advancePaymentProof.adminNotes}</div>
                <div className="flex gap-4 items-center pt-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={e => setPaymentFile(e.target.files?.[0] || null)} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2"/> Select New File
                  </Button>
                  {paymentFile && (
                    <Button size="sm" onClick={handleUploadPayment} disabled={isUploadingPayment} className="bg-primary-600 text-white">
                      {isUploadingPayment ? 'Uploading...' : 'Resubmit Proof'}
                    </Button>
                  )}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}
    </div>
  );
}
