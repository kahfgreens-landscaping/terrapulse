// src/app/admin/ProjectRequestsPage.tsx
import { useState, useEffect } from 'react';
import {
  collection, query, getDocs, doc, updateDoc, addDoc, setDoc, where
} from 'firebase/firestore';
import {
  CheckCircle2, XCircle, Clock, UserCheck, MapPin, Mail, Phone,
  Calendar, AlertCircle, X, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import type { ProjectRequest, User, ProjectPhase } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const DEFAULT_PHASES: Omit<ProjectPhase, 'id'>[] = [
  { name: 'Consultation & Site Survey', status: 'completed', notes: 'Initial site review and client brief confirmed.' },
  { name: '3D Landscape Design & Client Approval', status: 'active', notes: 'Preparing 3D renders and material palette.' },
  { name: 'Permits & Material Procurement', status: 'pending', notes: 'Permit applications and nursery selection.' },
  { name: 'Groundwork & Hardscaping', status: 'pending', notes: 'Earthmoving, irrigation lines, and masonry.' },
  { name: 'Planting & Final Handover', status: 'pending', notes: 'Plant installation, lighting setup, and walkthrough.' },
];

export function ProjectRequestsPage() {
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [pms, setPms] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted' | 'declined'>('pending');

  // Accept & Assign Modal
  const [acceptingReq, setAcceptingReq] = useState<ProjectRequest | null>(null);
  const [selectedPmId, setSelectedPmId] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchPms();
  }, []);

  const fetchPms = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'pm'));
      const snapshot = await getDocs(q);
      const list: User[] = [];
      snapshot.forEach((d) => list.push({ uid: d.id, ...d.data() } as User));
      setPms(list);
      if (list.length > 0) setSelectedPmId(list[0].uid);
    } catch (err) {
      console.error('Error fetching PMs:', err);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'projectRequests'));
      const snapshot = await getDocs(q);
      const reqs: ProjectRequest[] = [];
      snapshot.forEach((d) => {
        reqs.push({ id: d.id, ...d.data() } as ProjectRequest);
      });
      setRequests(reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAcceptModal = (req: ProjectRequest) => {
    setAcceptingReq(req);
  };

  const handleConfirmAccept = async () => {
    if (!acceptingReq) return;
    setProcessing(true);

    try {
      const assignedPm = pms.find((p) => p.uid === selectedPmId);
      const projectRef = doc(collection(db, 'projects'));

      const phases: ProjectPhase[] = DEFAULT_PHASES.map((p, idx) => ({
        ...p,
        id: `phase-${idx + 1}`,
      }));

      // 1. Create real project in Firestore
      await setDoc(projectRef, {
        id: projectRef.id,
        title: acceptingReq.projectTitle,
        description: acceptingReq.description,
        requirements: `Client Request: ${acceptingReq.serviceType} (${acceptingReq.budgetRange}, urgency: ${acceptingReq.urgency}). Details: ${acceptingReq.description}`,
        clientId: acceptingReq.clientId,
        clientName: acceptingReq.clientName,
        clientEmail: acceptingReq.clientEmail,
        clientPhone: acceptingReq.clientPhone || '',
        pmId: assignedPm ? assignedPm.uid : '',
        pmName: assignedPm ? assignedPm.name : '',
        pmEmail: assignedPm ? assignedPm.email : '',
        pmPhone: assignedPm?.phone || '',
        crewIds: [],
        status: 'design',
        phases,
        address: acceptingReq.propertyAddress,
        tags: [acceptingReq.serviceType, acceptingReq.propertyType],
        startDate: new Date().toISOString(),
        estimatedEndDate: new Date(Date.now() + 45 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Update request status
      await updateDoc(doc(db, 'projectRequests', acceptingReq.id), { status: 'accepted' });

      // 3. Notify PM
      if (assignedPm) {
        await addDoc(collection(db, 'notifications'), {
          userId: assignedPm.uid,
          title: `New Project Assigned: ${acceptingReq.projectTitle}`,
          body: `Admin approved "${acceptingReq.projectTitle}" and assigned you as Project Manager. Client: ${acceptingReq.clientName} (${acceptingReq.clientPhone || acceptingReq.clientEmail}).`,
          type: 'project_assigned',
          projectId: projectRef.id,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Notify Client with PM Details
      await addDoc(collection(db, 'notifications'), {
        userId: acceptingReq.clientId,
        title: 'Project Request Approved & Underway! 🎉',
        body: assignedPm
          ? `Your project "${acceptingReq.projectTitle}" is approved! Your dedicated Project Manager is ${assignedPm.name} (${assignedPm.phone || assignedPm.email}). Check your Projects tab to view progress.`
          : `Your project "${acceptingReq.projectTitle}" has been approved! Check your Projects tab to track progress.`,
        type: 'project_assigned',
        projectId: projectRef.id,
        read: false,
        createdAt: new Date().toISOString(),
      });

      setAcceptingReq(null);
      fetchRequests();
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async (req: ProjectRequest) => {
    if (!window.confirm(`Decline project request for "${req.projectTitle}"?`)) return;
    try {
      await updateDoc(doc(db, 'projectRequests', req.id), { status: 'declined' });

      await addDoc(collection(db, 'notifications'), {
        userId: req.clientId,
        title: 'Project Request Update',
        body: `Regarding your request "${req.projectTitle}": Our team is currently at full capacity for this scope. We will reach out when a slot opens up.`,
        type: 'system',
        read: false,
        createdAt: new Date().toISOString(),
      });

      fetchRequests();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredRequests = requests.filter((r) => r.status === activeTab);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading project requests...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Client Project Requests</h1>
          <p className="text-muted-foreground mt-1">Review inquiries, assign Project Managers, and approve projects into active workflow.</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-border pb-2">
        {(['pending', 'accepted', 'declined'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize font-medium transition-all ${
              activeTab === tab
                ? 'text-primary-600 border-b-2 border-primary-600 font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab} ({requests.filter((r) => r.status === tab).length})
          </button>
        ))}
      </div>

      <div className="grid gap-6">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed border-border p-8">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30 text-primary-600" />
            <p className="font-semibold text-foreground">No {activeTab} requests found</p>
            <p className="text-xs text-muted-foreground mt-1">
              New client submissions during registration or onboarding will show up here.
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => (
            <Card key={req.id} className="overflow-hidden border border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border bg-muted/20">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <CardTitle className="text-xl">{req.projectTitle}</CardTitle>
                      {req.status === 'pending' && (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending Review
                        </Badge>
                      )}
                      {req.status === 'accepted' && (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Approved & Active
                        </Badge>
                      )}
                      {req.status === 'declined' && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Declined
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted on {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleOpenAcceptModal(req)}
                        className="bg-primary-600 hover:bg-primary-700 text-white shadow-sm"
                      >
                        <UserCheck className="w-4 h-4 mr-1.5" />
                        Approve & Assign PM
                      </Button>
                      <Button
                        onClick={() => handleDecline(req)}
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  {/* Client info */}
                  <div className="p-3 bg-muted/40 rounded-xl space-y-2 text-sm">
                    <div className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">
                      Client Contact Info
                    </div>
                    <div className="font-medium text-foreground">{req.clientName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{req.clientEmail}</span>
                    </div>
                    {req.clientPhone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{req.clientPhone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{req.propertyAddress} ({req.propertyType})</span>
                    </div>
                  </div>

                  {/* Scope & Budget info */}
                  <div className="p-3 bg-muted/40 rounded-xl space-y-2 text-sm">
                    <div className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">
                      Request Scope & Budget
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Service Type:</span>
                      <span className="font-medium">{req.serviceType}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Estimated Budget:</span>
                      <span className="font-semibold text-primary-600">{req.budgetRange}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Desired Timeline:</span>
                      <Badge variant="outline" className="text-[11px] capitalize">{req.urgency}</Badge>
                    </div>
                  </div>
                </div>

                {req.description && (
                  <div className="p-3 rounded-xl bg-background border border-border text-sm">
                    <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                      Client Project Brief
                    </div>
                    <p className="text-foreground leading-relaxed text-xs">{req.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Accept & Assign PM Modal */}
      <AnimatePresence>
        {acceptingReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold">Approve & Assign PM</h3>
                </div>
                <button
                  onClick={() => setAcceptingReq(null)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="text-sm font-semibold">{acceptingReq.projectTitle}</p>
                  <p className="text-xs text-muted-foreground">{acceptingReq.clientName} • {acceptingReq.propertyAddress}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1.5">
                    Assign Project Manager *
                  </label>
                  {pms.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
                      No Project Managers created yet. You can create one under "Create PM" in the sidebar, or approve now and assign later.
                    </div>
                  ) : (
                    <select
                      value={selectedPmId}
                      onChange={(e) => setSelectedPmId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary-500 font-medium"
                    >
                      {pms.map((pm) => (
                        <option key={pm.uid} value={pm.uid}>
                          {pm.name} ({pm.email})
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Both the Project Manager and Client will receive immediate in-app notifications with contact details.
                  </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setAcceptingReq(null)}
                    disabled={processing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white"
                    onClick={handleConfirmAccept}
                    disabled={processing}
                  >
                    {processing ? 'Approving...' : 'Confirm & Launch Project'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
