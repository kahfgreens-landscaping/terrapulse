// src/components/layout/NotificationDropdown.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, FolderKanban, MessageCircle, Palette, FileText,
  UserCheck, ExternalLink, Trash2, CheckCircle2
} from 'lucide-react';
import {
  collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationStore } from '@/store/notification.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelative, cn } from '@/lib/utils';
import type { Notification } from '@/types';

export function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, setNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();

  // Real-time Firestore subscription for current user's notifications
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: Notification[] = [];
        snapshot.forEach((d) => {
          notifs.push({ id: d.id, ...d.data() } as Notification);
        });
        setNotifications(notifs);
      },
      (error) => {
        console.warn('Notification snapshot warning:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, setNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (notif: Notification) => {
    // Mark as read in Firestore
    if (!notif.read) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
        markAsRead(notif.id);
      } catch (err) {
        console.error('Error marking notification read:', err);
      }
    }

    setIsOpen(false);

    // Navigate to appropriate target
    if (notif.projectId) {
      navigate(`/projects/${notif.projectId}`);
    } else if (notif.type === 'message') {
      navigate('/messages');
    } else if (notif.type === 'design') {
      navigate('/designs');
    }
  };

  const handleMarkAllRead = async () => {
    markAllAsRead();
    if (!user?.uid) return;

    try {
      const batch = writeBatch(db);
      notifications
        .filter((n) => !n.read)
        .forEach((n) => {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        });
      await batch.commit();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getNotifIcon = (type: Notification['type']) => {
    switch (type) {
      case 'project_assigned':
        return <UserCheck className="w-4 h-4 text-primary-600" />;
      case 'message':
        return <MessageCircle className="w-4 h-4 text-blue-600" />;
      case 'design':
        return <Palette className="w-4 h-4 text-purple-600" />;
      case 'invoice':
        return <FileText className="w-4 h-4 text-amber-600" />;
      default:
        return <Bell className="w-4 h-4 text-primary-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 md:w-96 rounded-2xl bg-card border border-border shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-foreground">Notifications</h4>
                {unreadCount > 0 && (
                  <Badge variant="default" className="text-[10px] h-5 px-1.5">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto divide-y divide-border/60 max-h-96">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary-600" />
                  <p className="text-xs font-semibold text-foreground">No notifications yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Project updates and team messages will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'p-3.5 hover:bg-muted/60 transition-colors cursor-pointer flex gap-3 items-start relative',
                      !n.read ? 'bg-primary-50/40 dark:bg-primary-950/20' : ''
                    )}
                  >
                    <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                      {getNotifIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-xs font-semibold truncate', !n.read ? 'text-primary-900 dark:text-primary-200' : 'text-foreground')}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/75 mt-1">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-border bg-muted/20 text-center">
              <span className="text-[11px] text-muted-foreground">
                TerraPulse Real-time Alert Dispatcher
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
