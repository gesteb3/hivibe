import { PrismaService } from './social-deps';
import { buildMeta, Pagination } from './pagination';

export const AUTHOR_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;

/** Include estándar para devolver un post con autor, contadores y `likedByMe`. */
export const postInclude = (userId: string) => ({
  author: { select: AUTHOR_SELECT },
  _count: { select: { likes: true, comments: true } },
  likes: { where: { userId }, select: { userId: true }, take: 1 },
});

export function toPostResponse(post: any) {
  const { likes, _count, ...rest } = post;
  return {
    ...rest,
    likesCount: _count?.likes ?? 0,
    commentsCount: _count?.comments ?? 0,
    likedByMe: Array.isArray(likes) && likes.length > 0,
  };
}

/** Lista paginada de posts (más recientes primero) con la forma `{ data, meta }`. */
export async function findPostsPage(prisma: PrismaService, where: object, userId: string, pag: Pagination) {
  const [total, posts] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pag.skip,
      take: pag.limit,
      include: postInclude(userId),
    }),
  ]);
  return { data: (posts as any[]).map(toPostResponse), meta: buildMeta(total as number, pag) };
}
