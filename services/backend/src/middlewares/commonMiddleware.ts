import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "../config/env.js";

/**
 * Mounts the cross-cutting middleware every request passes through: helmet
 * security headers, CORS restricted to `CORS_ORIGIN`, JSON/URL-encoded body
 * parsing (1 MB cap), optional morgan request logging gated by `HTTP_LOGGING`,
 * and a rate limiter using the `RATE_LIMIT_*` window/max settings. Order is
 * deliberate, security and parsing run before any route handler.
 * @param app The Express application to attach middleware to.
 */
export const registerCommonMiddleware = (app: Express): void => {
  app.use(helmet());

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (env.HTTP_LOGGING) {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
};
