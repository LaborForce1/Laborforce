import Stripe from "stripe";
import { env } from "../config/env.js";

export const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil"
    })
  : null;
