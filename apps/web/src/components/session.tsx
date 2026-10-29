'use client';

import Link from 'next/link';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

type SocialNotice = { id: string; type: string };
type IncomingMessage = {
  id: string; conversationId: string; senderId: string; content: string; createdAt: string;
  sender?: { id: string; username: string; displayName: string; avatarUrl?: string | null };
};
type MessageToast = IncomingMessage & { expiresAt: number };
type Session = {
  user: User | null; loading: boolean; error: string; refresh: () => Promise<void>;
  logout: () => Promise<void>; connected: boolean; online: Set<string>; unread: number;
  messageUnread: number; refreshUnread: () => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
};
const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [unread, setUnread] = useState(0);
  const [messageUnread, setMessageUnread] = useState(0);
  const [toasts, setToasts] = useState<MessageToast[]>([]);
  const socket = useRef<Socket | null>(null);
  const activeUser = useRef<string | null>(null);
  const countGeneration = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);
  const clearSession = useCallback(() => {
    activeUser.current = null;
    countGeneration.current++;
    socket.current?.disconnect();
    setUser(null); setUnread(0); setMessageUnread(0); setOnline(new Set()); setToasts([]);
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>('/users/me');
      activeUser.current = me.id;
      setUser(me); setError('');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) clearSession();
      else setError(cause instanceof Error ? cause.message : 'No se pudo cargar la sesión.');
    } finally { setLoading(false); }
  }, [clearSession]);

  const refreshUnread = useCallback(async () => {
    const owner = activeUser.current;
    if (!owner) return;
    const generation = ++countGeneration.current;
    // Consultar contadores dedicados: una página de 20/50 avisos nunca representa el total.
    const result = await Promise.allSettled([
      api<{ count: number }>('/notifications/unread'),
      api<{ count: number }>('/chat/unread'),
    ]);
    if (owner !== activeUser.current || generation !== countGeneration.current) return;
    if (result[0].status === 'fulfilled') setUnread(Math.max(0, result[0].value.count));
    if (result[1].status === 'fulfilled') setMessageUnread(Math.max(0, result[1].value.count));
  }, []);

  const markConversationRead = useCallback(async (conversationId: string) => {
    await api('/chat/conversations/' + encodeURIComponent(conversationId) + '/read', { method: 'PATCH' });
    await refreshUnread();
  }, [refreshUnread]);

  const logout = useCallback(async () => {
    const response = await fetch('/api/logout', { method: 'POST' });
    if (!response.ok) throw new Error('No se pudo cerrar sesión.');
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    void refresh();
    const expire = () => clearSession();
    window.addEventListener('hivibe:unauthorized', expire);
    return () => window.removeEventListener('hivibe:unauthorized', expire);
  }, [refresh, clearSession]);

  useEffect(() => {
    if (!user) return;
    activeUser.current = user.id;
    let disposed = false;
    let hasConnected = false;
    const seenMessages = new Set<string>();
    const seenNotices = new Set<string>();
    const emit = (name: string, data: unknown) => window.dispatchEvent(new CustomEvent(name, { detail: data }));
    const sync = () => { if (!disposed) void refreshUnread(); };
    sync();
    void fetch('/api/socket-token', { cache: 'no-store' }).then(response => response.json()).then(({ token }) => {
      if (disposed || !token) return;
      const client = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4300', {
        auth: { token }, autoConnect: false, reconnection: true,
      });
      socket.current = client;
      client.on('connect', () => {
        if (disposed) return;
        setConnected(true); sync();
        if (hasConnected) emit('hivibe:reconnect', {});
        hasConnected = true;
      });
      client.on('disconnect', reason => {
        if (disposed) return;
        setConnected(false);
        if (reason === 'io server disconnect') void refresh();
      });
      client.on('connect_error', () => { if (!disposed) setConnected(false); });
      client.on('post:counts', data => emit('hivibe:counts', data));
      client.on('comment:changed', data => emit('hivibe:comment-changed', data));
      client.on('presence:snapshot', ({ userIds }: { userIds: string[] }) => setOnline(new Set(userIds)));
      client.on('presence:update', ({ userId, online }: { userId: string; online: boolean }) => {
        setOnline(current => { const next = new Set(current); if (online) next.add(userId); else next.delete(userId); return next; });
      });
      client.on('chat:new', (message: IncomingMessage) => {
        if (disposed || !message?.id || seenMessages.has(message.id)) return;
        seenMessages.add(message.id);
        if (seenMessages.size > 300) seenMessages.delete(seenMessages.values().next().value!);
        emit('hivibe:message', message);
        if (message.senderId !== user.id) {
          setToasts(current => {
            const next = [...current, { ...message, expiresAt: Date.now() + 10000 }].slice(-3);
            const keep = new Set(next.map(toast => toast.id));
            for (const previous of current) if (!keep.has(previous.id)) {
              clearTimeout(timers.current.get(previous.id)); timers.current.delete(previous.id);
            }
            return next;
          });
          timers.current.set(message.id, setTimeout(() => dismissToast(message.id), 10000));
          sync();
        }
      });
      client.on('chat:unread', ({ count }: { count: number }) => {
        countGeneration.current++;
        setMessageUnread(Math.max(0, count));
        // Invalidar respuestas antiguas y volver a conciliar ambos contadores.
        sync();
      });
      client.on('chat:read', (data: { conversationId: string }) => {
        emit('hivibe:message-read', data); sync();
      });
      client.on('notification:new', (notice: SocialNotice) => {
        if (disposed || !notice?.id || notice.type === 'MESSAGE' || seenNotices.has(notice.id)) return;
        seenNotices.add(notice.id);
        if (seenNotices.size > 300) seenNotices.delete(seenNotices.values().next().value!);
        emit('hivibe:notification', notice);
        sync();
      });
      client.on('notification:read', data => { emit('hivibe:notification-read', data); sync(); });
      client.connect();
    }).catch(() => { if (!disposed) setConnected(false); });
    const visible = () => { if (document.visibilityState === 'visible') sync(); };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('hivibe:notification-read', sync);
    const reconcile = setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 30000);
    return () => {
      disposed = true; clearInterval(reconcile);
      socket.current?.disconnect(); socket.current = null; setConnected(false);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('hivibe:notification-read', sync);
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear(); setToasts([]);
    };
  }, [user?.id, refresh, refreshUnread, dismissToast]);

  return <Context.Provider value={{ user, loading, error, refresh, logout, connected, online, unread, messageUnread, refreshUnread, markConversationRead }}>
    {children}
    {toasts.length > 0 && <aside className="message-toasts" aria-label="Mensajes nuevos" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => <div className="message-toast" key={toast.id}>
        <MessageCircle size={18} aria-hidden="true" />
        <Link className="message-toast-link" href={'/mensajes?to=' + encodeURIComponent(toast.senderId)} onClick={() => dismissToast(toast.id)}>
          <strong>{toast.sender?.displayName || toast.sender?.username || 'Nuevo mensaje'}</strong>
          <span>{toast.content}</span>
        </Link>
        <button type="button" className="message-toast-close icon-button" aria-label="Cerrar aviso de mensaje" onClick={() => dismissToast(toast.id)}><X size={16} /></button>
      </div>)}
    </aside>}
  </Context.Provider>;
}
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error('Falta SessionProvider');
  return session;
}
