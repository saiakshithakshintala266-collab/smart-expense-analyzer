// File: services/chat-service/src/__tests__/chat.service.test.ts

// ── Mocks BEFORE import ───────────────────────────────────────────────────────

const mockRepo = {
  createConversation: jest.fn().mockResolvedValue(undefined),
  getMessages:        jest.fn().mockResolvedValue([]),
  addMessage:         jest.fn().mockResolvedValue(undefined),
  updateConversation: jest.fn().mockResolvedValue(undefined),
  listConversations:  jest.fn().mockResolvedValue([])
};

jest.mock("../db/ddb.client",        () => ({ createDdbClient: () => ({ send: jest.fn() }) }));
jest.mock("../db/conversation.repo", () => ({
  ConversationRepo: jest.fn().mockImplementation(() => mockRepo)
}));
jest.mock("../integrations/bedrock.client", () => ({
  createBedrockClient: () => ({}),
  chat: jest.fn().mockResolvedValue("Here is your expense summary.")
}));

import { ChatService } from "../domain/chat.service";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DDB_CONVERSATIONS_TABLE = "ChatConversations";
  process.env.AWS_REGION              = "us-east-1";
  jest.clearAllMocks();
  mockRepo.createConversation.mockResolvedValue(undefined);
  mockRepo.getMessages.mockResolvedValue([]);
  mockRepo.addMessage.mockResolvedValue(undefined);
  mockRepo.updateConversation.mockResolvedValue(undefined);
  mockRepo.listConversations.mockResolvedValue([]);
  const { chat } = require("../integrations/bedrock.client");
  chat.mockResolvedValue("Here is your expense summary.");
});

// ── sendMessage ───────────────────────────────────────────────────────────────

describe("ChatService.sendMessage", () => {
  it("creates a new conversation when no conversationId is provided", async () => {
    const service = new ChatService();
    const result = await service.sendMessage("ws-1", undefined, "What did I spend last month?");

    expect(mockRepo.createConversation).toHaveBeenCalledTimes(1);
    const created = mockRepo.createConversation.mock.calls[0][0];
    expect(created.workspaceId).toBe("ws-1");
    // title is first 60 chars of the message
    expect(created.title).toBe("What did I spend last month?");
    expect(result.isNewConversation).toBe(true);
    expect(result.conversationId).toBeDefined();
  });

  it("reuses existing conversation when conversationId is provided", async () => {
    const service = new ChatService();
    const result = await service.sendMessage("ws-1", "conv-existing", "Show me dining expenses");

    expect(mockRepo.createConversation).not.toHaveBeenCalled();
    expect(result.isNewConversation).toBe(false);
    expect(result.conversationId).toBe("conv-existing");
  });

  it("returns the Bedrock answer", async () => {
    const service = new ChatService();
    const result = await service.sendMessage("ws-1", undefined, "Summarize my expenses");

    expect(result.answer).toBe("Here is your expense summary.");
  });

  it("persists user message and assistant reply via addMessage", async () => {
    const service = new ChatService();
    await service.sendMessage("ws-1", undefined, "Hello");

    expect(mockRepo.addMessage).toHaveBeenCalledTimes(2);
    const roles = mockRepo.addMessage.mock.calls.map((c: any[]) => c[1].role);
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");
  });

  it("passes conversation history to Bedrock", async () => {
    const { chat } = require("../integrations/bedrock.client");
    mockRepo.getMessages.mockResolvedValueOnce([
      { messageId: "m1", role: "user",      content: "Previous question", createdAt: "2026-03-01T00:00:00Z" },
      { messageId: "m2", role: "assistant", content: "Previous answer",   createdAt: "2026-03-01T00:00:01Z" }
    ]);

    const service = new ChatService();
    await service.sendMessage("ws-1", "conv-123", "Follow-up question");

    // chat(bedrock, history, userMessage, workspaceId)
    const [, history] = chat.mock.calls[0];
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("Previous question");
  });

  it("updates conversation metadata (messageCount + updatedAt) after exchange", async () => {
    const service = new ChatService();
    await service.sendMessage("ws-1", "conv-abc", "Test");

    expect(mockRepo.updateConversation).toHaveBeenCalledTimes(1);
    const [, , , updates] = mockRepo.updateConversation.mock.calls[0];
    expect(updates).toHaveProperty("messageCount");
    expect(updates).toHaveProperty("updatedAt");
  });

  it("returns messageId as the assistant message id", async () => {
    const service = new ChatService();
    const result = await service.sendMessage("ws-1", undefined, "Hello");

    // messageId in return value is the assistant message id
    const assistantCall = mockRepo.addMessage.mock.calls.find((c: any[]) => c[1].role === "assistant");
    expect(result.messageId).toBe(assistantCall[1].messageId);
  });

  it("throws and does not persist messages if Bedrock call fails", async () => {
    const { chat } = require("../integrations/bedrock.client");
    chat.mockRejectedValueOnce(new Error("Bedrock timeout"));

    const service = new ChatService();
    await expect(
      service.sendMessage("ws-1", undefined, "Hello")
    ).rejects.toThrow("Bedrock timeout");

    expect(mockRepo.addMessage).not.toHaveBeenCalled();
  });
});