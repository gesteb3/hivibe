"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Heart, Send, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Comment, Page } from "@/lib/types";
import { useSession } from "./session";
import { Avatar } from "./brand";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la acción.";
const combine = (a: Comment[], b: Comment[]) =>
  [...new Map([...a, ...b].map((c) => [c.id, c])).values()].sort(
    (x, y) =>
      x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id),
  );
type ThreadComment = Comment & { rootId?: string };

export function CommentsSection({
  postId,
  onCountChange,
  focusId,
}: {
  postId: string;
  onCountChange: (count: number) => void;
  focusId?: string;
}) {
  const [roots, setRoots] = useState<Comment[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(0),
    [body, setBody] = useState(""),
    [sending, setSending] = useState(false),
    [version, setVersion] = useState(0),
    [focusedRoot, setFocusedRoot] = useState<Comment | null>(null),
    [focusRevision, setFocusRevision] = useState(0);
  const focusedOnce = useRef("");
  const mounted = useRef(true);
  const generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  const load = useCallback(
    async (next = 1) => {
      const request = ++generation.current;
      setLoading(true);
      try {
        const result = await api<Page<Comment>>(
          "/posts/" + postId + "/comments?page=" + next + "&limit=20",
        );
        if (!mounted.current || request !== generation.current) return;
        setRoots((old) =>
          next === 1 ? result.data : combine(old, result.data),
        );
        setPage(next);
        setPages(result.meta.totalPages);
        setError("");
      } catch (e) {
        if (mounted.current) setError(errorText(e));
      } finally {
        if (mounted.current && request === generation.current)
          setLoading(false);
      }
    },
    [postId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setFocusedRoot(null);
  }, [postId, focusId]);
  useEffect(() => {
    if (!focusId) return;
    let cancelled = false;
    void (async () => {
      try {
        const target = await api<ThreadComment>(
          "/comments/" + encodeURIComponent(focusId),
        );
        if (target.postId !== postId) return;
        const root = target.parentId
          ? await api<ThreadComment>(
              "/comments/" + (target.rootId || target.parentId),
            )
          : target;
        const initialReplies = root.repliesCount
          ? await api<Page<Comment>>(
              "/comments/" + root.id + "/replies?limit=20",
            )
          : null;
        if (cancelled) return;
        const replies = target.parentId
          ? combine(initialReplies?.data || [], [target])
          : initialReplies?.data || [];
        setFocusedRoot({ ...root, replies });
        setVersion((v) => v + 1);
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, focusId, focusRevision]);
  useEffect(() => {
    focusedOnce.current = "";
  }, [focusId]);
  useEffect(() => {
    if (!focusId || focusedOnce.current === focusId) return;
    const timer = setTimeout(() => {
      const node = document.getElementById("comment-" + focusId);
      if (node) {
        focusedOnce.current = focusId;
        node.scrollIntoView({ block: "center", behavior: "smooth" });
        node.focus({ preventScroll: true });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [focusId, roots, version, focusedRoot]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ postId: string }>).detail;
      if (detail?.postId === postId) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void load();
          if (focusId) setFocusRevision((v) => v + 1);
        }, 180);
      }
    };
    window.addEventListener("hivibe:comment-changed", changed);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hivibe:comment-changed", changed);
    };
  }, [postId, load, focusId]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      const result = await api<Comment & { commentsCount: number }>(
        "/posts/" + postId + "/comments",
        { method: "POST", body: { body: body.trim() } },
      );
      setRoots((old) => combine(old, [result]));
      setBody("");
      onCountChange(result.commentsCount);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="comments-section" aria-label="Comentarios">
      {error && (
        <p role="alert" className="error-message">
          {error}
          <button className="text-button" onClick={() => void load()}>
            Reintentar
          </button>
        </p>
      )}
      {loading && page === 0 ? (
        <p className="loading-state">Cargando comentarios…</p>
      ) : !(focusedRoot || roots.length) ? (
        <p className="muted">No hay comentarios.</p>
      ) : (
        (focusedRoot ? combine(roots, [focusedRoot]) : roots).map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            postId={postId}
            focusId={focusId}
            onCountChange={onCountChange}
            onDeleted={() => {
              setRoots((old) => old.filter((c) => c.id !== comment.id));
              if (focusedRoot?.id === comment.id) setFocusedRoot(null);
            }}
          />
        ))
      )}
      {page < pages && (
        <button
          className="text-button"
          disabled={loading}
          onClick={() => void load(page + 1)}
        >
          Ver más comentarios
        </button>
      )}
      <form className="comment-form" onSubmit={submit}>
        <label className="sr-only" htmlFor={"comment-input-" + postId}>
          Escribe un comentario
        </label>
        <input
          id={"comment-input-" + postId}
          placeholder="Escribe un comentario"
          maxLength={500}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={sending}
        />
        <button
          className="btn btn-primary btn-small"
          aria-label="Enviar comentario"
          disabled={sending || !body.trim()}
        >
          <Send size={15} />
        </button>
      </form>
    </section>
  );
}

