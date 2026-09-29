// src/components/projects/CreateProjectModal.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderPlus, Check, Wallet, MapPin, UserCheck, Image as ImageIcon, Calendar } from 'lucide-react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useCurrencyStore } from '@/store/currency.store';
import { DirhamSymbol } from '@/components/ui/DirhamSymbol';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProjectStatus, ProjectPhase, User } from '@/types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const PRESET_COVERS = [
  {
    name: 'Modern Patio',
    url: 'https://images.unsplash.com/photo-1584463699026-643c7b3992ea?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Lush Lawn',
    url: 'https://images.unsplash.com/photo-1558904541-efa8c4a08931?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Retaining Wall',
    url: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Garden Pergola',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80',
  },
];

const DEFAULT_PHASES: Omit<ProjectPhase, 'id'>[] = [
  { name: 'Consultation & Site Survey', status: 'completed', notes: 'Initial site walkthrough completed.' },
  { name: '3D Design & Client Approval', status: 'active', notes: 'Reviewing 3D render mockups.' },
  { name: 'Permits & Material Procurement', status: 'pending', notes: 'Sourcing pavers and nursery stock.' },
  { name: 'Groundwork & Hardscaping', status: 'pending', notes: 'Excavation, grading, and patio build.' },
  { name: 'Planting & Final Handover', status: 'pending', notes: 'Trees, turf installation, and walkthrough.' },
];

export function CreateProjectModal({ isOpen, onClose, onCreated }: CreateProjectModalProps) {
  const { user } = useAuth();
  const { currency } = useCurrencyStore();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState(user?.propertyAddress || '');
  const [budget, setBudget] = useState('55000');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [coverPhoto, setCoverPhoto] = useState(PRESET_COVERS[0].url);
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [selectedPmId, setSelectedPmId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(false);

  const [pms, setPms] = useState<User[]>([]);
  const [clients, setClients] = useState<User[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchTeam = async () => {
        try {
          const pmSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'pm')));
          const pmList: User[] = [];
          pmSnap.forEach((d) => pmList.push({ uid: d.id, ...d.data() } as User));
          setPms(pmList);

          const clientSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'client')));
          const clientList: User[] = [];
          clientSnap.forEach((d) => clientList.push({ uid: d.id, ...d.data() } as User));
          setClients(clientList);

          // Default client
          if (user?.role === 'client') {
            setSelectedClientId(user.uid);
          } else if (clientList.length > 0) {
            setSelectedClientId(clientList[0].uid);
          }
        } catch (err) {
          console.error('Error fetching team:', err);
        }
      };
      fetchTeam();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setLoading(true);
    try {
      const phases: ProjectPhase[] = DEFAULT_PHASES.map((p, idx) => ({
        ...p,
        id: `phase-${idx + 1}`,
      }));

      const assignedPm = pms.find((p) => p.uid === selectedPmId);
      const assignedClient = clients.find((c) => c.uid === selectedClientId) || (user.role === 'client' ? user : undefined);

      const targetClientId = selectedClientId || user.uid;
      const targetPmId = selectedPmId || (user.role === 'pm' ? user.uid : '');

      const newProjectData = {
        title: title.trim(),
        address: address.trim() || 'Client Property',
        budget: Number(budget) || 0,
        description: description.trim(),
        requirements: requirements.trim(),
        coverPhoto,
        status,
        phases,
        clientId: targetClientId,
        clientName: assignedClient?.name || (user.role === 'client' ? user.name : 'Client'),
        clientEmail: assignedClient?.email || (user.role === 'client' ? user.email : ''),
        clientPhone: assignedClient?.phone || user?.phone || '',
        pmId: targetPmId,
        pmName: assignedPm ? assignedPm.name : '',
        pmEmail: assignedPm ? assignedPm.email : '',
        pmPhone: assignedPm?.phone || '',
        crewIds: [],
        tags: ['Hardscaping', 'Landscaping', 'Residential'],
        startDate: new Date().toISOString(),
        estimatedEndDate: new Date(Date.now() + 45 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'projects'), newProjectData);

      // Notify PM if assigned
      if (targetPmId) {
        await addDoc(collection(db, 'notifications'), {
          userId: targetPmId,
          title: `New Project Assigned: ${title.trim()}`,
          body: `You have been assigned as Project Manager for "${title.trim()}". Client: ${assignedClient?.name || 'Assigned Client'}.`,
          type: 'project_assigned',
          projectId: docRef.id,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Notify Client
      if (targetClientId && targetClientId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: targetClientId,
          title: `Project Setup: ${title.trim()}`,
          body: assignedPm
            ? `Your project "${title.trim()}" is underway. Your Project Manager is ${assignedPm.name} (${assignedPm.phone || assignedPm.email}).`
            : `Your project "${title.trim()}" has been created and our team is preparing the initial survey.`,
          type: 'project_assigned',
          projectId: docRef.id,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      onCreated?.();
      onClose();
      setTitle('');
      setDescription('');
      setRequirements('');
    } catch (err) {
      console.error('Error creating project:', err);
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
          className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6 relative overflow-hidden my-8 max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold">Create New Project</h2>
                <p className="text-xs text-muted-foreground">Setup landscape contract, requirements & assign PM</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4 pt-4 overflow-y-auto pr-1 flex-1">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Project Title *
              </label>
              <Input
                placeholder="e.g. Modern Backyard Oasis & Pool Deck"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Address & Budget */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  Property Address
                </label>
                <div className="relative">
                  <Input
                    placeholder="e.g. Palm Jumeirah Villa 8"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 mb-1">
                  <span>Est. Budget ({currency})</span>
                  {currency === 'AED' && <DirhamSymbol className="w-3.5 h-3.5 text-primary-600 inline" />}
                </label>
                <Input
                  type="number"
                  placeholder={currency === 'AED' ? '55000' : '15000'}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
            </div>

            {/* Team Assignment (for Admin) */}
            {user?.role === 'admin' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-primary-600" />
                    Project Manager
                  </label>
                  <select
                    value={selectedPmId}
                    onChange={(e) => setSelectedPmId(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-input bg-background text-xs"
                  >
                    <option value="">-- Assign PM --</option>
                    {pms.map((pm) => (
                      <option key={pm.uid} value={pm.uid}>
                        {pm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    Client Account
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-input bg-background text-xs"
                  >
                    <option value="">-- Select Client --</option>
                    {clients.map((c) => (
                      <option key={c.uid} value={c.uid}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Initial Workflow Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="inquiry">Inquiry</option>
                <option value="design">Design Phase</option>
                <option value="approval">Awaiting Approval</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Requirements & Specifications */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Project Requirements & Specifications
              </label>
              <textarea
                placeholder="e.g. Natural turf installation, automatic drip irrigation, gazebo pergola, outdoor uplighting..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                General Scope & Internal Notes
              </label>
              <textarea
                placeholder="Describe hardscaping, timeline, access instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            {/* Cover photo selector */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1.5">
                Choose Cover Photo
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_COVERS.map((preset) => (
                  <button
                    type="button"
                    key={preset.name}
                    onClick={() => setCoverPhoto(preset.url)}
                    className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all ${
                      coverPhoto === preset.url
                        ? 'border-primary-600 ring-2 ring-primary-200'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    {coverPhoto === preset.url && (
                      <div className="absolute inset-0 bg-primary-600/30 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border flex-shrink-0">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !title.trim()}>
                {loading ? 'Creating...' : 'Create & Assign Project'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
