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
type Notice = { id: string; type: "LIKE" | "COMMENT" | "FOLLOW" | "MESSAGE"; actorId: string; actor: Actor; postId?: string | null; messageId?: string | null; isRead: boolean; createdAt: string };

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
  const { user } = useSession();
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
    if (id === user?.id) throw new Error("Elige a otro pana para empezar a conversar.");
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
      if (activeRef.current === message.conversationId) setMessages(current => mergeMessages(current, [message]));
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
  }, [user, loadConversations, loadHistory]);

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
    <div className="section-title"><div><p className="eyebrow">DE PANA A PANA</p><h1>Tu bandeja de secretos<span className="accent">.</span></h1><p className="muted">Una ventana abierta a tus mejores conversaciones.</p></div><MessageCircle size={32} aria-hidden="true" /></div>
    <div className="panel chat-new"><div className="panel-heading"><span><Plus size={16} /> Nueva conversación</span><span className="muted">Sin vueltas. Solo escribe.</span></div>
      <form className="panel-body form-row" onSubmit={findPana}><label className="sr-only" htmlFor="chat-username">Alias exacto de tu pana</label><input id="chat-username" className="field" autoComplete="off" placeholder="@alias de tu pana" value={username} onChange={event => setUsername(event.target.value)} maxLength={30} required /><button className="btn btn-primary" disabled={starting || !username.trim()}>{starting ? <LoaderCircle size={16} className="spin" /> : <MessageSquare size={16} />} Escribir</button></form>
      {startError && <p className="error-message" role="alert">{startError}</p>}
    </div>
    <section className={`panel chat-layout${activeId ? " has-active-chat" : ""}`} aria-label="Mensajes privados">
      <aside className="conversation-list"><div className="panel-heading"><span>Mis conversaciones</span><span className="muted">{conversations.length}</span></div>
        {loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" size={20} /> Cargando tus conversaciones…</div>
          : conversations.length === 0 ? <div className="empty-state"><MessageCircle size={28} /><h3>Rompe el hielo</h3><p className="muted">Busca el alias de un pana arriba y dile qué onda.</p></div>
          : conversations.map(conversation => { const person = otherPerson(conversation); return <button key={conversation.id} className={`conversation-item${activeId === conversation.id ? " active" : ""}`} onClick={() => selectConversation(conversation.id)} aria-current={activeId === conversation.id ? "true" : undefined}><ChatAvatar person={person} /><span className="conversation-copy"><strong>{person.displayName || person.username}</strong><span className="muted">{previews[conversation.id] || `@${person.username}`}</span></span></button>; })}
      </aside>
      <div className="chat-main">
        {partner && activeId ? <>
          <div className="panel-heading chat-heading"><button className="btn btn-small chat-back" aria-label="Volver a conversaciones" onClick={() => { activeRef.current = null; setActiveId(null); setMessages([]); }}><ArrowLeft size={16} /></button><Link href={`/perfil/${encodeURIComponent(partner.username)}`} className="chat-person"><ChatAvatar person={partner} /><span><strong>{partner.displayName || partner.username}</strong><span className="muted">@{partner.username}</span></span></Link><span className="chat-private"><ShieldCheck size={14} /> Privado</span></div>
          <div className="message-list" ref={listRef} role="log" aria-label={`Mensajes con ${partner.displayName || partner.username}`} aria-live="polite" aria-relevant="additions">
            {hasOlder && <button className="btn btn-small history-button" onClick={() => void loadOlder()} disabled={olderLoading || historyLoading}>{olderLoading ? <LoaderCircle size={14} className="spin" /> : <ArrowDown size={14} />} Mensajes anteriores</button>}
            {historyLoading && <p className="loading-state" role="status"><LoaderCircle size={18} className="spin" /> Recuperando historial…</p>}
            {!historyLoading && messages.length === 0 && <div className="empty-state"><Sparkles size={28} /><h3>Todo empieza con un «hola»</h3><p className="muted">Este es tu espacio para hablar con {partner.displayName || partner.username}.</p></div>}
            {messages.map(message => <div key={message.id} className={`message-bubble${message.senderId === user?.id ? " mine" : ""}`}><p>{message.content}</p><time dateTime={message.createdAt} title={fullDate(message.createdAt)}>{time(message.createdAt)}{message.senderId === user?.id && <Check size={12} aria-label="Guardado" />}</time></div>)}
          </div>
          {error && <div className="error-message" role="alert">{error} <button className="text-button" onClick={() => void loadHistory(activeId)}>Reintentar</button></div>}
          <form className="chat-compose" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-content">Tu mensaje</label><textarea id="chat-content" className="field" placeholder="Escribe algo que merezca un :)" rows={2} value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} required /><button className="btn btn-primary" disabled={sending || !draft.trim() || historyLoading} aria-label="Enviar mensaje">{sending ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}<span>Enviar</span></button><div className="chat-compose-meta"><span className="muted">{draft.length}/2000</span>{sendError && <span className="error-message" role="alert">{sendError}</span>}</div></form>
        </> : <div className="empty-state chat-welcome"><div className="chat-welcome-icon"><MessageCircle size={44} /><Sparkles size={20} /></div><p className="eyebrow">MENOS SCROLL, MÁS CONVERSACIÓN</p><h2>Hay cosas que se cuentan<br />entre panas.</h2><p className="muted">Elige una conversación o empieza una nueva.<br />Tus mensajes se guardan para cuando vuelvas.</p>{error && <p className="error-message" role="alert">{error} <button className="text-button" onClick={() => { setError(""); void loadConversations().catch(error => setError(errorText(error))); }}>Reintentar</button></p>}</div>}
      </div>
    </section>
  </div>;
}

