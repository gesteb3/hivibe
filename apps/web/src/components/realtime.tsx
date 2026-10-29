"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, Bell, Check, CheckCheck, Heart, LoaderCircle, MessageCircle, MessageSquare, Plus, Send, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/components/session";

type Actor = { id: string; username: string; displayName: string; avatarUrl?: string | null };
type Conversation = { id: string; starterId: string; receiverId: string; starter: Actor; receiver: Actor; createdAt: string; updatedAt: string };
type Message = { id: string; conversationId: string; senderId: string; content: string; createdAt: string };
type NoticeType = "LIKE" | "COMMENT" | "FOLLOW" | "COMMENT_REPLY" | "COMMENT_LIKE";
type Notice = { id: string; type: NoticeType; actorId: string; actor: Actor; postId?: string | null; commentId?: string | null; isRead: boolean; createdAt: string };

const errorText = (error: unknown) => error instanceof Error ? error.message : "Algo salió mal. Inténtalo otra vez.";
const mergeMessages = (current: Message[], incoming: Message[]) => [...new Map([...current, ...incoming].map(message => [message.id, message])).values()]
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
const mergeNotices = (current: Notice[], incoming: Notice[]) => [...new Map([...current, ...incoming].map(notice => [notice.id, { ...notice, isRead: notice.isRead || current.some(item => item.id === notice.id && item.isRead) }])).values()]
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
const fullDate = (value: string) => new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

function ChatAvatar({ person }: { person: Actor }) {
  return person.avatarUrl
    ? <img className="avatar" src={person.avatarUrl} width={42} height={42} alt="" />
    : <span className="avatar avatar-fallback" aria-hidden="true">{(person.displayName || person.username).slice(0, 2).toUpperCase()}</span>;
}

