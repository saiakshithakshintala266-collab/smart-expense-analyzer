import { Injectable } from '@nestjs/common';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createDdbClient } from './ddb.client';

export interface UserRecord {
  userId: string;
  email: string;
  passwordHash: string;
  name: string;
  workspaceId: string;
  createdAt: string;
}

@Injectable()
export class UsersRepo {
  private get ddb() { return createDdbClient(); }

  async create(user: UserRecord): Promise<void> {
    await this.ddb.send(new PutCommand({
      TableName: process.env.DDB_USERS_TABLE ?? 'Users',
      Item: { PK: `email#${user.email}`, SK: 'profile', ...user },
    }));
    await this.ddb.send(new PutCommand({
      TableName: process.env.DDB_USERS_TABLE ?? 'Users',
      Item: { PK: `user#${user.userId}`, SK: 'profile', ...user },
    }));
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const res = await this.ddb.send(new GetCommand({
      TableName: process.env.DDB_USERS_TABLE ?? 'Users',
      Key: { PK: `user#${userId}`, SK: 'profile' },
    }));
    return res.Item ? (res.Item as UserRecord) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const res = await this.ddb.send(new GetCommand({
      TableName: process.env.DDB_USERS_TABLE ?? 'Users',
      Key: { PK: `email#${email}`, SK: 'profile' },
    }));
    return res.Item ? (res.Item as UserRecord) : null;
  }
}