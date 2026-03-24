import { Router } from "express";
import { authRouter } from "../modules/auth/routes.js";
import { usersRouter } from "../modules/users/routes.js";
import { jobsRouter } from "../modules/jobs/routes.js";
import { quickCashRouter } from "../modules/quickCash/routes.js";
import { socialRouter } from "../modules/social/routes.js";
import { crmRouter } from "../modules/crm/routes.js";
import { paymentsRouter } from "../modules/payments/routes.js";
import { aiRouter } from "../modules/ai/routes.js";
import { verificationRouter } from "../modules/verification/routes.js";
import { messagesRouter } from "../modules/messages/routes.js";
import { reviewsRouter } from "../modules/reviews/routes.js";
import { alertsRouter } from "../modules/alerts/routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "laborforce-api" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/jobs", jobsRouter);
apiRouter.use("/quick-cash", quickCashRouter);
apiRouter.use("/social", socialRouter);
apiRouter.use("/crm", crmRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/verification", verificationRouter);
apiRouter.use("/messages", messagesRouter);
apiRouter.use("/reviews", reviewsRouter);
apiRouter.use("/alerts", alertsRouter);

