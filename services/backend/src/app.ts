import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import type { AppDependencies } from "./dependencies.js";
import { errorHandler } from "./errors/errorHandler.js";
import { notFoundHandler } from "./errors/notFoundHandler.js";
import { registerCommonMiddleware } from "./middlewares/commonMiddleware.js";
import { env } from "./config/env.js";
import { generateOpenApiDocument } from "./openapi/document.js";
import { createRoutes } from "./routes/index.js";

/** OpenAPI 3.1 document, generated once and shared by the JSON route + Swagger UI. */
const openApiDocument = generateOpenApiDocument(env.PUBLIC_API_URL);

/**
 * Creates and mounts the Express application over a resolved dependency graph.
 * Registers common middleware, the OpenAPI/Swagger surface, the versioned
 * routes, and the terminal not-found + error handlers.
 * @param dependencies The runtime services and database to route to.
 * @returns A fully wired Express {@link Express} app.
 */
export const createApp = (dependencies: AppDependencies): Express => {
  const app = express();
  registerCommonMiddleware(app);
  app.get("/api-docs.json", (_req, res) => res.json(openApiDocument));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(createRoutes(dependencies));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
