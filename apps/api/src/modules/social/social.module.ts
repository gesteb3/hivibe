import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { CommentsModule } from '../comments/comments.module';
import { LikesModule } from '../likes/likes.module';
import { FollowsModule } from '../follows/follows.module';
import { FeedModule } from '../feed/feed.module';
import { MediaModule } from '../media/media.module';

/** Agrupa todo lo de Chepe. En AppModule solo se agrega `SocialModule`. */
@Module({ imports: [PostsModule, CommentsModule, LikesModule, FollowsModule, FeedModule, MediaModule] })
export class SocialModule {}
