// src/components/layout/Sidebar.tsx
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  Palette,
  Camera,
  MessageCircle,
  FileText,
  Calendar,
  Star,
  BarChart3,
  Bell,
  LogOut,
  ChevronLeft,
  Leaf,
  Settings,
Globe, UserPlus, FileQuestion } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationStore } from '@/store/notification.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, getInitials } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: number;
}

const clientNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'My Projects', to: '/projects', icon: FolderKanban },
  { label: 'Designs', to: '/designs', icon: Palette },
  { label: 'Gallery', to: '/gallery', icon: Camera },
  { label: 'Messages', to: '/messages', icon: MessageCircle },
  { label: 'Documents', to: '/documents', icon: FileText },
  { label: 'Maintenance', to: '/maintenance', icon: Calendar },
  { label: 'Feedback', to: '/feedback', icon: Star },
  { label: 'Showcase', to: '/showcase', icon: Globe },
];

const pmNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Designs', to: '/designs', icon: Palette },
  { label: 'Gallery', to: '/gallery', icon: Camera },
  { label: 'Messages', to: '/messages', icon: MessageCircle },
  { label: 'Maintenance', to: '/maintenance', icon: Calendar },
  { label: 'Showcase', to: '/showcase', icon: Globe },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'All Projects', to: '/projects', icon: FolderKanban },
  { label: 'Project Requests', to: '/admin/requests', icon: FileQuestion },
  { label: 'Create PM', to: '/admin/create-pm', icon: UserPlus },
  { label: 'Designs', to: '/designs', icon: Palette },
  { label: 'Messages', to: '/messages', icon: MessageCircle },
  { label: 'Admin Panel', to: '/admin', icon: BarChart3 },
  { label: 'Showcase', to: '/showcase', icon: Globe },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const { unreadCount } = useNotificationStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  let filteredNav: NavItem[] = [];
  if (user?.role === 'client') filteredNav = clientNav;
  else if (user?.role === 'pm') filteredNav = pmNav;
  else if (user?.role === 'admin') filteredNav = adminNav;

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-green-dark border-r border-white/10 flex flex-col z-40 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white/10 p-1">
          <img src="/logo.png" alt="TerraPulse" className="w-full h-full object-contain" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-white font-display font-bold text-lg whitespace-nowrap"
            >
              TerraPulse
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className="ml-auto text-white/60 hover:text-white transition-colors"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {filteredNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
                isActive
                  ? 'bg-accent text-green-dark shadow-md'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {item.label === 'Messages' && unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <button
          onClick={() => navigate('/notifications')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
            'text-white/70 hover:text-white hover:bg-white/10 transition-all relative'
          )}
          title={collapsed ? 'Notifications' : undefined}
        >
          <Bell className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Notifications</span>}
          {unreadCount > 0 && (
            <span className="absolute top-2 left-7 bg-red-500 w-2 h-2 rounded-full" />
          )}
        </button>

        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>

        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="text-xs bg-white/20 text-white">
              {user ? getInitials(user.name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                <p className="text-white/50 text-xs capitalize">{user?.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleLogout}
            className="text-white/50 hover:text-red-400 transition-colors flex-shrink-0"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
