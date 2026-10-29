"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, Camera, Check, Heart, ImagePlus, LoaderCircle, MessageCircle, Send, Settings2, Sparkles, Star, Trash2, UserPlus, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/components/session";
import type { User, Post, Comment, Page, FollowUser } from "@/lib/types";

const errorText = (error: unknown) => error instanceof Error ? error.message : "Algo no salió bien. Inténtalo otra vez.";
const profileUrl = (username: string) => `/perfil/${encodeURIComponent(username)}`;
const dateLabel = (date: string) => new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

export function SocialAvatar({ user, large = false }: { user: { username: string; displayName?: string | null; avatarUrl?: string | null }; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user.avatarUrl]);
  return <span className={`avatar ${large ? "avatar-large" : ""}`}>
    {user.avatarUrl && !broken ? <img src={user.avatarUrl} alt="" onError={() => setBroken(true)} /> : <span>{initials(user.displayName || user.username)}</span>}
  </span>;
}

function ErrorMessage({ children }: { children: ReactNode }) {
  return children ? <p className="error-message" role="alert">{children}</p> : null;
}
function Loading() { return <div className="loading-state" role="status"><LoaderCircle size={19} className="spin" /> Cargando…</div>; }
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><Star size={32} /><h3>{title}</h3><p>{children}</p></div>;
}
async function upload(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Tu imagen debe pesar menos de 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw new Error("Elige una imagen JPG, PNG, WebP o GIF.");
  const data = new FormData(); data.append("file", file);
  return (await api<{ url: string }>("/media/upload", { method: "POST", body: data })).url;
}

function Composer({ onCreated }: { onCreated: (post: Post) => void }) {
  const { user } = useSession();
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!image) { setPreview(""); return; }
    const url = URL.createObjectURL(image); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (!body.trim() && !image)) return;
    setBusy(true); setError("");
    try {
      const imageUrl = image ? await upload(image) : undefined;
      const post = await api<Post>("/posts", { method: "POST", body: { ...(body.trim() ? { body: body.trim() } : {}), ...(imageUrl ? { imageUrl } : {}) } });
      onCreated(post); setBody(""); setImage(null); if (input.current) input.current.value = "";
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  if (!user) return null;
  return <section className="panel composer">
    <div className="panel-heading"><span><Sparkles size={16} /> Crear publicación</span></div>
    <form className="panel-body" onSubmit={submit}>
      <div className="composer-entry"><SocialAvatar user={user} /><label className="sr-only" htmlFor="new-post">Escribe una publicación</label><textarea id="new-post" className="field" placeholder="¿Qué quieres publicar?" maxLength={2000} value={body} onChange={e => setBody(e.target.value)} rows={3} disabled={busy} /></div>
      {preview && <div className="composer-preview"><img src={preview} alt="Vista previa de la publicación" /><button type="button" className="icon-button" aria-label="Quitar imagen" disabled={busy} onClick={() => { setImage(null); if (input.current) input.current.value = ""; }}><X size={16} /></button></div>}
      <ErrorMessage>{error}</ErrorMessage>
      <div className="composer-footer"><label className="btn btn-small upload-button"><ImagePlus size={16} /> Foto <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={e => { const selected = e.target.files?.[0]; if (selected && selected.size > 5 * 1024 * 1024) { setError("Tu imagen debe pesar menos de 5 MB."); e.target.value = ""; return; } setError(""); setImage(selected ?? null); }} /></label><span className="muted character-count">{body.length}/2000</span><button className="btn btn-primary" disabled={busy || (!body.trim() && !image)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Send size={15} />} {busy ? "Publicando…" : "Publicar"}</button></div>
    </form>
  </section>;
}

