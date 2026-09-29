// src/components/projects/EditProjectModal.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Edit3, Trash2, CheckCircle2, UserCheck, Wallet, MapPin,
  Calendar, FileText, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { doc, updateDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useCurrencyStore } from '@/store/currency.store';
import { DirhamSymbol } from '@/components/ui/DirhamSymbol';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Project, ProjectStatus, User } from '@/types';

interface EditProjectModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditProjectModal({ project, isOpen, onClose, onUpdated }: EditProjectModalProps) {
  const { user } = useAuth();
  const { currency } = useCurrencyStore();

  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [budget, setBudget] = useState('0');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [pmId, setPmId] = useState('');
  const [clientId, setClientId] = useState('');
  const [estimatedEndDate, setEstimatedEndDate] = useState('');

  const [pms, setPms] = useState<User[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load existing values when project opens
  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setAddress(project.address || '');
      setBudget(String(project.budget || 0));
      setDescription(project.description || '');
      setRequirements(project.requirements || '');
      setStatus(project.status || 'in_progress');
      setPmId(project.pmId || '');
      setClientId(project.clientId || '');
      setEstimatedEndDate(
        project.estimatedEndDate ? project.estimatedEndDate.slice(0, 10) : ''
      );
      setConfirmDelete(false);
    }
  }, [project]);

  // Fetch available PMs and Clients
  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const pmSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'pm')));
          const pmList: User[] = [];
          pmSnap.forEach((d) => pmList.push({ uid: d.id, ...d.data() } as User));
          setPms(pmList);

          const clientSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'client')));
          const clientList: User[] = [];
          clientSnap.forEach((d) => clientList.push({ uid: d.id, ...d.data() } as User));
          setClients(clientList);
        } catch (err) {
          console.error('Error fetching users:', err);
        }
      };
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen || !project) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !project) return;

    setLoading(true);
    try {
      const assignedPm = pms.find((p) => p.uid === pmId);
      const assignedClient = clients.find((c) => c.uid === clientId);

      const pmChanged = pmId && pmId !== project.pmId;

      const updateData: Partial<Project> = {
        title: title.trim(),
        address: address.trim(),
        budget: Number(budget) || 0,
        description: description.trim(),
        requirements: requirements.trim(),
        status,
        pmId: pmId || project.pmId,
        pmName: assignedPm ? assignedPm.name : project.pmName,
        pmEmail: assignedPm ? assignedPm.email : project.pmEmail,
        pmPhone: assignedPm?.phone || project.pmPhone,
        clientId: clientId || project.clientId,
        clientName: assignedClient ? assignedClient.name : project.clientName,
        clientEmail: assignedClient ? assignedClient.email : project.clientEmail,
        clientPhone: assignedClient?.phone || project.clientPhone,
        estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate).toISOString() : project.estimatedEndDate,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'projects', project.id), updateData);

      // If PM changed, send notifications
      if (pmChanged && assignedPm) {
        // Notify PM
        await addDoc(collection(db, 'notifications'), {
          userId: assignedPm.uid,
          title: `Assigned as Project Manager: ${title.trim()}`,
          body: `You have been assigned to lead "${title.trim()}". Client: ${assignedClient?.name || project.clientName || 'Client'}.`,
          type: 'project_assigned',
          projectId: project.id,
          read: false,
          createdAt: new Date().toISOString(),
        });

        // Notify Client
        const targetClientId = clientId || project.clientId;
        if (targetClientId) {
          await addDoc(collection(db, 'notifications'), {
            userId: targetClientId,
            title: `Project Manager Assigned: ${assignedPm.name}`,
            body: `${assignedPm.name} (${assignedPm.phone || assignedPm.email}) has been assigned as the Project Manager for "${title.trim()}".`,
            type: 'project_assigned',
            projectId: project.id,
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      }

      onUpdated?.();
      onClose();
    } catch (err) {
      console.error('Error updating project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!project) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        deleted: true,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      onUpdated?.();
      onClose();
    } catch (err) {
      console.error('Error soft-deleting project:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl p-6 relative overflow-hidden my-8 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold">Edit Project & Specs</h2>
                <p className="text-xs text-muted-foreground">Modify requirements, pricing, assigned PM & status</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4 pt-4 overflow-y-auto pr-1 flex-1">
            {/* Title & Status */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  Project Title *
                </label>
                <Input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Al Barari Villa Oasis"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  Workflow Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary-500 font-medium"
                >
                  <option value="inquiry">Inquiry</option>
                  <option value="design">Design Phase</option>
                  <option value="approval">Awaiting Client Approval</option>
                  <option value="scheduled">Scheduled for Groundwork</option>
                  <option value="in_progress">In Progress (Active Site)</option>
                  <option value="completed">Completed & Handed Over</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            </div>

            {/* Address & Pricing/Budget */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  Site Address / Location
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    className="pl-9"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Palm Jumeirah Frond M, Villa 12"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  Budget / Contract Value ({currency})
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-2.5 text-muted-foreground">
                    {currency === 'AED' ? (
                      <DirhamSymbol className="w-4 h-4 text-primary-600" />
                    ) : (
                      <Wallet className="w-4 h-4 text-primary-600" />
                    )}
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="500"
                    className="pl-9"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 85000"
                  />
                </div>
              </div>
            </div>

            {/* PM & Client Assignment */}
            <div className="grid md:grid-cols-2 gap-4 bg-muted/40 p-3.5 rounded-xl border border-border">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-primary-600" />
                  Assigned Project Manager
                </label>
                <select
                  value={pmId}
                  onChange={(e) => setPmId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Select Project Manager --</option>
                  {pms.map((pm) => (
                    <option key={pm.uid} value={pm.uid}>
                      {pm.name} ({pm.email})
                    </option>
                  ))}
                  {/* Keep current PM if not in list */}
                  {project.pmName && !pms.some((p) => p.uid === project.pmId) && (
                    <option value={project.pmId}>{project.pmName} (Current PM)</option>
                  )}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Assigning will notify the PM and client automatically.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Assigned Client
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Select Client --</option>
                  {clients.map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                  {project.clientName && !clients.some((c) => c.uid === project.clientId) && (
                    <option value={project.clientId}>{project.clientName} (Current Client)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Target End Date */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Estimated Completion Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <Input
                  type="date"
                  className="pl-9"
                  value={estimatedEndDate}
                  onChange={(e) => setEstimatedEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Project Requirements & Scope */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Project Requirements & Specifications
              </label>
              <textarea
                rows={3}
                className="w-full p-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Specific client requirements: e.g. Natural stone pavers, smart drip irrigation, olive trees, pergola with louvers, ambient LED lighting."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
            </div>

            {/* General Description */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                General Scope & Internal Notes
              </label>
              <textarea
                rows={2}
                className="w-full p-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Overview description or handover notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Soft Delete Zone */}
            <div className="pt-4 border-t border-border mt-4">
              {!confirmDelete ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Archive or Delete Project</h4>
                    <p className="text-xs text-muted-foreground">
                      Deleted projects are moved to the "Deleted" tab in history and can be restored.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete Project
                  </Button>
                </div>
              ) : (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Confirm moving this project to the Deleted tab?</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleSoftDelete}
                      disabled={loading}
                    >
                      Yes, Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-2 pt-4 border-t border-border flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Saving Changes...' : 'Save & Update Project'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
