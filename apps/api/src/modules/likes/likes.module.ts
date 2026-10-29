import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
