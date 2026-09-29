// src/app/gallery/GalleryPage.tsx
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon, X, ChevronLeft, ChevronRight, Download,
  Upload, Trash2, CheckCircle2, FolderKanban, Image as ImageIcon, Plus
} from 'lucide-react';
import { collection, addDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProjectPhoto, Project, PhotoType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

type PhotoFilter = 'all' | 'before' | 'during' | 'after';

// Helper to compress image to lightweight base64/blob
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
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = elem.toDataURL('image/jpeg', quality);
        elem.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

export function GalleryPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<PhotoFilter>('all');
  const [lightbox, setLightbox] = useState<{ photos: ProjectPhoto[]; index: number } | null>(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoStage, setPhotoStage] = useState<PhotoType>('during');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: photos, loading: photosLoading } = useCollection<ProjectPhoto>(
    'photos',
    orderBy('takenAt', 'desc')
  );

  const { data: projects } = useCollection<Project>(
    'projects',
    orderBy('updatedAt', 'desc')
  );

  // Filter matching 'during' or 'progress'
  const filtered = photos.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'during') return p.type === 'during' || p.type === 'progress';
    return p.type === filter;
  });

  const approved = filtered.filter((p) => p.approved || user?.role !== 'client');

  const openLightbox = (index: number) => setLightbox({ photos: approved, index });
  const closeLightbox = () => setLightbox(null);
  const lightboxPrev = () =>
    setLightbox((l) => (l ? { ...l, index: Math.max(0, l.index - 1) } : null));
  const lightboxNext = () =>
    setLightbox((l) => (l ? { ...l, index: Math.min(l.photos.length - 1, l.index + 1) } : null));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setErrorMsg(null);
    setIsUploadModalOpen(true);

    // Reset input so same file can be picked again if desired
    e.target.value = '';
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      // 1. Optimize image in canvas
      const { blob, dataUrl } = await compressImage(selectedFile, 1600, 0.85);

      let finalUrl = dataUrl;

      // 2. Try Firebase Storage first, fallback gracefully to dataUrl
      try {
        const filename = `photos/${uuidv4()}.jpg`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);
        finalUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn('Firebase Storage upload failed, falling back to direct base64 image data:', storageErr);
      }

      // 3. Write document to Firestore
      await addDoc(collection(db, 'photos'), {
        url: finalUrl,
        thumbnailUrl: finalUrl,
        type: photoStage,
        caption: caption.trim() || '',
        projectId: selectedProjectId || '',
        takenBy: user.uid,
        takenAt: new Date().toISOString(),
        approved: true,
      });

      // Close modal and reset
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
      setSelectedProjectId('');
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setErrorMsg(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    try {
      await deleteDoc(doc(db, 'photos', photoId));
      if (lightbox) {
        closeLightbox();
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  };

  // Before/After comparison pairs
  const beforeAfterPairs = projects
    .map((proj) => {
      const projPhotos = photos.filter((p) => p.projectId === proj.id);
      const before = projPhotos.find((p) => p.type === 'before');
      const during = projPhotos.find((p) => p.type === 'during' || p.type === 'progress');
      const after = projPhotos.find((p) => p.type === 'after');
      return { project: proj, before, during, after };
    })
    .filter((group) => group.before || group.after);

  return (
    <div className="page-container">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Project Photo Gallery</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track visual progress with Before, During, and After documentation
          </p>
        </div>

        {/* Upload Button */}
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="shadow-md"
        >
          <CameraIcon className="w-4 h-4 mr-2" />
          Upload Photo
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(['all', 'before', 'during', 'after'] as PhotoFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all whitespace-nowrap',
              filter === f
                ? 'bg-primary-600 text-white shadow-green'
                : 'bg-muted text-muted-foreground hover:bg-primary-50 hover:text-primary-600'
            )}
          >
            {f === 'during' ? 'During Construction' : f === 'before' ? 'Before Work' : f === 'after' ? 'After Completion' : 'All Photos'}
            <span className="ml-1.5 opacity-70 text-xs">
              ({f === 'all'
                ? photos.length
                : photos.filter((p) => (f === 'during' ? p.type === 'during' || p.type === 'progress' : p.type === f)).length})
            </span>
          </button>
        ))}
      </div>

      {/* Before / During / After project showcase */}
      {filter === 'all' && beforeAfterPairs.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-accent" />
            Project Transformations (Before & After)
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {beforeAfterPairs.slice(0, 4).map(({ project, before, during, after }) => (
              <div key={project.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-sm truncate">{project.title}</div>
                  <Badge variant="outline" className="text-xs">{project.address}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                    {before ? (
                      <>
                        <img src={before.url} alt="Before" className="w-full h-full object-cover" />
                        <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px]">Before</Badge>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-[11px] p-2 text-center">
                        <ImageIcon className="w-4 h-4 mb-1 opacity-40" />
                        No Before
                      </div>
                    )}
                  </div>

                  <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                    {during ? (
                      <>
                        <img src={during.url} alt="During" className="w-full h-full object-cover" />
                        <Badge variant="warning" className="absolute top-1.5 left-1.5 text-[10px]">During</Badge>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-[11px] p-2 text-center">
                        <ImageIcon className="w-4 h-4 mb-1 opacity-40" />
                        No Progress
                      </div>
                    )}
                  </div>

                  <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                    {after ? (
                      <>
                        <img src={after.url} alt="After" className="w-full h-full object-cover" />
                        <Badge variant="success" className="absolute top-1.5 left-1.5 text-[10px]">After</Badge>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-[11px] p-2 text-center">
                        <ImageIcon className="w-4 h-4 mb-1 opacity-40" />
                        In Progress
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main photo grid */}
      {approved.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card rounded-2xl border border-dashed border-border p-8">
          <CameraIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-primary-600" />
          <p className="font-semibold text-foreground text-lg">No photos in this category</p>
          <p className="text-sm mt-1 max-w-sm mx-auto mb-4">
            Upload high-resolution before, during, and after photos to track your landscaping project.
          </p>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Plus className="w-4 h-4 mr-2" />
            Upload First Photo
          </Button>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
        >
          {approved.map((photo, index) => {
            const proj = projects.find((p) => p.id === photo.projectId);
            const stageLabel =
              photo.type === 'before'
                ? 'Before'
                : photo.type === 'after'
                ? 'After'
                : 'During Work';
            const badgeVariant =
              photo.type === 'before'
                ? 'secondary'
                : photo.type === 'after'
                ? 'success'
                : 'warning';

            return (
              <motion.div
                key={photo.id}
                variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
                className="group relative cursor-pointer rounded-2xl overflow-hidden aspect-square bg-muted shadow-sm hover:shadow-md transition-all"
                onClick={() => openLightbox(index)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || 'Project photo'}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Stage Badge on top left */}
                <div className="absolute top-2.5 left-2.5 z-10">
                  <Badge variant={badgeVariant as any} className="text-xs shadow-sm font-semibold capitalize">
                    {stageLabel}
                  </Badge>
                </div>

                {/* Info Overlay at bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white">
                  {proj && (
                    <p className="text-xs font-semibold truncate text-white/90 flex items-center gap-1">
                      <FolderKanban className="w-3 h-3 flex-shrink-0" />
                      {proj.title}
                    </p>
                  )}
                  {photo.caption && (
                    <p className="text-xs text-white/80 line-clamp-2 mt-0.5">{photo.caption}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Upload Photo Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative overflow-hidden my-8"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
                    <Upload className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold">Upload Project Photo</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {previewUrl && (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/10 mb-4 border border-border">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs">
                      {photoStage.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* Photo Stage Selection */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Project Stage *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'before', label: 'Before', desc: 'Site initial state' },
                      { value: 'during', label: 'During', desc: 'Work in progress' },
                      { value: 'after', label: 'After', desc: 'Finished project' },
                    ].map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setPhotoStage(s.value as PhotoType)}
                        className={cn(
                          'p-2.5 rounded-xl border text-center transition-all text-xs font-medium',
                          photoStage === s.value
                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/30 text-primary-700 font-bold ring-2 ring-primary-500/20'
                            : 'border-border bg-background hover:bg-muted text-muted-foreground'
                        )}
                      >
                        <div className="font-semibold">{s.label}</div>
                        <div className="text-[10px] opacity-75">{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Associate with Project */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Assign to Project
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- General / No Project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.address})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Caption */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Caption / Notes
                  </label>
                  <Input
                    placeholder="e.g. Completed travertine paving around the pool"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-red-500 font-medium">{errorMsg}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsUploadModalOpen(false)}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Save & Publish'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            {/* Top Bar actions */}
            <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
              <a
                href={lightbox.photos[lightbox.index]?.url}
                target="_blank"
                rel="noreferrer"
                download
                className="text-white/80 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                onClick={(e) => e.stopPropagation()}
                title="Download image"
              >
                <Download className="w-5 h-5" />
              </a>

              {(user?.role === 'admin' || user?.role === 'pm') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentId = lightbox.photos[lightbox.index]?.id;
                    if (currentId) handleDeletePhoto(currentId);
                  }}
                  className="text-red-400 hover:text-red-300 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title="Delete photo"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              <button
                type="button"
                className="text-white/80 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                onClick={closeLightbox}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation arrows */}
            {lightbox.index > 0 && (
              <button
                type="button"
                className="absolute left-4 text-white/80 hover:text-white z-10 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxPrev();
                }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center">
              <motion.img
                key={lightbox.index}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                src={lightbox.photos[lightbox.index]?.url}
                alt=""
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Caption and meta */}
              <div
                className="mt-3 text-center text-white/90 max-w-lg bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Badge
                    variant={
                      lightbox.photos[lightbox.index]?.type === 'before'
                        ? 'secondary'
                        : lightbox.photos[lightbox.index]?.type === 'after'
                        ? 'success'
                        : 'warning'
                    }
                    className="capitalize text-xs font-semibold"
                  >
                    {lightbox.photos[lightbox.index]?.type}
                  </Badge>
                  <span className="text-xs text-white/60">
                    {lightbox.index + 1} of {lightbox.photos.length}
                  </span>
                </div>
                {lightbox.photos[lightbox.index]?.caption && (
                  <p className="text-sm font-medium">{lightbox.photos[lightbox.index]?.caption}</p>
                )}
              </div>
            </div>

            {lightbox.index < lightbox.photos.length - 1 && (
              <button
                type="button"
                className="absolute right-4 text-white/80 hover:text-white z-10 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxNext();
                }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}
