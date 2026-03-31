import cors from "cors";
import express from "express";
import helmet from "helmet";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { simpleRateLimit } from "./middleware/rateLimit.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(simpleRateLimit);
app.use("/api", apiRouter);
app.use(errorHandler);

