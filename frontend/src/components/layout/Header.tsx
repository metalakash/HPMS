import { useNavigate } from 'react-router';
import { LogOut, Menu } from 'lucide-react';
import { authApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { NotificationBell } from './NotificationBell';
import { LanguageToggle, ThemeToggle } from './Toggles';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Stateless JWT: the server call is informational, so don't block on it.
    void authApi.logout().catch(() => undefined);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="rounded-md p-2 hover:bg-surface-2 lg:hidden"
        aria-label="Open navigation"
        aria-controls="app-sidebar"
        aria-expanded={sidebarOpen}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <div className="flex-1" />
      <LanguageToggle />
      <ThemeToggle />
      <NotificationBell />
      <div className="ml-2 hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{user?.full_name ?? user?.username}</p>
        <p className="text-xs text-muted">{user?.roles.join(', ')}</p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-md p-2 hover:bg-surface-2"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-5" aria-hidden="true" />
      </button>
    </header>
  );
}
