// File: services/chat-service/src/routes/chat.controller.ts
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { ChatService } from "../domain/chat.service";

class SendMessageDto {
  message!: string;
  conversationId?: string;
}

@ApiTags("Chat")
@ApiBearerAuth()
@Controller("/workspaces/:workspaceId/chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /workspaces/:workspaceId/chat/messages
   * Send a message. If conversationId is omitted, a new conversation is started.
   */
  @Post("/messages")
  @ApiBody({ type: SendMessageDto })
  async sendMessage(
    @Param("workspaceId") workspaceId: string,
    @Body() body: SendMessageDto
  ) {
    return this.chatService.sendMessage(
      workspaceId,
      body.conversationId,
      body.message
    );
  }

  /**
   * GET /workspaces/:workspaceId/chat/conversations
   * List all conversations for the workspace
   */
  @Get("/conversations")
  listConversations(@Param("workspaceId") workspaceId: string) {
    return this.chatService.listConversations(workspaceId);
  }

  /**
   * GET /workspaces/:workspaceId/chat/conversations/:conversationId/messages
   * Get all messages in a conversation
   */
  @Get("/conversations/:conversationId/messages")
  getMessages(
    @Param("workspaceId") _workspaceId: string,
    @Param("conversationId") conversationId: string
  ) {
    return this.chatService.getMessages(conversationId);
  }
}