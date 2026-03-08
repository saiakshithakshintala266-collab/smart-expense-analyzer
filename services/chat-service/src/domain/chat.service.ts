// File: services/chat-service/src/domain/chat.service.ts
import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";

import { createDdbClient } from "../db/ddb.client";
import { ConversationRepo } from "../db/conversation.repo";
import { createBedrockClient, chat } from "../integrations/bedrock.client";

@Injectable()
export class ChatService {
  private readonly log = createLogger({ serviceName: "chat-service" });

  private readonly repo = new ConversationRepo(
    createDdbClient(),
    mustGetEnv("DDB_CONVERSATIONS_TABLE")
  );

  private readonly bedrock = createBedrockClient();

  // ── Send message ──────────────────────────────────────────────────────────

  async sendMessage(
    workspaceId: string,
    conversationId: string | undefined,
    userMessage: string,
    correlationId?: string
  ): Promise<{
    conversationId: string;
    messageId: string;
    answer: string;
    isNewConversation: boolean;
  }> {
    const cid = getOrCreateCorrelationId(correlationId);
    const now = new Date().toISOString();
    let isNewConversation = false;

    // ── Create or reuse conversation ────────────────────────────────────────
    if (!conversationId) {
      conversationId = uuidv4();
      isNewConversation = true;

      await this.repo.createConversation({
        conversationId,
        workspaceId,
        title: userMessage.slice(0, 60),  // first message as title
        messageCount: 0,
        createdAt: now,
        updatedAt: now
      });

      this.log.info({ cid, conversationId, workspaceId }, "New conversation created");
    }

    // ── Load history ────────────────────────────────────────────────────────
    const history = await this.repo.getMessages(conversationId, 20);

    this.log.info(
      { cid, conversationId, historyLength: history.length, workspaceId },
      "Sending message to Bedrock"
    );

    // ── Call Bedrock ────────────────────────────────────────────────────────
    const answer = await chat(
      this.bedrock,
      history.map((m) => ({ role: m.role, content: m.content })),
      userMessage,
      workspaceId
    );

    // ── Persist both messages ───────────────────────────────────────────────
    const userMsgId = uuidv4();
    const assistantMsgId = uuidv4();
    const answerTime = new Date().toISOString();

    await this.repo.addMessage(conversationId, {
      messageId: userMsgId,
      role: "user",
      content: userMessage,
      createdAt: now
    });

    await this.repo.addMessage(conversationId, {
      messageId: assistantMsgId,
      role: "assistant",
      content: answer,
      createdAt: answerTime
    });

    await this.repo.updateConversation(workspaceId, conversationId, now.slice(0, 26) + 'Z', {
      messageCount: history.length + 2,
      updatedAt: answerTime
    });

    this.log.info(
      { cid, conversationId, assistantMsgId, workspaceId },
      "Message exchange complete"
    );

    return { conversationId, messageId: assistantMsgId, answer, isNewConversation };
  }

  // ── List conversations ────────────────────────────────────────────────────

  async listConversations(workspaceId: string) {
    return this.repo.listConversations(workspaceId);
  }

  // ── Get conversation messages ─────────────────────────────────────────────

  async getMessages(conversationId: string) {
    return this.repo.getMessages(conversationId, 50);
  }
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}