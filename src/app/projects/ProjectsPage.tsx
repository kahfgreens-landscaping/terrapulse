// src/app/projects/ProjectsPage.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { where, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  FolderKanban, MapPin, Clock, ChevronRight, Plus, Sparkles,
  Edit3, Trash2, RotateCcw, AlertTriangle, UserCheck, ShieldAlert
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, statusColor, statusLabel, getProjectProgress } from '@/lib/utils';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import type { Project } from '@/types';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { EditProjectModal } from '@/components/projects/EditProjectModal';
import { seedSampleProjects } from '@/lib/seedSampleData';

export function ProjectsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // NOTE: Composite Firestore indexes (clientId + orderBy updatedAt) may not exist in all
  // environments. To avoid silent query failures, we fetch without orderBy for role-based
  // filters and sort in-memory after loading — this is safe and performant for typical project counts.
  const queryConstraints =
    user?.role === 'client'
      ? [where('clientId', '==', user.uid)]
      : user?.role === 'pm'
      ? [where('pmId', '==', user.uid)]
      : [orderBy('updatedAt', 'desc')];

  const { data: rawProjectsUnsorted, loading } = useCollection<Project>('projects', ...queryConstraints);

  // Sort non-admin results in-memory by updatedAt desc (avoids composite index requirement)
  const rawProjects = user?.role === 'admin'
    ? rawProjectsUnsorted
    : [...rawProjectsUnsorted].sort((a, b) =>
        new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
      );

  // Separate non-deleted and deleted projects
  const nonDeletedProjects = rawProjects.filter((p) => !p.deleted);
  const deletedProjects = rawProjects.filter((p) => p.deleted);

  // Status filters list
  const statusFilters = [
    { id: 'all', label: 'All Projects', count: nonDeletedProjects.length },
    {
      id: 'active',
      label: 'Active & In Design',
      count: nonDeletedProjects.filter((p) =>
        ['in_progress', 'design', 'approval', 'scheduled', 'inquiry'].includes(p.status)
      ).length,
    },
    {
      id: 'completed',
      label: 'Completed',
      count: nonDeletedProjects.filter((p) => p.status === 'completed').length,
    },
    ...(user?.role === 'admin'
      ? [{ id: 'deleted', label: 'Deleted Archive', count: deletedProjects.length }]
      : []),
  ];

  const filtered =
    filter === 'deleted'
      ? deletedProjects
      : filter === 'active'
      ? nonDeletedProjects.filter((p) =>
          ['in_progress', 'design', 'approval', 'scheduled', 'inquiry'].includes(p.status)
        )
      : filter === 'completed'
      ? nonDeletedProjects.filter((p) => p.status === 'completed')
      : nonDeletedProjects;

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedSampleProjects(user.uid);
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  const handleRestore = async (project: Project) => {
    setActionLoading(project.id);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        deleted: false,
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error restoring project:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (project: Project) => {
    if (!window.confirm(`Permanently delete "${project.title}"? This action cannot be undone.`)) return;
    setActionLoading(project.id);
    try {
      await deleteDoc(doc(db, 'projects', project.id));
    } catch (err) {
      console.error('Error permanently deleting project:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSoftDelete = async (project: Project) => {
    if (!window.confirm(`Move "${project.title}" to Deleted Archive? You can restore it anytime.`)) return;
    setActionLoading(project.id);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        deleted: true,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error soft-deleting project:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">
            {user?.role === 'admin' ? 'Master Projects Registry' : 'My Landscaping Projects'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.role === 'admin'
              ? `${nonDeletedProjects.length} active contracts, ${deletedProjects.length} archived/deleted`
              : `${nonDeletedProjects.length} total projects recorded`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nonDeletedProjects.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
              <Sparkles className="w-4 h-4 mr-1 text-accent" />
              {seeding ? 'Generating...' : 'Add Demo Projects'}
            </Button>
          )}
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {user?.role === 'client' ? 'Request Project' : 'New Project'}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {statusFilters.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filter === tab.id
                ? tab.id === 'deleted'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-primary-600 text-white shadow-green'
                : 'bg-muted text-muted-foreground hover:bg-primary-50 hover:text-primary-600'
            }`}
          >
            {tab.id === 'deleted' && <Trash2 className="w-3.5 h-3.5" />}
            <span>{tab.label}</span>
            <span className="opacity-75 text-xs font-semibold">({tab.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card rounded-2xl border border-dashed border-border p-8">
          <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30 text-primary-600" />
          <p className="font-semibold text-foreground text-lg">
            {filter === 'deleted' ? 'No Deleted Projects' : 'No projects found'}
          </p>
          <p className="text-sm mt-1 max-w-md mx-auto mb-6">
            {filter === 'deleted'
              ? 'Projects deleted by administrators will appear here with one-click restore.'
              : 'Get started by creating your first landscape project or populate realistic demo data.'}
          </p>
          {filter !== 'deleted' && (
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleSeed} disabled={seeding}>
                <Sparkles className="w-4 h-4 mr-2 text-accent" />
                {seeding ? 'Adding...' : 'Load Sample Data'}
              </Button>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Project
              </Button>
            </div>
          )}
        </div>
      ) : (
        <motion.div
          className="grid md:grid-cols-2 xl:grid-cols-3 gap-5"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        >
          {filtered.map((project) => (
            <motion.div
              key={project.id}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            >
              <Card className="card-hover h-full flex flex-col justify-between overflow-hidden relative">
                {/* Deleted Banner */}
                {project.deleted && (
                  <div className="bg-red-500 text-white text-xs py-1 px-3 font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Deleted on {formatDate(project.deletedAt || project.updatedAt)}
                    </span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">Archived</span>
                  </div>
                )}

                <div>
                  {/* Cover photo or placeholder */}
                  <Link to={`/projects/${project.id}`}>
                    {project.coverPhoto ? (
                      <div className="h-36 overflow-hidden relative group">
                        <img src={project.coverPhoto} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
                        <div className="absolute top-2.5 right-2.5">
                          <span className={`status-badge text-[10px] font-semibold ${statusColor(project.status)} shadow-sm`}>
                            {statusLabel(project.status)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-28 bg-gradient-to-br from-green-light to-primary-100 flex items-center justify-between p-4 relative">
                        <FolderKanban className="w-8 h-8 text-primary-400" />
                        <span className={`status-badge text-[10px] font-semibold ${statusColor(project.status)}`}>
                          {statusLabel(project.status)}
                        </span>
                      </div>
                    )}
                  </Link>

                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0 pr-2">
                        <Link to={`/projects/${project.id}`} className="hover:text-primary-600 transition-colors">
                          <h3 className="font-bold text-foreground text-base truncate">{project.title}</h3>
                        </Link>
                      </div>
                      <Link to={`/projects/${project.id}`}>
                        <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{project.address}</span>
                    </div>

                    {/* Assigned PM and Client Row */}
                    <div className="flex flex-wrap gap-2 text-[11px] mb-3 p-2 bg-muted/40 rounded-xl">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <UserCheck className="w-3.5 h-3.5 text-primary-600" />
                        <span>PM:</span>
                        <span className="font-semibold text-foreground">
                          {project.pmName || 'Unassigned'}
                        </span>
                      </div>

                      {user?.role === 'admin' && project.clientName && (
                        <div className="flex items-center gap-1 text-muted-foreground ml-auto">
                          <span>Client:</span>
                          <span className="font-medium text-foreground truncate max-w-[120px]">
                            {project.clientName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Workflow Progress</span>
                      <span className="font-semibold text-primary-600">{getProjectProgress(project.phases)}%</span>
                    </div>
                    <Progress value={getProjectProgress(project.phases)} className="h-1.5" />

                    {/* Budget row */}
                    {project.budget && (
                      <div className="flex items-center justify-between text-xs mt-3 pt-2.5 border-t border-border/50">
                        <span className="text-muted-foreground">Contract Pricing</span>
                        <PriceDisplay amount={project.budget} className="text-xs font-semibold text-foreground" />
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Card footer actions for Admin */}
                {user?.role === 'admin' && (
                  <div className="p-3 pt-0 border-t border-border/40 mt-3 flex items-center justify-end gap-1.5 bg-muted/20">
                    {project.deleted ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-green-700 hover:bg-green-50 border-green-200"
                          onClick={() => handleRestore(project)}
                          disabled={actionLoading === project.id}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Restore Project
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => handlePermanentDelete(project)}
                          disabled={actionLoading === project.id}
                        >
                          Delete Permanently
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingProject(project)}
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          Edit Specs
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => handleSoftDelete(project)}
                          disabled={actionLoading === project.id}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={!!editingProject}
        project={editingProject}
        onClose={() => setEditingProject(null)}
      />
    </div>
  );
}
