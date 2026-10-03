// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthInit } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Pages
import { LoginPage } from '@/app/auth/LoginPage';
import { OnboardingPage } from '@/app/auth/OnboardingPage';
import { DashboardPage } from '@/app/dashboard/DashboardPage';
import { ProjectsPage } from '@/app/projects/ProjectsPage';
import { ProjectDetailPage } from '@/app/projects/ProjectDetailPage';
import { DesignsPage } from '@/app/designs/DesignsPage';
import { GalleryPage } from '@/app/gallery/GalleryPage';
import { MessagesPage } from '@/app/messages/MessagesPage';
import { DocumentsPage } from '@/app/documents/DocumentsPage';
import { MaintenancePage } from '@/app/maintenance/MaintenancePage';
import { FeedbackPage } from '@/app/feedback/FeedbackPage';
import { AdminPage } from '@/app/admin/AdminPage';
import { RegisterPage } from '@/app/auth/RegisterPage';
import { PublicProjectsPage } from '@/app/projects/PublicProjectsPage';
import { ProjectRequestsPage } from '@/app/admin/ProjectRequestsPage';
import { CreatePMPage } from '@/app/admin/CreatePMPage';
import { SettingsPage } from '@/app/settings/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

function AuthInit({ children }: { children: React.ReactNode }) {
  useAuthInit();
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInit>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Protected app routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/designs" element={<DesignsPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
                            <Route path="/showcase" element={<PublicProjectsPage />} />
              
              <Route path="/admin/requests" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ProjectRequestsPage />
                </ProtectedRoute>
              } />
              
              <Route path="/admin/create-pm" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CreatePMPage />
                </ProtectedRoute>
              } />

              <Route path="/settings" element={<SettingsPage />} />

              {/* Admin only */}
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthInit>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
