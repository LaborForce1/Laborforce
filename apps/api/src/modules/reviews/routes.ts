import { Router } from "express";

export const reviewsRouter = Router();

reviewsRouter.get("/trust-badges", (_req, res) => {
  res.json({
    bands: [
      { badge: "Gold Verified", range: "4.5 - 5.0" },
      { badge: "Trusted", range: "4.0 - 4.4" },
      { badge: "Established", range: "3.0 - 3.9" },
      { badge: "Under Review", range: "< 3.0" }
    ]
  });
});

