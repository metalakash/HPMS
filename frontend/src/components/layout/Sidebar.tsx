import { useEffect } from 'react';
import { NavLink } from 'react-router';
import { Droplets, X } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { cn } from '@/utils/cn';
import { visibleNavItems } from './navigation';

export function Sidebar() {
  const roles = useAuthStore((s) => s.user?.roles);
  const open = useUIStore((s) => s.sidebarOpen);
  const setOpen = useUIStore((s) => s.setSidebarOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <>
      {/* Backdrop for the off-canvas drawer below lg */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn('fixed inset-0 z-30 bg-black/40 lg:hidden', !open && 'hidden')}
      />
      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform',
          'lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-4">
          <span className="flex items-center gap-2 font-semibold">
            <Droplets className="size-5 text-primary" aria-hidden="true" />
            HPMS
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 hover:bg-surface-2 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {visibleNavItems(roles).map(({ to, label, icon: Icon, available }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                      isActive ? 'bg-primary-soft text-primary' : 'text-fg hover:bg-surface-2',
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {!available && <span className="text-xs font-normal text-muted">Soon</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
