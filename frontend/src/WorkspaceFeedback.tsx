import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface Notification {
  message: string;
  tone: 'success' | 'danger';
}

export function WorkspaceNotification({ notification }: { notification?: Notification }) {
  const Icon = notification?.tone === 'danger' ? CircleAlert : CircleCheck;
  return <div className="workspace-notification" role="status">
    {notification && <span className={`workspace-notification-content ${notification.tone}`}>
      <Icon size={18} aria-hidden="true" /> {notification.message}
    </span>}
  </div>;
}

export function WorkspaceDialog({ title, pending = false, size, onClose, children }: {
  title: string; pending?: boolean; size?: 'compact' | 'wide'; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    element.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className={`workspace-dialog${size ? ` workspace-dialog-${size}` : ''}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <header className="workspace-dialog-header">
      <h2 id={titleId}>{title}</h2>
      <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose} disabled={pending}><X size={20} /></button>
    </header>
    {children}
  </dialog>;
}
