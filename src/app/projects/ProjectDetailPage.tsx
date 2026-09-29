// src/app/projects/ProjectDetailPage.tsx
import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Calendar, User, ChevronLeft, CheckCircle2,
  Clock, Circle, MessageCircle, Palette, Camera, Check, Wallet,
  Edit3, UserCheck, Plus, Send, Paperclip, Image as ImageIcon,
  FileText, Sparkles, AlertCircle, Phone, Mail, ChevronRight,
  ExternalLink, Upload, Trash2, X, Download
} from 'lucide-react';
import {
  doc, updateDoc, collection, addDoc, serverTimestamp,
  query, where, orderBy, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useDocument, useCollection } from '@/hooks/useFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  formatDate, formatRelative, statusColor, statusLabel, getProjectProgress, getInitials, cn,
} from '@/lib/utils';
import type {
  Project, ProjectStatus, ProjectPhase, ProjectPhoto,
  Message, Design, Invoice, Document as DocType, PhotoType, User as UserType
} from '@/types';
import { EditProjectModal } from '@/components/projects/EditProjectModal';
import { v4 as uuidv4 } from 'uuid';

type TabKey = 'timeline' | 'gallery' | 'messages' | 'designs' | 'documents';

// Helper image compressor
function compressImage(file: File, maxWidth = 1600, quality = 0.85): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = elem.toDataURL('image/jpeg', quality);
        elem.toBlob(
          (blob) => (blob ? resolve({ blob, dataUrl }) : reject(new Error('Canvas toBlob failed'))),
          'image/jpeg',
          quality
        );
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: project, loading } = useDocument<Project>(`projects/${id}`);

  const [activeTab, setActiveTab] = useState<TabKey>('timeline');
  const [updating, setUpdating] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // PM and Client loaded details
  const [pmUser, setPmUser] = useState<UserType | null>(null);
  const [clientUser, setClientUser] = useState<UserType | null>(null);

  // In-Project Photos query
  const { data: projectPhotos } = useCollection<ProjectPhoto>(
    'photos',
    where('projectId', '==', id ?? ''),
    orderBy('takenAt', 'desc')
  );

  // In-Project Messages query
  const { data: messages } = useCollection<Message>(
    id ? `projects/${id}/messages` : '',
    orderBy('createdAt', 'asc')
  );

  // In-Project Designs query
  const { data: designs } = useCollection<Design>(
    'designs',
    where('projectId', '==', id ?? '')
  );

  // In-Project Invoices query
  const { data: invoices } = useCollection<Invoice>(
    'invoices',
    where('projectId', '==', id ?? '')
  );

  // Fetch full PM & Client user documents when project loads
  useEffect(() => {
    if (!project) return;

    if (project.pmId) {
      getDoc(doc(db, 'users', project.pmId)).then((snap) => {
        if (snap.exists()) setPmUser({ uid: snap.id, ...snap.data() } as UserType);
      }).catch(console.warn);
    }

    if (project.clientId) {
      getDoc(doc(db, 'users', project.clientId)).then((snap) => {
        if (snap.exists()) setClientUser({ uid: snap.id, ...snap.data() } as UserType);
      }).catch(console.warn);
    }
  }, [project?.pmId, project?.clientId]);

  // Photo upload states
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoStage, setPhotoStage] = useState<PhotoType>('during');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoFilter, setPhotoFilter] = useState<'all' | 'before' | 'during' | 'after'>('all');

  // In-Project Messaging states
  const [msgText, setMsgText] = useState('');
  const [msgCategory, setMsgCategory] = useState<'general' | 'idea' | 'modification' | 'update'>('general');
  const [msgSending, setMsgSending] = useState(false);
  const [msgAttachment, setMsgAttachment] = useState<string | null>(null);
  const msgAttachmentInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'messages') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!id) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'projects', id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const handlePhaseStatusChange = async (phaseId: string, newPhaseStatus: ProjectPhase['status']) => {
    if (!project || !id) return;
    setUpdating(true);
    try {
      const updatedPhases = project.phases.map((p) =>
        p.id === phaseId ? { ...p, status: newPhaseStatus } : p
      );
      await updateDoc(doc(db, 'projects', id), {
        phases: updatedPhases,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  // In-Project Photo Handler
  const handleSelectPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setIsPhotoModalOpen(true);
    e.target.value = '';
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile || !user || !id) return;
    setPhotoUploading(true);

    try {
      const { blob, dataUrl } = await compressImage(photoFile, 1600, 0.85);
      let finalUrl = dataUrl;

      try {
        const filename = `photos/${uuidv4()}.jpg`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);
        finalUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn('Storage upload fallback:', storageErr);
      }

      await addDoc(collection(db, 'photos'), {
        url: finalUrl,
        thumbnailUrl: finalUrl,
        type: photoStage,
        caption: photoCaption.trim(),
        projectId: id,
        takenBy: user.uid,
        takenAt: new Date().toISOString(),
        approved: true,
      });

      setIsPhotoModalOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoCaption('');
    } catch (err) {
      console.error('Error uploading photo:', err);
    } finally {
      setPhotoUploading(false);
    }
  };

  // In-Project Message Attachment Handler
  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await compressImage(file, 1200, 0.8);
      setMsgAttachment(dataUrl);
    } catch (err) {
      console.error(err);
    }
    e.target.value = '';
  };

  // Send In-Project Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!msgText.trim() && !msgAttachment) || !id || !user) return;

    setMsgSending(true);
    try {
      const payload: Partial<Message> = {
        projectId: id,
        senderId: user.uid,
        senderName: user.name,
        senderAvatar: user.avatar,
        text: msgText.trim(),
        category: msgCategory,
        readBy: [user.uid],
        createdAt: new Date().toISOString(),
        ...(msgAttachment ? { attachments: [{ name: 'attachment.jpg', url: msgAttachment, type: 'image/jpeg' }] } : {}),
      };

      await addDoc(collection(db, `projects/${id}/messages`), payload);

      // Notify other parties (e.g. notify PM if Client wrote, or Client if PM wrote)
      const notifyTarget = user.role === 'client' ? project?.pmId : project?.clientId;
      if (notifyTarget && notifyTarget !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: notifyTarget,
          title: `Project Update: ${project?.title}`,
          body: `${user.name} (${user.role.toUpperCase()}): "${msgText.slice(0, 60)}${msgText.length > 60 ? '...' : ''}"`,
          type: 'message',
          projectId: id,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      setMsgText('');
      setMsgAttachment(null);
      setMsgCategory('general');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setMsgSending(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container space-y-4">
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-container text-center py-20">
        <p className="text-muted-foreground font-semibold">Project not found or archived.</p>
        <Link to="/projects"><Button variant="outline" className="mt-4">Back to Projects</Button></Link>
      </div>
    );
  }

  const progress = getProjectProgress(project.phases);

  // Filtered photos
  const filteredPhotos = projectPhotos.filter((p) => {
    if (photoFilter === 'all') return true;
    if (photoFilter === 'during') return p.type === 'during' || p.type === 'progress';
    return p.type === photoFilter;
  });

  const beforePhotos = projectPhotos.filter((p) => p.type === 'before');
  const duringPhotos = projectPhotos.filter((p) => p.type === 'during' || p.type === 'progress');
  const afterPhotos = projectPhotos.filter((p) => p.type === 'after');

  return (
    <div className="page-container max-w-6xl pb-16">
      {/* Hidden photo file picker */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelectPhoto}
      />

      {/* Hidden message attachment picker */}
      <input
        ref={msgAttachmentInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAttachmentSelect}
      />

      {/* Top back breadcrumb */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Projects Registry
        </Link>
        {user?.role === 'admin' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Edit3 className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
            Edit Project Specs & Pricing
          </Button>
        )}
      </div>

      {/* Project Hero Header Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden mb-6 border border-border shadow-sm">
          {project.coverPhoto && (
            <div className="h-56 md:h-64 overflow-hidden relative">
              <img src={project.coverPhoto} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 text-white flex items-end justify-between flex-wrap gap-3">
                <div>
                  <span className={`status-badge text-xs mb-2 inline-block font-bold ${statusColor(project.status)}`}>
                    {statusLabel(project.status)}
                  </span>
                  <h1 className="text-2xl md:text-3xl font-display font-bold drop-shadow-md">{project.title}</h1>
                  <p className="text-sm text-white/80 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    {project.address}
                  </p>
                </div>
                {project.budget && (
                  <div className="bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20">
                    <span className="text-[11px] text-white/70 block">Contract Value</span>
                    <PriceDisplay amount={project.budget} className="text-lg font-bold text-white" />
                  </div>
                )}
              </div>
            </div>
          )}

          <CardContent className="pt-5 space-y-5">
            {/* Quick Status Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Live Stage:
                </span>
                {(user?.role === 'admin' || user?.role === 'pm') ? (
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                    disabled={updating}
                    className={cn(
                      'text-xs font-bold px-3 py-1.5 rounded-full border-0 cursor-pointer shadow-sm focus:ring-2 focus:ring-primary-500',
                      statusColor(project.status)
                    )}
                  >
                    <option value="inquiry">Inquiry</option>
                    <option value="design">Design Phase</option>
                    <option value="approval">Awaiting Approval</option>
                    <option value="scheduled">Scheduled for Groundwork</option>
                    <option value="in_progress">In Progress (Active Site)</option>
                    <option value="completed">Completed & Handover</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                ) : (
                  <span className={`status-badge text-xs ${statusColor(project.status)}`}>
                    {statusLabel(project.status)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {project.startDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Commenced: {formatDate(project.startDate)}</span>
                  </div>
                )}
                {project.estimatedEndDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Est. Delivery: {formatDate(project.estimatedEndDate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Team & Stakeholder Cards: PM & Client side by side */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Project Manager Card */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold flex-shrink-0">
                  {project.pmName ? getInitials(project.pmName) : <UserCheck className="w-5 h-5 text-primary-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                      Assigned Project Manager
                    </span>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="text-[11px] text-muted-foreground hover:text-primary-600 transition-colors"
                      >
                        Change PM
                      </button>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-foreground truncate mt-0.5">
                    {project.pmName || pmUser?.name || 'Not Yet Assigned'}
                  </h4>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {(project.pmPhone || pmUser?.phone) && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {project.pmPhone || pmUser?.phone}
                      </span>
                    )}
                    {(project.pmEmail || pmUser?.email) && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" />
                        {project.pmEmail || pmUser?.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Client Card */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold flex-shrink-0">
                  {project.clientName ? getInitials(project.clientName) : <User className="w-5 h-5 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Client & Property Owner
                  </span>
                  <h4 className="font-bold text-sm text-foreground truncate mt-0.5">
                    {project.clientName || clientUser?.name || 'Client Property'}
                  </h4>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {(project.clientPhone || clientUser?.phone) && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {project.clientPhone || clientUser?.phone}
                      </span>
                    )}
                    {(project.clientEmail || clientUser?.email) && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" />
                        {project.clientEmail || clientUser?.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Client Requirements & Specifications Box */}
            {(project.requirements || project.description) && (
              <div className="p-4 rounded-2xl bg-primary-50/40 dark:bg-primary-950/20 border border-primary-200/60 dark:border-primary-900/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary-800 dark:text-primary-300 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  Client Project Brief & Specifications
                </h4>
                {project.requirements && (
                  <p className="text-xs text-foreground leading-relaxed font-medium">
                    {project.requirements}
                  </p>
                )}
                {project.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    {project.description}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Tabbed Project Workspace Navigation */}
      <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto pb-2">
        {[
          { key: 'timeline', label: 'Workflow & Milestones', icon: CheckCircle2, badge: `${progress}%` },
          { key: 'gallery', label: 'Before, During & After Photos', icon: Camera, badge: projectPhotos.length },
          { key: 'messages', label: 'Project Communication Hub', icon: MessageCircle, badge: messages.length },
          { key: 'designs', label: '3D Designs & Blueprints', icon: Palette, badge: designs.length },
          { key: 'documents', label: 'Financials & Invoices', icon: FileText, badge: invoices.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={cn(
              'px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 whitespace-nowrap',
              activeTab === tab.key
                ? 'bg-primary-600 text-white shadow-green'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span className={cn(
                'text-xs px-1.5 py-0.2 rounded-full font-bold',
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: WORKFLOW & MILESTONES */}
      {activeTab === 'timeline' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Project Delivery Flow Line</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Track the lifecycle from survey through 3D design, permits, hardscaping, and planting handover.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary-600">{progress}%</span>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Handover</p>
                </div>
              </div>
              <Progress value={progress} className="h-2 mt-3" />
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 border-l-2 border-border ml-4 space-y-6 py-2">
                {project.phases.map((phase, idx) => (
                  <div key={phase.id} className="relative">
                    {/* Stepper node */}
                    <div
                      className={cn(
                        'absolute -left-[33px] top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-background',
                        phase.status === 'completed'
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : phase.status === 'active'
                          ? 'border-accent bg-accent text-yellow-900 ring-4 ring-accent/20'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      {phase.status === 'completed' ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <span className="text-[10px] font-bold">{idx + 1}</span>
                      )}
                    </div>

                    <div
                      className={cn(
                        'p-4 rounded-2xl border transition-all',
                        phase.status === 'completed'
                          ? 'bg-primary-50/50 dark:bg-primary-950/20 border-primary-200 dark:border-primary-900/40'
                          : phase.status === 'active'
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 ring-2 ring-amber-400/20 shadow-sm'
                          : 'bg-background border-border/80 opacity-70'
                      )}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground">{phase.name}</h4>
                          {phase.status === 'active' && (
                            <Badge variant="warning" className="text-[10px]">Current Milestone</Badge>
                          )}
                        </div>

                        {(user?.role === 'admin' || user?.role === 'pm') ? (
                          <select
                            value={phase.status}
                            onChange={(e) =>
                              handlePhaseStatusChange(phase.id, e.target.value as ProjectPhase['status'])
                            }
                            disabled={updating}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-input bg-background cursor-pointer"
                          >
                            <option value="pending">⏳ Pending</option>
                            <option value="active">🔄 In Progress</option>
                            <option value="completed">✅ Completed</option>
                          </select>
                        ) : (
                          <Badge
                            variant={phase.status === 'completed' ? 'success' : phase.status === 'active' ? 'warning' : 'outline'}
                            className="capitalize text-xs"
                          >
                            {phase.status}
                          </Badge>
                        )}
                      </div>

                      {phase.notes && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{phase.notes}</p>
                      )}

                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/40">
                        {phase.startDate && <span>Started: {formatDate(phase.startDate)}</span>}
                        {phase.endDate && <span>Finished: {formatDate(phase.endDate)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* TAB 2: BEFORE, DURING & AFTER PHOTOS */}
      {activeTab === 'gallery' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-card p-4 rounded-2xl border border-border">
            <div>
              <h3 className="font-bold text-base">Project Transformation Gallery</h3>
              <p className="text-xs text-muted-foreground">
                Document site evolution across Before, During Construction, and After Completion stages.
              </p>
            </div>
            <Button onClick={() => photoInputRef.current?.click()} className="shadow-sm">
              <Camera className="w-4 h-4 mr-2" />
              Add Project Photo
            </Button>
          </div>

          {/* Stage filter pills */}
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'All Photos', count: projectPhotos.length },
              { id: 'before', label: 'Before Work', count: beforePhotos.length },
              { id: 'during', label: 'During Construction', count: duringPhotos.length },
              { id: 'after', label: 'After Completion', count: afterPhotos.length },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setPhotoFilter(f.id as any)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                  photoFilter === f.id
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Side-by-side Before & After comparison card if available */}
          {beforePhotos.length > 0 && afterPhotos.length > 0 && photoFilter === 'all' && (
            <div className="p-4 rounded-2xl bg-card border border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                Transformation Comparison (Before vs. After)
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/10 shadow-inner">
                  <img src={beforePhotos[0].url} alt="Before" className="w-full h-full object-cover" />
                  <Badge variant="secondary" className="absolute top-2 left-2 text-xs font-bold shadow-md">
                    BEFORE
                  </Badge>
                  {beforePhotos[0].caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs p-2 text-white text-xs">
                      {beforePhotos[0].caption}
                    </div>
                  )}
                </div>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/10 shadow-inner">
                  <img src={afterPhotos[0].url} alt="After" className="w-full h-full object-cover" />
                  <Badge variant="success" className="absolute top-2 left-2 text-xs font-bold shadow-md">
                    AFTER
                  </Badge>
                  {afterPhotos[0].caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs p-2 text-white text-xs">
                      {afterPhotos[0].caption}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Photo Grid */}
          {filteredPhotos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed border-border p-8">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-30 text-primary-600" />
              <p className="font-semibold text-foreground text-sm">No photos in this stage</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
                Upload Before, During, or After pictures to build an end-to-end portfolio for this property.
              </p>
              <Button onClick={() => photoInputRef.current?.click()} size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Upload Photo Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative rounded-2xl overflow-hidden aspect-square bg-muted shadow-xs hover:shadow-md transition-all"
                >
                  <img src={photo.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute top-2 left-2 z-10">
                    <Badge
                      variant={photo.type === 'before' ? 'secondary' : photo.type === 'after' ? 'success' : 'warning'}
                      className="text-[11px] font-bold capitalize shadow-sm"
                    >
                      {photo.type === 'during' ? 'During' : photo.type}
                    </Badge>
                  </div>
                  {photo.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 text-white text-xs">
                      {photo.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 3: IN-PROJECT COMMUNICATION HUB */}
      {activeTab === 'messages' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card className="flex flex-col h-[650px] overflow-hidden border border-border">
            {/* Header info */}
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary-600" />
                  Project Team Discussion Stream
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Share ideas, site modifications, plant selections & instant feedback within this project.
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {messages.length} messages logged
              </Badge>
            </div>

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mb-3 opacity-25 text-primary-600" />
                  <p className="font-semibold text-foreground text-sm">Start the Project Conversation</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Clients, Project Managers, and Admins can communicate ideas, modification requests, and site updates directly here.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderId === user?.uid;
                  return (
                    <div key={m.id} className={cn('flex gap-3 max-w-[80%]', isMe ? 'ml-auto flex-row-reverse' : '')}>
                      <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
                        <AvatarImage src={m.senderAvatar} />
                        <AvatarFallback className="text-[11px] font-bold">
                          {getInitials(m.senderName || 'U')}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <div className={cn('flex items-center gap-2 mb-1 text-[11px]', isMe ? 'justify-end' : '')}>
                          <span className="font-bold text-foreground">{m.senderName}</span>
                          {m.category && m.category !== 'general' && (
                            <Badge variant={m.category === 'idea' ? 'warning' : 'outline'} className="text-[10px] py-0">
                              {m.category === 'idea' ? '💡 Idea / Change' : '🏗️ Site Update'}
                            </Badge>
                          )}
                          <span className="text-muted-foreground">{formatRelative(m.createdAt)}</span>
                        </div>

                        <div
                          className={cn(
                            'p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs',
                            isMe
                              ? 'bg-primary-600 text-white rounded-tr-none'
                              : 'bg-muted/80 text-foreground border border-border/80 rounded-tl-none'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{m.text}</p>
                          {m.attachments?.map((att, i) => (
                            <div key={i} className="mt-2 rounded-xl overflow-hidden max-w-xs">
                              <img src={att.url} alt="Attachment" className="w-full h-auto object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-muted/20 space-y-2">
              {/* Category picker & attachments indicator */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px]">Type:</span>
                  {(['general', 'idea', 'modification', 'update'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMsgCategory(cat)}
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors',
                        msgCategory === cat
                          ? 'bg-primary-600 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {cat === 'idea' ? '💡 Client Idea' : cat === 'modification' ? '🔄 Modification' : cat === 'update' ? '🏗️ Site Update' : 'General'}
                    </button>
                  ))}
                </div>

                {msgAttachment && (
                  <div className="flex items-center gap-1 text-[11px] text-primary-600 font-semibold bg-primary-50 px-2 py-0.5 rounded-md">
                    <ImageIcon className="w-3 h-3" />
                    <span>Photo attached</span>
                    <button type="button" onClick={() => setMsgAttachment(null)} className="text-muted-foreground hover:text-red-500 ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="rounded-xl flex-shrink-0"
                  onClick={() => msgAttachmentInputRef.current?.click()}
                  title="Attach Photo or Sketch"
                >
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                </Button>

                <Input
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder="Share a message, request a modification, or ask a question..."
                  className="rounded-xl bg-background text-xs"
                />

                <Button type="submit" disabled={msgSending || (!msgText.trim() && !msgAttachment)} className="rounded-xl flex-shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {/* TAB 4: 3D DESIGNS & BLUEPRINTS */}
      {activeTab === 'designs' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border">
            <div>
              <h3 className="font-bold text-base">3D Architectural Concepts & Drawings</h3>
              <p className="text-xs text-muted-foreground">View and annotate 3D plans and planting schematics.</p>
            </div>
            <Link to={`/designs?project=${id}`}>
              <Button size="sm">
                Open 3D Viewer & Annotations <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {designs.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border p-8 text-muted-foreground">
              <Palette className="w-10 h-10 mx-auto mb-2 opacity-30 text-purple-600" />
              <p className="font-semibold text-foreground text-sm">No 3D designs uploaded yet</p>
              <p className="text-xs mt-1 max-w-sm mx-auto mb-4">
                Our landscape architects will upload concept renderings here during the Design phase.
              </p>
              <Link to={`/designs?project=${id}`}>
                <Button variant="outline" size="sm">Upload Design Concept</Button>
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {designs.map((design) => (
                <Card key={design.id} className="overflow-hidden card-hover">
                  <div className="h-44 bg-muted overflow-hidden relative">
                    <img src={design.imageUrl} alt={design.title} className="w-full h-full object-cover" />
                    <Badge variant="outline" className="absolute top-2 right-2 bg-background/80 text-[10px]">
                      v{design.version}
                    </Badge>
                  </div>
                  <CardContent className="pt-3">
                    <h4 className="font-bold text-sm truncate">{design.title}</h4>
                    <div className="flex items-center justify-between text-xs mt-2">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={design.status === 'approved' ? 'success' : 'warning'} className="capitalize text-[10px]">
                        {design.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 5: FINANCIALS & INVOICES */}
      {activeTab === 'documents' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Project Contract & Billing</CardTitle>
              <p className="text-xs text-muted-foreground">
                Invoices, payment milestones, and signed agreements for this site.
              </p>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-600" />
                  <p className="text-xs font-semibold">No invoices generated for this project yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">Invoice #{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(inv.dueDate)}</p>
                      </div>
                      <div className="text-right">
                        <PriceDisplay amount={inv.amount} className="font-bold text-sm" />
                        <span className={`text-[10px] ${statusColor(inv.status)} px-2 py-0.5 rounded-full capitalize block mt-0.5`}>
                          {statusLabel(inv.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add Project Photo Modal */}
      <AnimatePresence>
        {isPhotoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <h3 className="text-lg font-bold">Add Project Stage Photo</h3>
                <button onClick={() => setIsPhotoModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {photoPreview && (
                <div className="aspect-video rounded-xl overflow-hidden bg-black/10 mb-4 border border-border">
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <form onSubmit={handleUploadPhoto} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                    Select Stage *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'before', lbl: 'Before Work' },
                      { val: 'during', lbl: 'During Work' },
                      { val: 'after', lbl: 'After Completion' },
                    ].map((s) => (
                      <button
                        key={s.val}
                        type="button"
                        onClick={() => setPhotoStage(s.val as PhotoType)}
                        className={cn(
                          'p-2 rounded-xl border text-xs font-bold text-center transition-all',
                          photoStage === s.val
                            ? 'border-primary-600 bg-primary-50 text-primary-700 ring-2 ring-primary-500/20'
                            : 'border-border bg-background hover:bg-muted text-muted-foreground'
                        )}
                      >
                        {s.lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                    Caption / Description
                  </label>
                  <Input
                    placeholder="e.g. Lawn removed and sub-base prepared for travertine"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsPhotoModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={photoUploading} className="flex-1">
                    {photoUploading ? 'Uploading...' : 'Save Photo'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={isEditModalOpen}
        project={project}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
}
