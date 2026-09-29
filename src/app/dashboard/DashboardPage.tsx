// src/app/dashboard/DashboardPage.tsx
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FolderKanban, Palette, MessageCircle, FileText,
  TrendingUp, Clock, CheckCircle2, AlertCircle, ChevronRight,
  ClipboardList, UserCheck, ShieldAlert
} from 'lucide-react';
import { where, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  formatDate, formatCurrency, statusColor, statusLabel,
  getProjectProgress, getInitials,
} from '@/lib/utils';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import type { Project, Invoice, ProjectRequest } from '@/types';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.08 } } },
  item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } },
};

const ACTIVE_STATUSES = ['in_progress', 'design', 'approval', 'scheduled', 'inquiry'];

export function DashboardPage() {
  const { user } = useAuth();

  // Role-aware project query
  const projectQueryConstraints =
    user?.role === 'admin'
      ? [orderBy('updatedAt', 'desc'), limit(10)]
      : user?.role === 'pm'
      ? [where('pmId', '==', user?.uid ?? ''), orderBy('updatedAt', 'desc'), limit(10)]
      : [where('clientId', '==', user?.uid ?? ''), orderBy('updatedAt', 'desc'), limit(10)];

  const { data: rawProjects } = useCollection<Project>('projects', ...projectQueryConstraints);

  // Exclude soft-deleted projects
  const projects = rawProjects.filter((p) => !p.deleted);

  // Invoices query
  const invoiceQueryConstraints =
    user?.role === 'admin'
      ? [where('status', '!=', 'paid'), limit(5)]
      : [where('clientId', '==', user?.uid ?? ''), where('status', '!=', 'paid'), limit(5)];

  const { data: invoices } = useCollection<Invoice>('invoices', ...invoiceQueryConstraints);

  // Project requests for client or admin
  const { data: projectRequests } = useCollection<ProjectRequest>(
    'projectRequests',
    user?.role === 'client'
      ? where('clientId', '==', user?.uid ?? '')
      : orderBy('createdAt', 'desc')
  );

  const pendingRequestsCount = projectRequests.filter((r) => r.status === 'pending').length;
  const clientLatestRequest = user?.role === 'client' ? projectRequests[0] : null;

  // Active projects include: in_progress, design, approval, scheduled, inquiry
  const activeProjectsList = projects.filter((p) => ACTIVE_STATUSES.includes(p.status));
  const activeProject = activeProjectsList[0] ?? projects[0];

  const pendingApprovals = projects.filter((p) => p.status === 'approval' || p.status === 'design').length;
  const unreadInvoices = invoices.filter((i) => i.status !== 'paid').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const progress = activeProject ? getProjectProgress(activeProject.phases) : 0;

  const quickActions = [
    { label: user?.role === 'admin' ? 'All Projects' : 'My Projects', to: '/projects', icon: FolderKanban, color: 'bg-primary-50 text-primary-600' },
    { label: 'Design Approvals', to: '/designs', icon: Palette, color: 'bg-purple-50 text-purple-600', badge: pendingApprovals },
    { label: 'Messages', to: '/messages', icon: MessageCircle, color: 'bg-blue-50 text-blue-600' },
    ...(user?.role === 'admin'
      ? [{ label: 'Project Requests', to: '/admin/requests', icon: ClipboardList, color: 'bg-amber-50 text-amber-600', badge: pendingRequestsCount }]
      : [{ label: 'Invoices', to: '/documents', icon: FileText, color: 'bg-yellow-50 text-yellow-600', badge: unreadInvoices }]),
  ];

  return (
    <div className="page-container">
      {/* Welcome header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Good {getTimeOfDay()}, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {user?.role === 'admin'
                ? 'Admin Overview — live monitoring across all ongoing landscaping contracts.'
                : user?.role === 'pm'
                ? 'Project Manager Overview — track your assigned sites, stages, and approvals.'
                : 'Client Portal — real-time view into your landscape design & installation.'}
            </p>
          </div>
          {user?.role === 'admin' && (
            <Badge variant="outline" className="text-xs font-semibold px-3 py-1 bg-primary-50 text-primary-700 border-primary-200">
              Admin Mode
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Client Request Banner */}
      {user?.role === 'client' && clientLatestRequest && clientLatestRequest.status === 'pending' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3"
        >
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl text-amber-700 dark:text-amber-300">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm">
                Project Request Under Review: "{clientLatestRequest.projectTitle}"
              </h4>
              <Badge variant="warning" className="text-[11px]">Pending Review</Badge>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-1">
              Our landscape architectural team is reviewing your requirements and site details. You will be assigned a Project Manager upon approval.
            </p>
          </div>
        </motion.div>
      )}

      {/* Stats row */}
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {[
          {
            label: 'Active Projects',
            value: activeProjectsList.length,
            icon: TrendingUp,
            color: 'text-primary-600',
            sub: 'Design, approval, and in progress',
          },
          {
            label: user?.role === 'admin' ? 'Pending Requests' : 'Pending Approvals',
            value: user?.role === 'admin' ? pendingRequestsCount : pendingApprovals,
            icon: Clock,
            color: 'text-amber-600',
            sub: user?.role === 'admin' ? 'Awaiting acceptance' : 'Awaiting review',
          },
          {
            label: 'Completed Projects',
            value: completedCount,
            icon: CheckCircle2,
            color: 'text-green-600',
            sub: 'Delivered handovers',
          },
          {
            label: user?.role === 'admin' ? 'Unpaid Invoices' : 'Pending Balance',
            value: unreadInvoices,
            icon: AlertCircle,
            color: 'text-red-500',
            sub: 'Outstanding bills',
          },
        ].map((stat) => (
          <motion.div key={stat.label} variants={stagger.item}>
            <Card className="card-hover">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1 truncate">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active project card */}
        <div className="lg:col-span-2 space-y-6">
          {activeProject ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow">
                {activeProject.coverPhoto && (
                  <div className="h-44 bg-muted overflow-hidden relative">
                    <img src={activeProject.coverPhoto} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 text-white">
                      <span className={`status-badge text-xs mb-1 inline-block ${statusColor(activeProject.status)}`}>
                        {statusLabel(activeProject.status)}
                      </span>
                      <h3 className="text-lg font-bold drop-shadow">{activeProject.title}</h3>
                    </div>
                  </div>
                )}
                <CardHeader className={activeProject.coverPhoto ? 'pt-4' : ''}>
                  <div className="flex items-start justify-between">
                    <div>
                      {!activeProject.coverPhoto && (
                        <span className={`status-badge text-xs mb-2 inline-block ${statusColor(activeProject.status)}`}>
                          {statusLabel(activeProject.status)}
                        </span>
                      )}
                      {!activeProject.coverPhoto && <CardTitle>{activeProject.title}</CardTitle>}
                      <p className="text-sm text-muted-foreground mt-1">{activeProject.address}</p>
                    </div>
                    <Link to={`/projects/${activeProject.id}`}>
                      <Button variant="outline" size="sm" className="gap-1">
                        View Project Hub <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall Workflow Progress</span>
                    <span className="font-semibold text-primary-600">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2.5 mb-4" />

                  {/* Phases progress pills */}
                  {activeProject.phases && activeProject.phases.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {activeProject.phases.slice(0, 4).map((phase) => (
                        <div
                          key={phase.id}
                          className={`rounded-xl p-2.5 text-center text-xs font-medium truncate ${
                            phase.status === 'completed'
                              ? 'bg-primary-100 text-primary-800 dark:bg-primary-950/50 dark:text-primary-300'
                              : phase.status === 'active'
                              ? 'bg-accent/20 text-yellow-800 dark:text-yellow-300 ring-1 ring-accent'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {phase.status === 'completed' ? '✓ ' : phase.status === 'active' ? '⟳ ' : ''}
                          {phase.name}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card className="border border-dashed border-border p-8 text-center">
              <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30 text-primary-600" />
              <h3 className="font-semibold text-lg">No Active Projects</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {user?.role === 'client'
                  ? 'Request a landscaping consultation or submit your project details.'
                  : 'Create or accept client requests to get projects underway.'}
              </p>
              <Link to="/projects">
                <Button>Go to Projects</Button>
              </Link>
            </Card>
          )}

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-lg font-semibold mb-3">Quick Navigation</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link key={action.to} to={action.to}>
                  <Card className="card-hover cursor-pointer h-full">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color}`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{action.label}</p>
                      </div>
                      {action.badge != null && action.badge > 0 && (
                        <Badge variant="warning">{action.badge}</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-6"
        >
          {/* Invoices */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Pending Invoices</CardTitle>
              {invoices.length > 0 && (
                <Link to="/documents" className="text-xs text-primary-600 hover:underline">
                  View all
                </Link>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">All caught up! 🎉</p>
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/40">
                    <div>
                      <p className="text-sm font-medium">#{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <PriceDisplay amount={inv.amount} className="text-sm font-semibold" />
                      <div>
                        <span className={`text-[10px] ${statusColor(inv.status)} px-1.5 py-0.5 rounded-full capitalize`}>
                          {statusLabel(inv.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* All projects list */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Projects Overview</CardTitle>
              <Link to="/projects" className="text-xs text-primary-600 hover:underline">
                View all ({projects.length})
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No projects recorded yet.</p>
              ) : (
                projects.slice(0, 5).map((p) => (
                  <Link key={p.id} to={`/projects/${p.id}`}>
                    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <FolderKanban className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{getProjectProgress(p.phases)}% complete</p>
                      </div>
                      <span className={`status-badge text-[10px] ${statusColor(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
