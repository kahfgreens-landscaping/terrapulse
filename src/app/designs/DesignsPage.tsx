// src/app/designs/DesignsPage.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  doc, updateDoc, serverTimestamp, where, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, RefreshCw, ChevronDown, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, statusColor, statusLabel } from '@/lib/utils';
import type { Design } from '@/types';

export function DesignsPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const projectFilter = params.get('project');
  const [viewImg, setViewImg] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const constraints = projectFilter
    ? [where('projectId', '==', projectFilter), orderBy('uploadedAt', 'desc')]
    : [orderBy('uploadedAt', 'desc')];

  const { data: designs } = useCollection<Design>('designs', ...constraints);

  const updateStatus = async (designId: string, status: Design['status'], note?: string) => {
    setLoading(designId);
    try {
      await updateDoc(doc(db, 'designs', designId), {
        status,
        reviewedBy: user?.uid,
        reviewedAt: serverTimestamp(),
        ...(note ? { clientNote: note } : {}),
      });
    } finally {
      setLoading(null);
    }
  };

  const pendingDesigns = designs.filter((d) => d.status === 'pending');
  const reviewedDesigns = designs.filter((d) => d.status !== 'pending');

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Design Approvals</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and approve your landscape design mockups
        </p>
      </div>

      {/* Pending approvals */}
      {pendingDesigns.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Awaiting Your Approval</h2>
            <Badge variant="warning">{pendingDesigns.length}</Badge>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {pendingDesigns.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                onApprove={() => updateStatus(design.id, 'approved')}
                onReject={() => updateStatus(design.id, 'rejected')}
                onChanges={() => updateStatus(design.id, 'changes_requested', 'Please make the requested changes.')}
                onView={() => setViewImg(design.imageUrl)}
                isLoading={loading === design.id}
                isClient={user?.role === 'client'}
              />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {reviewedDesigns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Design History</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {reviewedDesigns.map((design) => (
              <Card key={design.id} className="overflow-hidden card-hover">
                <div
                  className="h-40 bg-muted cursor-pointer relative group"
                  onClick={() => setViewImg(design.imageUrl)}
                >
                  <img src={design.imageUrl} alt={design.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                </div>
                <CardContent className="pt-3 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{design.title}</p>
                      <p className="text-xs text-muted-foreground">v{design.version} · {formatDate(design.uploadedAt)}</p>
                    </div>
                    <span className={`status-badge text-xs ${statusColor(design.status)}`}>
                      {statusLabel(design.status)}
                    </span>
                  </div>
                  {design.clientNote && (
                    <p className="text-xs text-muted-foreground mt-2 bg-muted rounded-lg px-2 py-1.5">
                      "{design.clientNote}"
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {designs.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="w-7 h-7 text-purple-500" />
          </div>
          <p className="font-medium">No designs yet</p>
          <p className="text-sm mt-1">Your project manager will upload design mockups here for your review.</p>
        </div>
      )}

      {/* Lightbox */}
      {viewImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewImg(null)}
        >
          <img
            src={viewImg}
            alt="Design mockup"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setViewImg(null)}
          >
            <XCircle className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
}

interface DesignCardProps {
  design: Design;
  onApprove: () => void;
  onReject: () => void;
  onChanges: () => void;
  onView: () => void;
  isLoading: boolean;
  isClient: boolean;
}

function DesignCard({ design, onApprove, onReject, onChanges, onView, isLoading, isClient }: DesignCardProps) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <Card className="overflow-hidden border-2 border-accent/30 shadow-card-hover">
        <div
          className="h-52 bg-muted cursor-pointer relative group"
          onClick={onView}
        >
          <img src={design.imageUrl} alt={design.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Eye className="w-7 h-7 text-white" />
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="warning" className="text-xs shadow">Awaiting Approval</Badge>
          </div>
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{design.title}</CardTitle>
            <span className="text-xs text-muted-foreground">v{design.version}</span>
          </div>
          <p className="text-xs text-muted-foreground">Uploaded {formatDate(design.uploadedAt)}</p>
        </CardHeader>
        {isClient && (
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={onApprove}
                disabled={isLoading}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onChanges}
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Changes
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={onReject}
                disabled={isLoading}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
