import { Injectable } from '@nestjs/common';
import { PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createDdbClient } from './ddb.client';

export interface SessionRecord {
  sessionToken: string;
  userId: string;
  workspaceId: string;
  role: string;
  email: string;
  name: string;
  expiresAt: string;
  createdAt: string;
}

@Injectable()
export class SessionsRepo {
  private get ddb() { return createDdbClient(); }

  async create(session: SessionRecord): Promise<void> {
    await this.ddb.send(new PutCommand({
      TableName: process.env.DDB_SESSIONS_TABLE ?? 'Sessions',
      Item: {
        PK: `session#${session.sessionToken}`,
        SK: 'session',
        ...session,
      },
    }));
  }

  async findByToken(token: string): Promise<SessionRecord | null> {
    const res = await this.ddb.send(new GetCommand({
      TableName: process.env.DDB_SESSIONS_TABLE ?? 'Sessions',
      Key: { PK: `session#${token}`, SK: 'session' },
    }));
    if (!res.Item) return null;
    const session = res.Item as SessionRecord;
    if (new Date(session.expiresAt) < new Date()) {
      await this.delete(token);
      return null;
    }
    return session;
  }

  async delete(token: string): Promise<void> {
    await this.ddb.send(new DeleteCommand({
      TableName: process.env.DDB_SESSIONS_TABLE ?? 'Sessions',
      Key: { PK: `session#${token}`, SK: 'session' },
    }));
  }
}