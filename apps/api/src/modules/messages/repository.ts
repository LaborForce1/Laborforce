import type { Message, MessageConversation } from "@laborforce/shared";
import { query } from "../../db/query.js";

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  conversation_id: string;
  message_text: string;
  attachment_url: string | null;
  is_read: boolean;
  sent_at: Date;
}

interface ConversationRow extends MessageRow {
  participant_id: string;
  participant_full_name: string;
  participant_user_tag: MessageConversation["participant"]["userTag"];
  participant_trade_type: string | null;
  participant_business_name: string | null;
  participant_is_verified: boolean;
  participant_verification_status: MessageConversation["participant"]["verificationStatus"];
  participant_trust_badge: MessageConversation["participant"]["trustBadge"] | null;
  unread_count: string;
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    conversationId: row.conversation_id,
    messageText: row.message_text,
    attachmentUrl: row.attachment_url,
    isRead: row.is_read,
    sentAt: row.sent_at.toISOString()
  };
}

function mapConversation(row: ConversationRow): MessageConversation {
  return {
    conversationId: row.conversation_id,
    participant: {
      id: row.participant_id,
      fullName: row.participant_full_name,
      userTag: row.participant_user_tag,
      tradeType: row.participant_trade_type,
      businessName: row.participant_business_name,
      isVerified: row.participant_is_verified,
      verificationStatus: row.participant_verification_status,
      trustBadge: row.participant_trust_badge
    },
    latestMessage: mapMessage(row),
    unreadCount: Number(row.unread_count)
  };
}

export function buildConversationId(a: string, b: string) {
  return [a, b].sort().join(":");
}

export const messagesRepository = {
  async listConversations(userId: string) {
    const result = await query<ConversationRow>(
      `
        WITH ranked_messages AS (
          SELECT
            messages.*,
            ROW_NUMBER() OVER (PARTITION BY messages.conversation_id ORDER BY messages.sent_at DESC) AS row_num
          FROM messages
          WHERE messages.sender_id = $1 OR messages.recipient_id = $1
        )
        SELECT
          ranked_messages.id,
          ranked_messages.sender_id,
          ranked_messages.recipient_id,
          ranked_messages.conversation_id,
          ranked_messages.message_text,
          ranked_messages.attachment_url,
          ranked_messages.is_read,
          ranked_messages.sent_at,
          participant.id AS participant_id,
          participant.full_name AS participant_full_name,
          participant.user_tag AS participant_user_tag,
          participant.trade_type AS participant_trade_type,
          participant.business_name AS participant_business_name,
          participant.is_verified AS participant_is_verified,
          participant.verification_status AS participant_verification_status,
          participant.trust_badge AS participant_trust_badge,
          (
            SELECT COUNT(*)
            FROM messages unread
            WHERE unread.conversation_id = ranked_messages.conversation_id
              AND unread.recipient_id = $1
              AND unread.is_read = FALSE
          ) AS unread_count
        FROM ranked_messages
        INNER JOIN users participant ON participant.id =
          CASE
            WHEN ranked_messages.sender_id = $1 THEN ranked_messages.recipient_id
            ELSE ranked_messages.sender_id
          END
        WHERE ranked_messages.row_num = 1
        ORDER BY ranked_messages.sent_at DESC
      `,
      [userId]
    );

    return result.rows.map(mapConversation);
  },

  async listThread(conversationId: string, userId: string) {
    const result = await query<MessageRow>(
      `
        SELECT
          id,
          sender_id,
          recipient_id,
          conversation_id,
          message_text,
          attachment_url,
          is_read,
          sent_at
        FROM messages
        WHERE conversation_id = $1
          AND (sender_id = $2 OR recipient_id = $2)
        ORDER BY sent_at ASC
      `,
      [conversationId, userId]
    );

    return result.rows.map(mapMessage);
  },

  async markConversationRead(conversationId: string, userId: string) {
    await query(
      `
        UPDATE messages
        SET is_read = TRUE
        WHERE conversation_id = $1
          AND recipient_id = $2
          AND is_read = FALSE
      `,
      [conversationId, userId]
    );
  },

  async create(senderId: string, recipientId: string, messageText: string, attachmentUrl?: string | null) {
    const conversationId = buildConversationId(senderId, recipientId);

    const result = await query<MessageRow>(
      `
        INSERT INTO messages (
          sender_id,
          recipient_id,
          conversation_id,
          message_text,
          attachment_url
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          sender_id,
          recipient_id,
          conversation_id,
          message_text,
          attachment_url,
          is_read,
          sent_at
      `,
      [senderId, recipientId, conversationId, messageText, attachmentUrl ?? null]
    );

    return mapMessage(result.rows[0]);
  }
};
