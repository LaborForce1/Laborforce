import type { Message, MessageConversation, TrustBadge, UserTag, VerificationStatus } from "@laborforce/shared";
import { prisma } from "../../db/prisma.js";

const messageSelect = {
  id: true,
  senderId: true,
  recipientId: true,
  conversationId: true,
  messageText: true,
  attachmentUrl: true,
  isRead: true,
  sentAt: true
} as const;

function mapMessage(row: {
  id: string;
  senderId: string;
  recipientId: string;
  conversationId: string;
  messageText: string;
  attachmentUrl: string | null;
  isRead: boolean;
  sentAt: Date;
}): Message {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    conversationId: row.conversationId,
    messageText: row.messageText,
    attachmentUrl: row.attachmentUrl,
    isRead: row.isRead,
    sentAt: row.sentAt.toISOString()
  };
}

export function buildConversationId(a: string, b: string) {
  return [a, b].sort().join(":");
}

export const messagesRepository = {
  async listConversations(userId: string) {
    const latestMessages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }]
      },
      orderBy: [{ sentAt: "desc" }],
      select: {
        ...messageSelect,
        sender: {
          select: {
            id: true,
            fullName: true,
            userTag: true,
            tradeType: true,
            businessName: true,
            isVerified: true,
            verificationStatus: true,
            trustBadge: true
          }
        },
        recipient: {
          select: {
            id: true,
            fullName: true,
            userTag: true,
            tradeType: true,
            businessName: true,
            isVerified: true,
            verificationStatus: true,
            trustBadge: true
          }
        }
      }
    });

    const seenConversationIds = new Set<string>();
    const conversations: MessageConversation[] = [];

    for (const row of latestMessages) {
      if (seenConversationIds.has(row.conversationId)) {
        continue;
      }

      seenConversationIds.add(row.conversationId);

      const participant = row.senderId === userId ? row.recipient : row.sender;
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: row.conversationId,
          recipientId: userId,
          isRead: false
        }
      });

      conversations.push({
        conversationId: row.conversationId,
        participant: {
          id: participant.id,
          fullName: participant.fullName,
          userTag: participant.userTag as UserTag,
          tradeType: participant.tradeType,
          businessName: participant.businessName,
          isVerified: participant.isVerified,
          verificationStatus: participant.verificationStatus as VerificationStatus,
          trustBadge: participant.trustBadge as TrustBadge | null
        },
        latestMessage: mapMessage(row),
        unreadCount
      });
    }

    return conversations;
  },

  async listThread(conversationId: string, userId: string) {
    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        OR: [{ senderId: userId }, { recipientId: userId }]
      },
      orderBy: { sentAt: "asc" },
      select: messageSelect
    });

    return rows.map(mapMessage);
  },

  async markConversationRead(conversationId: string, userId: string) {
    await prisma.message.updateMany({
      where: {
        conversationId,
        recipientId: userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });
  },

  async create(senderId: string, recipientId: string, messageText: string, attachmentUrl?: string | null) {
    const conversationId = buildConversationId(senderId, recipientId);

    const row = await prisma.message.create({
      data: {
        senderId,
        recipientId,
        conversationId,
        messageText,
        attachmentUrl: attachmentUrl ?? null
      },
      select: messageSelect
    });

    return mapMessage(row);
  }
};
