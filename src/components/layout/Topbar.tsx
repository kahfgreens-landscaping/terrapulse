// src/components/layout/Topbar.tsx
import { useNavigate } from 'react-router-dom';
import { Search, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getInitials } from '@/lib/utils';
import { CurrencySelector } from './CurrencySelector';
import { NotificationDropdown } from './NotificationDropdown';

export function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark((d) => !d);
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search projects, messages..."
          className="pl-9 bg-muted border-0 h-9"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Currency Switcher */}
        <CurrencySelector />

        {/* Dark mode */}
        <Button variant="ghost" size="icon" onClick={toggleDark}>
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notifications Dropdown */}
        <NotificationDropdown />

        {/* Avatar */}
        <button onClick={() => navigate('/settings')} className="ml-1">
          <Avatar className="w-8 h-8 ring-2 ring-primary-200 ring-offset-1">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="text-xs">
              {user ? getInitials(user.name) : 'U'}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
}