export function MessagesView() {
  const { user, markConversationRead } = useSession();
  const search = useSearchParams();
  const recipientId = search.get("to");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState("");
  const [sendError, setSendError] = useState("");
  const activeRef = useRef<string | null>(null);
  const requestedRecipient = useRef<string | null>(null);
  const historyGeneration = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollSnapshot = useRef<{ height: number; top: number } | null>(null);

  const otherPerson = useCallback((conversation: Conversation) => conversation.starterId === user?.id ? conversation.receiver : conversation.starter, [user?.id]);
  const active = conversations.find(conversation => conversation.id === activeId);
  const partner = active ? otherPerson(active) : null;

  const markVisibleRead = useCallback(() => {
    const id = activeRef.current;
    if (!id || document.visibilityState !== "visible" || !document.hasFocus()) return;
    void markConversationRead(id).catch(() => {});
  }, [markConversationRead]);

  useEffect(() => {
    if (activeId && !historyLoading) markVisibleRead();
    window.addEventListener("focus", markVisibleRead);
    document.addEventListener("visibilitychange", markVisibleRead);
    return () => { window.removeEventListener("focus", markVisibleRead); document.removeEventListener("visibilitychange", markVisibleRead); };
  }, [activeId, historyLoading, markVisibleRead]);

  const loadConversations = useCallback(async () => {
    const result = await api<Conversation[]>("/chat/conversations");
    setConversations(result);
    return result;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void loadConversations().catch(error => { if (!cancelled) setError(errorText(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, loadConversations]);

  const loadHistory = useCallback(async (id: string) => {
    const generation = ++historyGeneration.current;
    setHistoryLoading(true);
    setError("");
    try {
      const result = await api<Message[]>(`/chat/conversations/${encodeURIComponent(id)}/messages?limit=50`);
      if (activeRef.current !== id || generation !== historyGeneration.current) return;
      // Una reconexión recupera una ventana reciente completa. El resto sigue disponible por cursor.
      setMessages(current => mergeMessages(result, current.filter(message => message.conversationId === id && (!result.length || message.createdAt >= result[0].createdAt))));
      setHasOlder(result.length === 50);
      if (result.length) setPreviews(current => ({ ...current, [id]: result[result.length - 1].content }));
    } catch (error) {
      if (activeRef.current === id && generation === historyGeneration.current) setError(errorText(error));
    } finally {
      if (activeRef.current === id && generation === historyGeneration.current) setHistoryLoading(false);
    }
  }, []);

  const selectConversation = useCallback((id: string) => {
    if (id === activeRef.current) return;
    activeRef.current = id;
    setActiveId(id);
    setMessages([]);
    setDraft("");
    setSendError("");
    setHasOlder(false);
    setOlderLoading(false);
    scrollSnapshot.current = null;
    void loadHistory(id);
  }, [loadHistory]);

  const startConversation = useCallback(async (id: string) => {
    if (id === user?.id) throw new Error("Elige a otro cuate para empezar a conversar.");
    const conversation = await api<{ id: string }>("/chat/conversations", { method: "POST", body: { recipientId: id } });
    await loadConversations();
    selectConversation(conversation.id);
  }, [user?.id, loadConversations, selectConversation]);

  useEffect(() => {
    if (!recipientId || !user) return;
    const key = `${user.id}:${recipientId}`;
    if (requestedRecipient.current === key) return;
    requestedRecipient.current = key;
    setStarting(true);
    setStartError("");
    void startConversation(recipientId).catch(error => setStartError(errorText(error)))
      .finally(() => setStarting(false));
  }, [recipientId, user, startConversation]);

  useEffect(() => {
    if (!user) return;
    const receive = (event: Event) => {
      const message = (event as CustomEvent<Message>).detail;
      if (!message?.id) return;
      if (activeRef.current === message.conversationId) { setMessages(current => mergeMessages(current, [message])); markVisibleRead(); }
      setPreviews(current => ({ ...current, [message.conversationId]: message.content }));
      setConversations(current => current.map(conversation => conversation.id === message.conversationId
        ? { ...conversation, updatedAt: message.createdAt } : conversation).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      void loadConversations().catch(error => setError(errorText(error)));
    };
    const reconnect = () => {
      void loadConversations().catch(error => setError(errorText(error)));
      if (activeRef.current) void loadHistory(activeRef.current);
    };
    window.addEventListener("hivibe:message", receive);
    window.addEventListener("hivibe:reconnect", reconnect);
    return () => {
      window.removeEventListener("hivibe:message", receive);
      window.removeEventListener("hivibe:reconnect", reconnect);
    };
  }, [user?.id, loadConversations, loadHistory, markVisibleRead]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (scrollSnapshot.current) {
      list.scrollTop = scrollSnapshot.current.top + list.scrollHeight - scrollSnapshot.current.height;
      scrollSnapshot.current = null;
    } else list.scrollTop = list.scrollHeight;
  }, [messages]);

  async function findPana(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = username.trim().replace(/^@/, "");
    if (!value || starting) return;
    setStarting(true); setStartError("");
    try {
      const person = await api<Actor>(`/users/${encodeURIComponent(value)}`);
      await startConversation(person.id);
      setUsername("");
    } catch (error) { setStartError(errorText(error)); }
    finally { setStarting(false); }
  }

  async function loadOlder() {
    const id = activeRef.current;
    const oldest = messages[0];
    if (!id || !oldest || olderLoading || historyLoading) return;
    const generation = historyGeneration.current;
    setOlderLoading(true); setError("");
    try {
      const result = await api<Message[]>(`/chat/conversations/${encodeURIComponent(id)}/messages?limit=50&before=${encodeURIComponent(oldest.id)}`);
      if (activeRef.current !== id || generation !== historyGeneration.current) return;
      if (listRef.current && result.length) scrollSnapshot.current = { height: listRef.current.scrollHeight, top: listRef.current.scrollTop };
      setMessages(current => mergeMessages(current, result));
      setHasOlder(result.length === 50);
    } catch (error) { if (activeRef.current === id) setError(errorText(error)); }
    finally { if (activeRef.current === id) setOlderLoading(false); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = activeRef.current;
    const content = draft.trim();
    if (!id || !content || sending) return;
    setSending(true); setSendError("");
    try {
      const message = await api<Message>(`/chat/conversations/${encodeURIComponent(id)}/messages`, { method: "POST", body: { content } });
      if (activeRef.current === id) {
        setMessages(current => mergeMessages(current, [message]));
        setDraft(current => current.trim() === content ? "" : current);
      }
      setPreviews(current => ({ ...current, [id]: content }));
      void loadConversations().catch(error => setError(errorText(error)));
    } catch (error) { if (activeRef.current === id) setSendError(errorText(error)); }
    finally { setSending(false); }
  }

  return <div className="stack messages-view">
    <div className="section-title"><div><h1>Mensajes</h1></div><MessageCircle size={32} aria-hidden="true" /></div>
    <div className="panel chat-new"><div className="panel-heading"><span><Plus size={16} /> Nueva conversación</span></div>
      <form className="panel-body form-row" onSubmit={findPana}><label className="sr-only" htmlFor="chat-username">Alias exacto de tu cuate</label><input id="chat-username" className="field" autoComplete="off" placeholder="@alias de tu cuate" value={username} onChange={event => setUsername(event.target.value)} maxLength={30} required /><button className="btn btn-primary" disabled={starting || !username.trim()}>{starting ? <LoaderCircle size={16} className="spin" /> : <MessageSquare size={16} />} Escribir</button></form>
      {startError && <p className="error-message" role="alert">{startError}</p>}
    </div>
    <section className={`panel chat-layout${activeId ? " has-active-chat" : ""}`} aria-label="Mensajes privados">
      <aside className="conversation-list"><div className="panel-heading"><span>Mis conversaciones</span><span className="muted">{conversations.length}</span></div>
        {loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" size={20} /> Cargando tus conversaciones…</div>
          : conversations.length === 0 ? <div className="empty-state"><MessageCircle size={28} /><h3>Sin conversaciones</h3><p className="muted">Busca un usuario por su alias para iniciar una conversación.</p></div>
          : conversations.map(conversation => { const person = otherPerson(conversation); return <button key={conversation.id} className={`conversation-item${activeId === conversation.id ? " active" : ""}`} onClick={() => selectConversation(conversation.id)} aria-current={activeId === conversation.id ? "true" : undefined}><ChatAvatar person={person} /><span className="conversation-copy"><strong>{person.displayName || person.username}</strong><span className="muted">{previews[conversation.id] || `@${person.username}`}</span></span></button>; })}
      </aside>
      <div className="chat-main">
        {partner && activeId ? <>
          <div className="panel-heading chat-heading"><button className="btn btn-small chat-back" aria-label="Volver a conversaciones" onClick={() => { activeRef.current = null; setActiveId(null); setMessages([]); }}><ArrowLeft size={16} /></button><Link href={`/perfil/${encodeURIComponent(partner.username)}`} className="chat-person"><ChatAvatar person={partner} /><span><strong>{partner.displayName || partner.username}</strong><span className="muted">@{partner.username}</span></span></Link><span className="chat-private"><ShieldCheck size={14} /> Privado</span></div>
          <div className="message-list" ref={listRef} role="log" aria-label={`Mensajes con ${partner.displayName || partner.username}`} aria-live="polite" aria-relevant="additions">
            {hasOlder && <button className="btn btn-small history-button" onClick={() => void loadOlder()} disabled={olderLoading || historyLoading}>{olderLoading ? <LoaderCircle size={14} className="spin" /> : <ArrowDown size={14} />} Mensajes anteriores</button>}
            {historyLoading && <p className="loading-state" role="status"><LoaderCircle size={18} className="spin" /> Recuperando historial…</p>}
            {!historyLoading && messages.length === 0 && <div className="empty-state"><Sparkles size={28} /><h3>No hay mensajes</h3><p className="muted">Escribe un mensaje a {partner.displayName || partner.username}.</p></div>}
            {messages.map(message => <div key={message.id} className={`message-bubble${message.senderId === user?.id ? " mine" : ""}`}><p>{message.content}</p><time dateTime={message.createdAt} title={fullDate(message.createdAt)}>{time(message.createdAt)}{message.senderId === user?.id && <Check size={12} aria-label="Guardado" />}</time></div>)}
          </div>
          {error && <div className="error-message" role="alert">{error} <button className="text-button" onClick={() => void loadHistory(activeId)}>Reintentar</button></div>}
          <form className="chat-compose" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-content">Tu mensaje</label><textarea id="chat-content" className="field" placeholder="Escribe un mensaje" rows={2} value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} required /><button className="btn btn-primary" disabled={sending || !draft.trim() || historyLoading} aria-label="Enviar mensaje">{sending ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}<span>Enviar</span></button><div className="chat-compose-meta"><span className="muted">{draft.length}/2000</span>{sendError && <span className="error-message" role="alert">{sendError}</span>}</div></form>
        </> : <div className="empty-state chat-welcome"><div className="chat-welcome-icon"><MessageCircle size={44} /><Sparkles size={20} /></div><h2>Selecciona una conversación</h2><p className="muted">Busca un usuario por su alias para enviarle un mensaje.</p>{error && <p className="error-message" role="alert">{error} <button className="text-button" onClick={() => { setError(""); void loadConversations().catch(error => setError(errorText(error))); }}>Reintentar</button></p>}</div>}
      </div>
    </section>
  </div>;
}


const noticeContent = {
  LIKE: { Icon: Heart, text: 'reaccionó a tu publicación', category: 'Nitido', className: 'notice-like' },
  COMMENT: { Icon: MessageSquare, text: 'comentó tu publicación', category: 'Comentario', className: 'notice-comment' },
  COMMENT_REPLY: { Icon: MessageSquare, text: 'respondió a tu comentario', category: 'Respuesta', className: 'notice-comment' },
  COMMENT_LIKE: { Icon: Heart, text: 'reaccionó a tu comentario', category: 'Nitido en comentario', className: 'notice-like' },
  FOLLOW: { Icon: UserPlus, text: 'ahora es tu seguidor', category: 'Nuevo seguidor', className: 'notice-follow' },
};
function validNotice(value: unknown): value is Notice {
  const notice = value as Partial<Notice> | null;
  return !!notice && typeof notice.id === 'string' && typeof notice.createdAt === 'string' && !!notice.type && Object.hasOwn(noticeContent, notice.type)
    && !!notice.actor && typeof notice.actor.username === 'string';
}
function noticeTarget(notice: Notice) {
  if (notice.type === 'FOLLOW') return '/perfil/' + encodeURIComponent(notice.actor.username);
  if (notice.postId) return '/feed?post=' + encodeURIComponent(notice.postId)
    + (notice.commentId ? '&comment=' + encodeURIComponent(notice.commentId) : '');
  return '/perfil/' + encodeURIComponent(notice.actor.username);
}

export function NotificationsView() {
  const { user, unread, refreshUnread } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const generation = useRef(0);
  const mounted = useRef(false);
  const readIds = useRef(new Set<string>());
  const pageRef = useRef(1);

  const merge = useCallback((incoming: Notice[]) => {
    setNotices(current => mergeNotices(current, incoming.filter(validNotice).map(notice => ({
      ...notice, isRead: notice.isRead || readIds.current.has(notice.id),
    }))));
  }, []);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await api<Notice[]>('/notifications?page=1&limit=20');
      if (!mounted.current || request !== generation.current) return;
      merge(result);
      // Si se cargaron más páginas no se retrocede el cursor al reconciliar la primera.
      if (pageRef.current === 1) setHasMore(result.length === 20);
      setError('');
      await refreshUnread();
    } catch (cause) {
      if (mounted.current && request === generation.current) setError(errorText(cause));
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }, [merge, refreshUnread]);

  useEffect(() => {
    if (!user) return;
    mounted.current = true;
    setLoading(true); setNotices([]); setPage(1); pageRef.current = 1;
    setHasMore(false); readIds.current.clear();
    void refresh();
    const receive = (event: Event) => {
      const notice = (event as CustomEvent<unknown>).detail;
      if (validNotice(notice)) merge([notice]);
      // Releer del servidor también recupera eventos recibidos sin actor o durante navegación.
      void refresh();
    };
    const reconcile = () => { if (document.visibilityState === 'visible') void refresh(); };
    const read = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) {
        readIds.current.add(id);
        setNotices(current => current.map(notice => notice.id === id ? { ...notice, isRead: true } : notice));
      }
      void refreshUnread();
    };
    window.addEventListener('hivibe:notification', receive);
    window.addEventListener('hivibe:notification-read', read);
    window.addEventListener('hivibe:reconnect', reconcile);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      mounted.current = false; generation.current++;
      window.removeEventListener('hivibe:notification', receive);
      window.removeEventListener('hivibe:notification-read', read);
      window.removeEventListener('hivibe:reconnect', reconcile);
      window.removeEventListener('focus', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
    };
  }, [user?.id, refresh, merge, refreshUnread]);

  async function markRead(notice: Notice) {
    if (notice.isRead || busyIds.includes(notice.id)) return;
    setBusyIds(current => [...current, notice.id]);
    try {
      await api('/notifications/' + encodeURIComponent(notice.id) + '/read', { method: 'PATCH' });
      readIds.current.add(notice.id);
      if (mounted.current) setNotices(current => current.map(item => item.id === notice.id ? { ...item, isRead: true } : item));
      window.dispatchEvent(new CustomEvent('hivibe:notification-read', { detail: { id: notice.id } }));
    } catch (cause) { if (mounted.current) setError(errorText(cause)); }
    finally { if (mounted.current) setBusyIds(current => current.filter(id => id !== notice.id)); }
  }
  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const request = generation.current;
    try {
      const next = pageRef.current + 1;
      const result = await api<Notice[]>('/notifications?page=' + next + '&limit=20');
      if (!mounted.current || request !== generation.current) return;
      merge(result); setPage(next); pageRef.current = next; setHasMore(result.length === 20);
    } catch (cause) { if (mounted.current) setError(errorText(cause)); }
    finally { if (mounted.current) setLoadingMore(false); }
  }

  return <div className="stack notifications-view">
    <div className="section-title"><div><h1>Notificaciones</h1></div><Bell size={32} aria-hidden="true" /></div>
    <section className="panel">
      <div className="panel-heading"><span><Bell size={16} /> Tus notificaciones</span><span className="muted">{unread ? unread + ' sin leer' : 'Todo al día'}</span></div>
      {error && <div className="error-message" role="alert">{error} <button className="text-button" onClick={() => void refresh()}>Reintentar</button></div>}
      {loading && notices.length === 0 ? <div className="loading-state" role="status"><LoaderCircle size={20} className="spin" /> Cargando notificaciones…</div>
        : notices.length === 0 && !error ? <div className="empty-state"><Bell size={36} /><h2>No hay notificaciones</h2><p className="muted">Las reacciones, comentarios y seguidores aparecerán aquí.</p><Link className="btn btn-primary" href="/feed">Ir al feed <ArrowLeft size={16} /></Link></div>
        : <div className="notification-list">{notices.map(notice => {
          const content = noticeContent[notice.type];
          const Icon = content.Icon;
          return <article key={notice.id} className={'notification-item ' + content.className + (notice.isRead ? '' : ' unread')}>
            <Link href={'/perfil/' + encodeURIComponent(notice.actor.username)} aria-label={'Ver perfil de ' + (notice.actor.displayName || notice.actor.username)}><ChatAvatar person={notice.actor} /></Link>
            <div className="notification-copy"><span className="eyebrow"><Icon size={13} /> {content.category}</span><Link href={noticeTarget(notice)} onClick={() => void markRead(notice)}><strong>{notice.actor.displayName || notice.actor.username}</strong> {content.text}.</Link><time className="muted" dateTime={notice.createdAt}>{fullDate(notice.createdAt)}</time></div>
            {!notice.isRead ? <button className="btn btn-small notice-read" disabled={busyIds.includes(notice.id)} onClick={() => void markRead(notice)} aria-label="Marcar notificación como leída" title="Marcar como leída">{busyIds.includes(notice.id) ? <LoaderCircle size={16} className="spin" /> : <CheckCheck size={16} />}</button> : <Check size={16} className="muted notice-read" aria-label="Leída" />}
          </article>;
        })}</div>}
      {hasMore && <div className="panel-body"><button className="btn" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore && <LoaderCircle size={16} className="spin" />} Ver notificaciones anteriores</button></div>}
    </section>
  </div>;
}