export function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (id: string) => void }) {
  const { user } = useSession();
  const [current, setCurrent] = useState(post);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentPage, setCommentPage] = useState(0);
  const [commentPages, setCommentPages] = useState(0);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [comment, setComment] = useState("");
  useEffect(() => setCurrent(post), [post]);
  useEffect(() => {
    const listener = (event: Event) => {
      const counts = (event as CustomEvent<{ postId: string; likesCount: number; commentsCount: number }>).detail;
      if (counts.postId === post.id) setCurrent(previous => ({ ...previous, likesCount: counts.likesCount, commentsCount: counts.commentsCount }));
    };
    window.addEventListener("hivibe:counts", listener);
    return () => window.removeEventListener("hivibe:counts", listener);
  }, [post.id]);
  async function like() {
    if (busy || !user) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ liked: boolean; likesCount: number }>(`/posts/${post.id}/like`, { method: current.likedByMe ? "DELETE" : "POST" });
      setCurrent(previous => ({ ...previous, likedByMe: result.liked, likesCount: result.likesCount }));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try { await api(`/posts/${post.id}`, { method: "DELETE" }); onDeleted?.(post.id); }
    catch (e) { setError(errorText(e)); setBusy(false); }
  }
  const loadComments = useCallback(async (page = 1) => {
    setCommentLoading(true); setError("");
    try {
      const result = await api<Page<Comment>>(`/posts/${post.id}/comments?page=${page}&limit=20`);
      setComments(previous => page === 1 ? result.data : [...new Map([...previous, ...result.data].map(item => [item.id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
      setCommentPage(result.meta.page); setCommentPages(result.meta.totalPages);
    } catch (e) { setError(errorText(e)); } finally { setCommentLoading(false); }
  }, [post.id]);
  async function toggleComments() { setOpen(!open); if (!open && commentPage === 0) await loadComments(); }
  async function sendComment(event: FormEvent) {
    event.preventDefault(); if (!comment.trim() || commentBusy) return;
    setCommentBusy(true); setError("");
    try {
      const result = await api<Comment & { commentsCount: number }>(`/posts/${post.id}/comments`, { method: "POST", body: { body: comment.trim() } });
      setComments(previous => [...previous, result]); setComment("");
      setCurrent(previous => ({ ...previous, commentsCount: result.commentsCount }));
    } catch (e) { setError(errorText(e)); } finally { setCommentBusy(false); }
  }
  async function removeComment(id: string) {
    if (commentBusy) return; setCommentBusy(true); setError("");
    try {
      const result = await api<{ commentsCount: number }>(`/comments/${id}`, { method: "DELETE" });
      setComments(previous => previous.filter(item => item.id !== id));
      setCurrent(previous => ({ ...previous, commentsCount: result.commentsCount }));
    } catch (e) { setError(errorText(e)); } finally { setCommentBusy(false); }
  }
  return <article className="panel post-card" id={`post-${post.id}`}>
    <header className="post-head"><Link href={profileUrl(post.author.username)} className="post-author"><SocialAvatar user={post.author} /><span><strong>{post.author.displayName || post.author.username}</strong><span className="post-byline">@{post.author.username} <span>·</span> <time dateTime={post.createdAt}>{dateLabel(post.createdAt)}</time></span></span></Link>{user?.id === post.author.id && <button className="icon-button" title="Eliminar publicación" aria-label="Eliminar publicación" disabled={busy} onClick={() => setConfirmDelete(!confirmDelete)}><Trash2 size={16} /></button>}</header>
    {current.body && <p className="post-body">{current.body}</p>}
    {current.imageUrl && <img className="post-image" src={current.imageUrl} alt={`Foto publicada por ${post.author.displayName || post.author.username}`} loading="lazy" />}
    {confirmDelete && <div className="inline-confirm"><span>¿Eliminar esta publicación? No se puede recuperar.</span><button className="btn btn-small" onClick={() => setConfirmDelete(false)}>Conservar</button><button className="btn btn-small btn-danger" disabled={busy} onClick={remove}>Sí, borrar</button></div>}
    <div className="post-actions"><button className={`reaction-button ${current.likedByMe ? "is-liked" : ""}`} disabled={busy} aria-pressed={current.likedByMe} onClick={like}><Heart size={18} fill={current.likedByMe ? "currentColor" : "none"} /> <span>{current.likesCount}</span><span className="action-label">Nitido</span></button><button className={`reaction-button ${open ? "active" : ""}`} aria-expanded={open} onClick={toggleComments}><MessageCircle size={18} /> {current.commentsCount}<span className="action-label">Comentarios</span></button><Link href={profileUrl(post.author.username)} className="post-profile-link">Ver perfil ↗</Link></div>
    <ErrorMessage>{error}</ErrorMessage>
    {open && <section className="comments-section" aria-label="Comentarios">{commentLoading && commentPage === 0 ? <Loading /> : comments.length === 0 ? <p className="muted comment-empty">No hay comentarios.</p> : comments.map(item => <div className="comment-row" key={item.id}><Link href={profileUrl(item.author.username)}><SocialAvatar user={item.author} /></Link><div className="comment-bubble"><Link href={profileUrl(item.author.username)}><strong>{item.author.displayName || item.author.username}</strong></Link><p>{item.body}</p><time className="muted" dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></div>{item.author.id === user?.id && <button className="icon-button" aria-label="Eliminar mi comentario" disabled={commentBusy} onClick={() => removeComment(item.id)}><Trash2 size={13} /></button>}</div>)}{commentPage < commentPages && <button className="text-button" disabled={commentLoading} onClick={() => loadComments(commentPage + 1)}>{commentLoading ? "Cargando…" : "Ver más comentarios"}</button>}<form className="comment-form" onSubmit={sendComment}><label className="sr-only" htmlFor={`comment-${post.id}`}>Escribe un comentario</label><input id={`comment-${post.id}`} className="field" placeholder="Escribe un comentario" value={comment} maxLength={500} onChange={e => setComment(e.target.value)} disabled={commentBusy} /><button className="btn btn-primary btn-small" type="submit" aria-label="Enviar comentario" disabled={commentBusy || !comment.trim()}><Send size={15} /></button></form></section>}
  </article>;
}

export function FeedView() {
  const { user } = useSession();
  const [filter, setFilter] = useState<"general" | "following">("general");
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState<Post | null>(null);
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const load = useCallback(async (nextPage: number, cancelled: () => boolean = () => false) => {
    const version = requestVersion.current;
    const stale = () => cancelled() || requestVersion.current !== version;
    setLoading(true); setError("");
    try {
      const result = await api<Page<Post>>(`/feed${filter === "following" ? "/following" : ""}?page=${nextPage}&limit=10`);
      if (stale()) return;
      setPosts(previous => nextPage === 1 ? result.data : [...new Map([...previous, ...result.data].map(item => [item.id, item])).values()]); setPage(result.meta.page); setPages(result.meta.totalPages);
    } catch (e) { if (!stale()) setError(errorText(e)); } finally { if (!stale()) setLoading(false); }
  }, [filter]);
  useEffect(() => { if (!user) return; let cancelled = false; requestVersion.current += 1; setPosts([]); setPage(0); void load(1, () => cancelled); return () => { cancelled = true; requestVersion.current += 1; }; }, [load, user?.id, retry]);
  useEffect(() => {
    if (!user) return; const id = new URLSearchParams(window.location.search).get("post"); if (!id) return;
    let cancelled = false; void api<Post>(`/posts/${encodeURIComponent(id)}`).then(post => { if (!cancelled) setHighlight(post); }).catch(e => { if (!cancelled) setError(errorText(e)); }); return () => { cancelled = true; };
  }, [user?.id]);
  return <div className="stack feed-view"><div className="page-heading"><div><h1>Publicaciones</h1></div></div><Composer onCreated={post => { if (filter !== "general") setFilter("general"); else setPosts(previous => [post, ...previous]); }} />{highlight && <section className="highlighted-post"><div className="section-title"><span><Star size={14} /> Desde tus notificaciones</span><button className="text-button" onClick={() => setHighlight(null)}>Cerrar</button></div><PostCard post={highlight} onDeleted={() => setHighlight(null)} /></section>}<div className="feed-toolbar"><div className="tabs" aria-label="Tipo de feed"><button className={filter === "general" ? "active" : ""} onClick={() => setFilter("general")}><Sparkles size={15} /> Todo HiVibe</button><button className={filter === "following" ? "active" : ""} onClick={() => setFilter("following")}><Users size={15} /> Mis cuates</button></div><span className="muted feed-order">Lo más reciente primero</span></div><ErrorMessage>{error}</ErrorMessage>{error && <button className="btn btn-small" onClick={() => setRetry(value => value + 1)}>Volver a intentar</button>}{loading && page === 0 ? <Loading /> : posts.length === 0 && !error ? <section className="panel"><Empty title={filter === "following" ? "No hay publicaciones de tus cuates" : "No hay publicaciones"}>{filter === "following" ? <>Sigue a alguien desde su perfil para encontrar sus publicaciones aquí. <Link href="/cuates">Buscar cuates →</Link></> : "Publica un texto o una foto para comenzar."}</Empty></section> : posts.map(post => <PostCard key={post.id} post={post} onDeleted={id => setPosts(previous => previous.filter(item => item.id !== id))} />)}{page < pages && <button className="btn load-more" disabled={loading} onClick={() => load(page + 1)}>{loading ? <LoaderCircle className="spin" size={16} /> : <ArrowDown size={16} />} {loading ? "Cargando…" : "Ver más publicaciones"}</button>}</div>;
}

function ProfileEditor({ profile, onSaved, onClose }: { profile: User; onSaved: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio || "");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      if (name.trim().length < 2) throw new Error("Tu nombre debe tener al menos dos caracteres.");
      const avatarUrl = avatar ? await upload(avatar) : undefined;
      const coverUrl = cover ? await upload(cover) : undefined;
      await api("/users/me", { method: "PATCH", body: { displayName: name.trim(), bio, ...(avatarUrl ? { avatarUrl } : {}), ...(coverUrl ? { coverUrl } : {}) } });
      await onSaved(); onClose();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <section className="panel profile-editor"><div className="panel-heading"><span><Settings2 size={16} /> Editar perfil</span><button className="icon-button" aria-label="Cerrar editor" onClick={onClose}><X size={16} /></button></div><form className="panel-body stack" onSubmit={submit}><label>Nombre visible<input className="field" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} required disabled={busy} /></label><label>Sobre mí<textarea className="field" placeholder="Escribe tu biografía" rows={3} value={bio} onChange={e => setBio(e.target.value)} maxLength={500} disabled={busy} /></label><div className="form-row"><label className="file-field"><Camera size={16} /> Foto de perfil<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => setAvatar(e.target.files?.[0] ?? null)} disabled={busy} /></label><label className="file-field"><ImagePlus size={16} /> Portada<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => setCover(e.target.files?.[0] ?? null)} disabled={busy} /></label></div><p className="muted">JPG, PNG, WebP o GIF · Máximo 5 MB por imagen.</p><ErrorMessage>{error}</ErrorMessage><div className="button-row"><button className="btn" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} {busy ? "Guardando…" : "Guardar cambios"}</button></div></form></section>;
}

