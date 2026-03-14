import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { UsersRepo } from '../db/users.repo';
import { WorkspacesRepo } from '../db/workspaces.repo';
import { SessionsRepo } from '../db/sessions.repo';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepo,
    private readonly workspaces: WorkspacesRepo,
    private readonly sessions: SessionsRepo,
  ) {}

  async signup(email: string, password: string, name: string) {
    const existing = await this.users.findByEmail(email).catch(() => null);
    if (existing) throw new ConflictException('Email already in use');

    const userId = `user-${uuidv4()}`;
    const workspaceId = `ws-${uuidv4()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    await this.workspaces.create({
      workspaceId,
      name: `${name}'s Workspace`,
      ownerUserId: userId,
      createdAt: now,
    });

    await this.users.create({
      userId,
      email,
      passwordHash,
      name,
      workspaceId,
      role: 'admin',
      createdAt: now,
    });

    return this.createSession({ userId, email, name, workspaceId, role: 'admin' });
  }

  async login(email: string, password: string) {
    let user: any = null;
  try {
    user = await this.users.findByEmail(email);
  } catch (err) {
    console.error('findByEmail error:', err);
    throw new UnauthorizedException('Invalid email or password');
  }
  
  if (!user) throw new UnauthorizedException('Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedException('Invalid email or password');

  return this.createSession({
    userId: user.userId,
    email: user.email,
    name: user.name,
    workspaceId: user.workspaceId,
    role: user.role,
  });
}

  async logout(token: string) {
    await this.sessions.delete(token);
  }

  async me(token: string) {
    const session = await this.sessions.findByToken(token);
    if (!session) throw new UnauthorizedException('Invalid or expired session');
    return {
      userId: session.userId,
      email: session.email,
      name: session.name,
      workspaceId: session.workspaceId,
      role: session.role,
    };
  }

  private async createSession(data: {
    userId: string;
    email: string;
    name: string;
    workspaceId: string;
    role: string;
  }) {
    const sessionToken = uuidv4();
    const ttlDays = parseInt(process.env.SESSION_TTL_DAYS ?? '30');
    const expiresAt = new Date(Date.now() + ttlDays * 86400000).toISOString();
    const now = new Date().toISOString();

    await this.sessions.create({
      sessionToken,
      ...data,
      expiresAt,
      createdAt: now,
    });

    return {
      sessionToken,
      userId: data.userId,
      email: data.email,
      name: data.name,
      workspaceId: data.workspaceId,
      role: data.role,
      expiresAt,
    };
  }
}