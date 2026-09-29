// src/app/admin/AdminPage.tsx
import { motion } from 'framer-motion';
import { orderBy, limit } from 'firebase/firestore';
import {
  Users, FolderKanban, Wallet, TrendingUp,
  Clock, CheckCircle2, BarChart3, AlertTriangle,
} from 'lucide-react';
import { useCollection } from '@/hooks/useFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { formatCurrency, statusColor, statusLabel, getProjectProgress } from '@/lib/utils';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { useCurrencyStore } from '@/store/currency.store';
import type { Project, Invoice, User } from '@/types';

const CHART_COLORS = ['#2D6A4F', '#52B788', '#E9C46A', '#95D5B2', '#B7E4C7'];

export function AdminPage() {
  const { currency } = useCurrencyStore();
  const { data: projects } = useCollection<Project>('projects', orderBy('updatedAt', 'desc'), limit(50));
  const { data: invoices } = useCollection<Invoice>('invoices', orderBy('createdAt', 'desc'), limit(100));
  const { data: clients } = useCollection<User>('users', limit(100));

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const pendingRevenue = invoices.filter((i) => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const activeClients = clients.filter((u) => u.role === 'client').length;

  // Status breakdown for pie chart
  const statusBreakdown = ['inquiry', 'design', 'approval', 'in_progress', 'completed'].map((status) => ({
    name: statusLabel(status),
    value: projects.filter((p) => p.status === status).length,
  }));

  // Monthly revenue mock data
  const revenueData = [
    { month: 'Apr', revenue: 12400 },
    { month: 'May', revenue: 18200 },
    { month: 'Jun', revenue: 24600 },
    { month: 'Jul', revenue: 22800 },
    { month: 'Aug', revenue: 31500 },
    { month: 'Sep', revenue: totalRevenue > 0 ? totalRevenue : 28900 },
  ];

  const stagger = {
    container: { hidden: {}, show: { transition: { staggerChildren: 0.08 } } },
    item: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } },
  };

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of all clients, projects, and revenue</p>
      </div>

      {/* KPI cards */}
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <motion.div variants={stagger.item}>
          <Card className="card-hover">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Active Clients</p>
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{activeClients}</p>
              <p className="text-xs text-muted-foreground mt-1">+8 this quarter</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item}>
          <Card className="card-hover">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                  <FolderKanban className="w-4 h-4 text-primary-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{projects.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{projects.filter(p => p.status === 'in_progress').length} in progress</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item}>
          <Card className="card-hover">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Revenue Collected</p>
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-green-600" />
                </div>
              </div>
              <div className="text-2xl font-bold">
                <PriceDisplay amount={totalRevenue} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <PriceDisplay amount={pendingRevenue} compact /> pending
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item}>
          <Card className="card-hover">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Overdue Invoices</p>
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
              </div>
              <p className="text-2xl font-bold">{overdueInvoices.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Require follow-up</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue ({currency})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${currency} ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: unknown) => formatCurrency(Number(v), currency)} />
                <Bar dataKey="revenue" fill="#2D6A4F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project status pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  labelLine={false}
                >
                  {statusBreakdown.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent projects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects.slice(0, 8).map((project) => {
              const progress = getProjectProgress(project.phases);
              return (
                <div key={project.id} className="flex items-center gap-4 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{project.title}</p>
                      <span className={`status-badge text-xs ${statusColor(project.status)}`}>
                        {statusLabel(project.status)}
                      </span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right flex-shrink-0">{progress}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
