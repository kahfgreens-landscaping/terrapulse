// src/components/layout/AppLayout.tsx
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Capacitor } from '@capacitor/core';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setCollapsed(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarWidth = collapsed ? 72 : 260;

  // On native mobile, use bottom tabs instead of sidebar
  if (isNative) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </div>
        {/* Mobile bottom navigation would go here */}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <motion.main
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <Topbar />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </motion.main>
    </div>
  );
}