export function ProfileView({ username }: { username: string }) {
  const { user, refresh } = useSession();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cuates, setPanas] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const own = user?.id === profile?.id;
  useEffect(() => {
    if (!user) return; let cancelled = false; requestVersion.current += 1;
    setLoading(true); setError(""); setEditing(false); setPosts([]); setProfile(null);
    void (async () => {
      try {
        const next = await api<User>(`/users/${encodeURIComponent(username)}`);
        if (cancelled) return; setProfile(next);
        const [wall, friends, relationship] = await Promise.all([
          api<Page<Post>>(`/users/${next.id}/posts?page=1&limit=10`),
          api<Page<FollowUser>>(`/users/${next.id}/following?limit=6`),
          api<{ isFollowedByMe: boolean }>(`/users/${encodeURIComponent(username)}/relationship`)
        ]);
        if (cancelled) return;
        setPosts(wall.data); setPage(1); setPages(wall.meta.totalPages); setPanas(friends.data); setFollowing(relationship.isFollowedByMe);
      } catch (e) { if (!cancelled) setError(errorText(e)); } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; requestVersion.current += 1; };
  }, [username, user?.id, retry]);
  async function follow() {
    if (!profile || busy) return; const version = requestVersion.current; setBusy(true); setError("");
    try {
      const result = await api<{ following: boolean; followersCount: number }>(`/users/${profile.id}/follow`, { method: following ? "DELETE" : "POST" });
      if (version !== requestVersion.current) return;
      setFollowing(result.following); setProfile(previous => previous ? { ...previous, followersCount: result.followersCount } : previous);
    } catch (e) { if (version === requestVersion.current) setError(errorText(e)); } finally { setBusy(false); }
  }
  async function more() {
    if (!profile || moreLoading) return; const version = requestVersion.current; setMoreLoading(true); setError("");
    try { const result = await api<Page<Post>>(`/users/${profile.id}/posts?page=${page + 1}&limit=10`); if (version !== requestVersion.current) return; setPosts(previous => [...previous, ...result.data]); setPage(result.meta.page); setPages(result.meta.totalPages); }
    catch (e) { if (version === requestVersion.current) setError(errorText(e)); } finally { setMoreLoading(false); }
  }
  if (loading) return <Loading />;
  if (!profile) return <section className="panel"><Empty title="No encontramos este perfil">{error || "Revisa el alias de tu cuate y vuelve a intentar."}</Empty><div className="panel-body"><Link className="btn" href="/feed"><ArrowLeft size={16} /> Volver al feed</Link><button className="text-button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div></section>;
  return <div className="stack profile-view">
    <div className="profile-topline"><span className="muted">@{profile.username}</span></div>
    <section className="panel profile-hero">
      <div className={`profile-cover ${profile.coverUrl ? "has-image" : ""}`}>{profile.coverUrl ? <img src={profile.coverUrl} alt={`Portada de ${profile.displayName}`} /> : <><span className="cover-star star-one">✦</span><span className="cover-star star-two">✶</span><span className="cover-star star-three">✦</span></>}</div>
      <div className="profile-header"><div className="profile-identity"><SocialAvatar user={profile} large /><div><h1>{profile.displayName}</h1><p className="muted">@{profile.username}</p></div></div><div className="button-row">{own ? <button className="btn" onClick={() => setEditing(!editing)}><Settings2 size={16} /> Editar mi perfil</button> : <><button className={`btn ${following ? "" : "btn-primary"}`} disabled={busy} onClick={follow}>{following ? <Check size={16} /> : <UserPlus size={16} />}{following ? "Siguiendo" : "Hacernos cuates"}</button><Link className="btn" href={`/mensajes?to=${profile.id}`}><MessageCircle size={16} /> Mensaje</Link></>}</div></div>
      <div className="stat-row"><span><strong>{profile.postsCount ?? posts.length}</strong> publicaciones</span><span><strong>{profile.followersCount ?? 0}</strong> seguidores</span><span><strong>{profile.followingCount ?? 0}</strong> cuates</span></div>
    </section>
    <ErrorMessage>{error}</ErrorMessage>
    {editing && <ProfileEditor profile={profile} onClose={() => setEditing(false)} onSaved={async () => { await refresh(); const updated = await api<User>(`/users/${encodeURIComponent(username)}`); setProfile(updated); }} />}
    <div className="profile-columns"><aside className="profile-sidebar stack"><section className="panel"><div className="panel-heading"><span><Star size={15} /> Sobre mí</span></div><div className="panel-body"><p className="profile-bio">{profile.bio || (own ? "Agrega tu biografía desde Editar mi perfil." : "Sin biografía.")}</p>{profile.createdAt && <p className="muted profile-since">En HiVibe desde {new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" }).format(new Date(profile.createdAt))}</p>}</div></section><section className="panel"><div className="panel-heading"><span><Users size={15} /> Sus cuates</span><span className="tiny-tag">{profile.followingCount ?? 0}</span></div><div className="panel-body">{cuates.length ? <div className="profile-cuates-grid">{cuates.map(cuate => <Link href={profileUrl(cuate.username)} key={cuate.id}><SocialAvatar user={cuate} /><span>{cuate.displayName || cuate.username}</span></Link>)}</div> : <p className="muted">No sigue a otros usuarios.</p>}</div></section></aside><div className="stack profile-wall"><div className="section-title"><span><MessageCircle size={16} /> El muro de {own ? "mis publicaciones" : profile.displayName.split(" ")[0]}</span><span className="muted">{profile.postsCount ?? posts.length} publicaciones</span></div>{own && <Composer onCreated={post => { setPosts(previous => [post, ...previous]); setProfile(previous => previous ? { ...previous, postsCount: (previous.postsCount ?? 0) + 1 } : previous); }} />}{posts.length ? posts.map(post => <PostCard key={post.id} post={post} onDeleted={id => { setPosts(previous => previous.filter(item => item.id !== id)); setProfile(previous => previous ? { ...previous, postsCount: Math.max(0, (previous.postsCount ?? 1) - 1) } : previous); }} />) : <section className="panel"><Empty title="Sin publicaciones">{own ? "Comparte un texto o una foto." : "Todavía no ha compartido publicaciones."}</Empty></section>}{page < pages && <button className="btn load-more" disabled={moreLoading} onClick={more}>{moreLoading ? "Cargando…" : "Ver más publicaciones"}</button>}</div></div>
  </div>;
}

function PersonCard({ person, onFollow }: { person: FollowUser; onFollow: (id: string, following: boolean) => void }) {
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function follow() {
    setBusy(true); setError("");
    try { const result = await api<{ following: boolean }>(`/users/${person.id}/follow`, { method: person.isFollowedByMe ? "DELETE" : "POST" }); onFollow(person.id, result.following); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <article className="panel person-card"><Link href={profileUrl(person.username)} className="person-card-link"><SocialAvatar user={person} large /><h3>{person.displayName || person.username}</h3><p className="muted">@{person.username}</p></Link>{person.id !== user?.id ? <div className="button-row"><button className={`btn btn-small ${person.isFollowedByMe ? "" : "btn-primary"}`} disabled={busy} onClick={follow}>{person.isFollowedByMe ? <Check size={14} /> : <UserPlus size={14} />}{person.isFollowedByMe ? "Siguiendo" : "Seguir"}</button><Link className="icon-button" title="Enviar mensaje" aria-label={`Enviar mensaje a ${person.displayName || person.username}`} href={`/mensajes?to=${person.id}`}><MessageCircle size={16} /></Link></div> : <span className="tiny-tag">ESTE ERES TÚ</span>}<ErrorMessage>{error}</ErrorMessage></article>;
}

export function CuatesView() {
  const { user } = useSession();
  const [tab, setTab] = useState<"following" | "followers">("following");
  const [people, setPeople] = useState<FollowUser[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<FollowUser | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const load = useCallback(async (nextPage: number, cancelled: () => boolean = () => false) => {
    const version = requestVersion.current;
    const stale = () => cancelled() || requestVersion.current !== version;
    if (!user) return; setLoading(true); setError("");
    try {
      const result = await api<Page<FollowUser>>(`/users/${user.id}/${tab}?page=${nextPage}&limit=12`);
      if (stale()) return;
      setPeople(previous => nextPage === 1 ? result.data : [...new Map([...previous, ...result.data].map(item => [item.id, item])).values()]); setPage(result.meta.page); setPages(result.meta.totalPages); setTotal(result.meta.total);
    } catch (e) { if (!stale()) setError(errorText(e)); } finally { if (!stale()) setLoading(false); }
  }, [user?.id, tab]);
  useEffect(() => { let cancelled = false; requestVersion.current += 1; setPeople([]); setPage(0); void load(1, () => cancelled); return () => { cancelled = true; requestVersion.current += 1; }; }, [load, retry]);
  async function find(event: FormEvent) {
    event.preventDefault(); if (!query.trim() || searchBusy) return;
    setSearchBusy(true); setSearchError(""); setSearch(null);
    try {
      const username = query.trim().replace(/^@/, "");
      const [profile, relation] = await Promise.all([api<User>(`/users/${encodeURIComponent(username)}`), api<{ isFollowedByMe: boolean }>(`/users/${encodeURIComponent(username)}/relationship`)]);
      setSearch({ id: profile.id, username: profile.username, displayName: profile.displayName, avatarUrl: profile.avatarUrl, isFollowedByMe: relation.isFollowedByMe });
    } catch (e) { setSearchError(errorText(e)); } finally { setSearchBusy(false); }
  }
  function changed(id: string, following: boolean) {
    setPeople(previous => previous.map(person => person.id === id ? { ...person, isFollowedByMe: following } : person));
    setSearch(previous => previous?.id === id ? { ...previous, isFollowedByMe: following } : previous);
    if (tab === "following") setRetry(value => value + 1);
  }
  return <div className="stack cuates-view"><div className="page-heading"><div><h1>Mis cuates <span className="heading-star">✶</span></h1></div></div><section className="panel"><div className="panel-heading"><span><UserPlus size={16} /> Buscar usuarios</span></div><form className="panel-body search-cuates" onSubmit={find}><label htmlFor="search-cuate">Busca a tu cuate por su alias exacto</label><div className="form-row"><input id="search-cuate" className="field" placeholder="@alias_del_usuario" value={query} onChange={e => setQuery(e.target.value)} maxLength={31} required /><button className="btn btn-primary" disabled={searchBusy || !query.trim()}>{searchBusy ? "Buscando…" : "Buscar cuate"}<Star size={14} /></button></div><ErrorMessage>{searchError}</ErrorMessage></form>{search && <div className="panel-body search-result"><PersonCard person={search} onFollow={changed} /><button className="text-button" onClick={() => setSearch(null)}>Cerrar resultado</button></div>}</section><div className="feed-toolbar"><div className="tabs"><button className={tab === "following" ? "active" : ""} onClick={() => setTab("following")}>Mis cuates</button><button className={tab === "followers" ? "active" : ""} onClick={() => setTab("followers")}>Me siguen</button></div><span className="muted">{total} {total === 1 ? "conexión" : "conexiones"}</span></div><ErrorMessage>{error}</ErrorMessage>{error && <button className="btn btn-small" onClick={() => setRetry(value => value + 1)}>Reintentar</button>}{loading && page === 0 ? <Loading /> : people.length ? <div className="people-grid">{people.map(person => <PersonCard key={person.id} person={person} onFollow={changed} />)}</div> : !error && <section className="panel"><Empty title={tab === "following" ? "No sigues a ningún usuario" : "Todavía no tienes seguidores"}>{tab === "following" ? "Busca un usuario por su alias para seguirlo." : "Comparte tu alias con tus amigos para que encuentren tu perfil."}</Empty></section>}{page < pages && <button className="btn load-more" disabled={loading} onClick={() => load(page + 1)}>{loading ? "Cargando…" : "Ver más cuates"}</button>}</div>;
}
