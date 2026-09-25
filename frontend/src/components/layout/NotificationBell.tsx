import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore, type ConnectionStatus } from '@/store/useNotificationStore';
import { useUIStore } from '@/store/useUIStore';
import { formatDate, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/utils/cn';

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: 'Live updates off',
  connecting: 'Connecting to live updates…',
  open: 'Live updates on',
  closed: 'Live updates disconnected, retrying',
  unauthorized: 'Live updates unavailable (server rejected the session)',
};

export function NotificationBell() {
  const { items, unread, status, markAllRead } = useNotificationStore();
  const language = useUIStore((s) => s.language);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((v) => !v);
    if (!open) markAllRead();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-md p-2 hover:bg-surface-2"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white dark:text-black">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-1 right-1 size-2 rounded-full ring-2 ring-surface',
            status === 'open' ? 'bg-success' : 'bg-muted',
          )}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface shadow-lg"
        >
          <p className="border-b border-line px-4 py-2 text-xs text-muted">{STATUS_TEXT[status]}</p>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No notifications yet</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.title ?? humanize(item.type)}</p>
                    <Badge tone={statusTone(item.priority)}>{humanize(item.priority)}</Badge>
                  </div>
                  {item.message && <p className="mt-1 text-sm text-muted">{item.message}</p>}
                  <p className="mt-1 text-xs text-muted">{formatDate(item.timestamp, language)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