function CommentThread({
  comment,
  postId,
  focusId,
  onCountChange,
  onDeleted,
}: {
  comment: Comment;
  postId: string;
  focusId?: string;
  onCountChange: (count: number) => void;
  onDeleted: () => void;
}) {
  const [replies, setReplies] = useState<Comment[]>(comment.replies || []),
    [total, setTotal] = useState(comment.repliesCount || 0),
    [replying, setReplying] = useState(false),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [replyPage, setReplyPage] = useState(1);
  useEffect(() => {
    setReplies(comment.replies || []);
    setTotal(comment.repliesCount || 0);
    setReplyPage(1);
  }, [comment]);
  async function reply(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const result = await api<Comment & { commentsCount: number }>(
        "/posts/" + postId + "/comments",
        { method: "POST", body: { body: body.trim(), parentId: comment.id } },
      );
      setReplies((old) => combine(old, [result]));
      setTotal((n) => n + 1);
      setBody("");
      setReplying(false);
      onCountChange(result.commentsCount);
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    setBusy(true);
    try {
      const result = await api<Page<Comment>>(
        "/comments/" +
          comment.id +
          "/replies?page=" +
          (replyPage + 1) +
          "&limit=20",
      );
      setReplies((old) => combine(old, result.data));
      setReplyPage(result.meta.page);
      setTotal(result.meta.total);
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="comment-thread">
      <CommentRow
        comment={comment}
        focusId={focusId}
        onCountChange={onCountChange}
        onDeleted={onDeleted}
        onReply={() => setReplying(!replying)}
      />
      {replies.map((item) => (
        <CommentRow
          key={item.id}
          comment={item}
          focusId={focusId}
          isReply
          onCountChange={onCountChange}
          onDeleted={() => {
            setReplies((old) => old.filter((c) => c.id !== item.id));
            setTotal((n) => Math.max(0, n - 1));
          }}
          onReply={() => {
            setReplying(true);
            setBody("@" + item.author.username + " ");
          }}
        />
      ))}
      {replies.length < total && (
        <button
          className="text-button replies-more"
          disabled={busy}
          onClick={() => void more()}
        >
          Ver más respuestas ({Math.max(0, total - replies.length)})
        </button>
      )}
      {replying && (
        <form className="reply-form" onSubmit={reply}>
          <label className="sr-only" htmlFor={"reply-input-" + comment.id}>
            Tu respuesta
          </label>
          <input
            id={"reply-input-" + comment.id}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Responder a @" + comment.author.username}
            maxLength={500}
            autoFocus
            disabled={busy}
          />
          <button
            className="btn btn-primary btn-small"
            disabled={busy || !body.trim()}
            aria-label="Enviar respuesta"
          >
            <Send size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Cancelar respuesta"
            onClick={() => setReplying(false)}
          >
            <X size={14} />
          </button>
        </form>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  isReply,
  focusId,
  onDeleted,
  onCountChange,
  onReply,
}: {
  comment: Comment;
  isReply?: boolean;
  focusId?: string;
  onDeleted: () => void;
  onCountChange: (count: number) => void;
  onReply: () => void;
}) {
  const { user } = useSession();
  const [current, setCurrent] = useState(comment),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  useEffect(() => setCurrent(comment), [comment]);
  async function react() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{ liked: boolean; likesCount: number }>(
        "/comments/" + comment.id + "/like",
        { method: current.likedByMe ? "DELETE" : "POST" },
      );
      setCurrent((c) => ({
        ...c,
        likedByMe: result.liked,
        likesCount: result.likesCount,
      }));
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      const result = await api<{ commentsCount: number }>(
        "/comments/" + comment.id,
        { method: "DELETE" },
      );
      onDeleted();
      onCountChange(result.commentsCount);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <div
      id={"comment-" + comment.id}
      data-comment-id={comment.id}
      tabIndex={-1}
      className={
        "comment-row " +
        (isReply ? "comment-reply " : "") +
        (focusId === comment.id ? "comment-highlight" : "")
      }
    >
      <Link href={"/perfil/" + comment.author.username}>
        <Avatar user={comment.author} />
      </Link>
      <div className="comment-content">
        <div className="comment-bubble">
          <Link href={"/perfil/" + comment.author.username}>
            <strong>{comment.author.displayName}</strong>
          </Link>
          <p>{comment.body}</p>
          <time dateTime={comment.createdAt}>
            {new Date(comment.createdAt).toLocaleString("es-GT", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
        </div>
        <div className="comment-actions">
          <button
            className={
              "reaction-button " + (current.likedByMe ? "is-liked" : "")
            }
            aria-label="Nitido en comentario"
            aria-pressed={!!current.likedByMe}
            disabled={busy}
            onClick={() => void react()}
          >
            <Heart
              size={13}
              fill={current.likedByMe ? "currentColor" : "none"}
            />{" "}
            Nitido <span>{current.likesCount || 0}</span>
          </button>
          <button className="text-button" onClick={onReply}>
            Responder
          </button>
          {user?.id === comment.author.id && (
            <button
              className="icon-button"
              aria-label="Eliminar mi comentario"
              disabled={busy}
              onClick={() => setConfirm(!confirm)}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        {confirm && (
          <div className="inline-confirm">
            <span>
              ¿Eliminar comentario{!isReply ? " y sus respuestas" : ""}?
            </span>
            <button
              className="btn btn-small"
              disabled={busy}
              onClick={() => void remove()}
            >
              Eliminar
            </button>
            <button className="text-button" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
