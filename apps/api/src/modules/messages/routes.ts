import { Router } from "express";

export const messagesRouter = Router();

messagesRouter.get("/", (_req, res) => {
  res.json({
    unreadCount: 2,
    items: [
      {
        id: "msg-1",
        conversationId: "conv-1",
        senderId: "u-biz-1",
        recipientId: "u-emp-1",
        messageText: "Can you start Monday on the Williamsburg retrofit?",
        isRead: false,
        sentAt: new Date().toISOString()
      }
    ]
  });
});