const noticeContent = {
  LIKE: { Icon: Heart, text: "le dio like a tu publicación", category: "Un poquito de amor", className: "notice-like" },
  COMMENT: { Icon: MessageSquare, text: "comentó tu publicación", category: "La conversación sigue", className: "notice-comment" },
  FOLLOW: { Icon: UserPlus, text: "ahora es tu seguidor", category: "Tu círculo crece", className: "notice-follow" },
  MESSAGE: { Icon: MessageCircle, text: "te envió un mensaje", category: "Tienes algo que leer", className: "notice-message" },
};

export function NotificationsView() {
  const { user } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const result = await api<Notice[]>("/notifications?page=1&limit=20");
    setNotices(current => mergeNotices(current, result));
    setPage(1); setHasMore(result.length === 20);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void refresh().catch(error => { if (!cancelled) setError(errorText(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    const receive = (event: Event) => {
      const notice = (event as CustomEvent<Notice>).detail;
      if (notice?.id) setNotices(current => mergeNotices(current, [notice]));
    };
    const reconnect = () => { void refresh().catch(error => setError(errorText(error))); };
    window.addEventListener("hivibe:notification", receive);
    window.addEventListener("hivibe:reconnect", reconnect);
    return () => {
      cancelled = true;
      window.removeEventListener("hivibe:notification", receive);
      window.removeEventListener("hivibe:reconnect", reconnect);
    };
  }, [user, refresh]);

  async function markRead(notice: Notice) {
    if (notice.isRead || busyIds.includes(notice.id)) return;
    setBusyIds(current => [...current, notice.id]); setError("");
    try {
      const updated = await api<Notice>(`/notifications/${encodeURIComponent(notice.id)}/read`, { method: "PATCH" });
      setNotices(current => current.map(item => item.id === updated.id ? updated : item));
      window.dispatchEvent(new CustomEvent("hivibe:notification-read", { detail: { id: updated.id } }));
    } catch (error) { setError(errorText(error)); }
    finally { setBusyIds(current => current.filter(id => id !== notice.id)); }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true); setError("");
    try {
      const next = page + 1;
      const result = await api<Notice[]>(`/notifications?page=${next}&limit=20`);
      setNotices(current => mergeNotices(current, result));
      setPage(next); setHasMore(result.length === 20);
    } catch (error) { setError(errorText(error)); }
    finally { setLoadingMore(false); }
  }

  const unread = notices.filter(notice => !notice.isRead).length;
  return <div className="stack notifications-view">
    <div className="section-title"><div><p className="eyebrow">TU PEQUEÑO CENTRO DEL UNIVERSO</p><h1>Alguien se acordó de ti<span className="accent">.</span></h1><p className="muted">Likes, nuevos panas y conversaciones que siguen.</p></div><Bell size={32} aria-hidden="true" /></div>
    <section className="panel"><div className="panel-heading"><span><Sparkles size={16} /> Tus notificaciones</span><span className="muted">{unread ? `${unread} sin leer en esta lista` : "Todo al día"}</span></div>
      {error && <div className="error-message" role="alert">{error} <button className="text-button" onClick={() => { setError(""); void refresh().catch(error => setError(errorText(error))); }}>Reintentar</button></div>}
      {loading ? <div className="loading-state" role="status"><LoaderCircle size={20} className="spin" /> Buscando novedades…</div>
        : notices.length === 0 ? <div className="empty-state"><Bell size={36} /><h2>Por aquí está tranquilo</h2><p className="muted">Cuando alguien interactúe contigo, te enterarás aquí.</p><Link className="btn btn-primary" href="/feed">Ir al muro <ArrowLeft size={16} /></Link></div>
        : <div className="notification-list">{notices.map(notice => {
          const content = noticeContent[notice.type] || noticeContent.MESSAGE;
          const Icon = content.Icon;
          const target = notice.type === "MESSAGE" ? `/mensajes?to=${encodeURIComponent(notice.actorId)}` : notice.postId ? `/feed?post=${encodeURIComponent(notice.postId)}` : `/perfil/${encodeURIComponent(notice.actor.username)}`;
          return <article key={notice.id} className={`notification-item ${content.className}${notice.isRead ? "" : " unread"}`}>
            <Link href={`/perfil/${encodeURIComponent(notice.actor.username)}`} aria-label={`Ver perfil de ${notice.actor.displayName || notice.actor.username}`}><ChatAvatar person={notice.actor} /></Link>
            <div className="notification-copy"><span className="eyebrow"><Icon size={13} /> {content.category}</span><Link href={target} onClick={() => void markRead(notice)}><strong>{notice.actor.displayName || notice.actor.username}</strong> {content.text}.</Link><time className="muted" dateTime={notice.createdAt}>{fullDate(notice.createdAt)}</time></div>
            {!notice.isRead ? <button className="btn btn-small notice-read" disabled={busyIds.includes(notice.id)} onClick={() => void markRead(notice)} aria-label="Marcar notificación como leída" title="Marcar como leída">{busyIds.includes(notice.id) ? <LoaderCircle size={16} className="spin" /> : <CheckCheck size={16} />}</button> : <Check size={16} className="muted notice-read" aria-label="Leída" />}
          </article>;
        })}</div>}
      {hasMore && <div className="panel-body"><button className="btn" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore && <LoaderCircle size={16} className="spin" />} Ver notificaciones anteriores</button></div>}
    </section>
    <p className="muted notification-footnote"><Sparkles size={13} /> Las nuevas notificaciones aparecen aquí sin actualizar la página.</p>
  </div>;
}
