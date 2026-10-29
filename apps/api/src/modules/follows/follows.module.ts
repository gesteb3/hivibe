import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
