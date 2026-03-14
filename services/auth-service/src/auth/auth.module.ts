import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepo } from '../db/users.repo';
import { WorkspacesRepo } from '../db/workspaces.repo';
import { SessionsRepo } from '../db/sessions.repo';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UsersRepo, WorkspacesRepo, SessionsRepo],
})
export class AuthModule {}