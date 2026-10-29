/**
 * Eventos internos que emite el módulo social. Daniel los escucha con
 * @OnEvent('social.like.created') etc. para crear notificaciones y emitir por Socket.IO.
 */
export const SOCIAL_EVENTS = {
  POST_CREATED: 'social.post.created',
  LIKE_CREATED: 'social.like.created',
  LIKE_REMOVED: 'social.like.removed',
  COMMENT_CREATED: 'social.comment.created',
  COMMENT_REMOVED: 'social.comment.removed',
  FOLLOW_CREATED: 'social.follow.created',
  FOLLOW_REMOVED: 'social.follow.removed',
  /** Para el evento Socket.IO `post:counts` */
  COUNTS_CHANGED: 'social.counts.changed',
} as const;

export interface LikeEvent { postId: string; postAuthorId: string; actorId: string }
export interface CommentEvent { postId: string; commentId: string; postAuthorId: string; actorId: string }
export interface FollowEvent { followerId: string; followingId: string }
export interface CountsEvent { postId: string; likesCount: number; commentsCount: number }
