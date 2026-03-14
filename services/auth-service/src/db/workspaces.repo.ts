import { Injectable } from '@nestjs/common';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createDdbClient } from './ddb.client';

export interface WorkspaceRecord {
  workspaceId: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
}

@Injectable()
export class WorkspacesRepo {
  private get ddb() { return createDdbClient(); }

  async create(workspace: WorkspaceRecord): Promise<void> {
    await this.ddb.send(new PutCommand({
      TableName: process.env.DDB_WORKSPACES_TABLE ?? 'Workspaces',
      Item: {
        PK: `ws#${workspace.workspaceId}`,
        SK: 'profile',
        ...workspace,
      },
    }));
  }

  async findById(workspaceId: string): Promise<WorkspaceRecord | null> {
    const res = await this.ddb.send(new GetCommand({
      TableName: process.env.DDB_WORKSPACES_TABLE ?? 'Workspaces',
      Key: { PK: `ws#${workspaceId}`, SK: 'profile' },
    }));
    return res.Item ? (res.Item as WorkspaceRecord) : null;
  }
}