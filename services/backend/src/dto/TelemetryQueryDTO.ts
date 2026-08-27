import { z } from "../openapi/extendedZod.js";

/**
 * Query params for the site-scoped telemetry collection
 * (`GET /sites/:siteId/telemetry`). `latest=true` collapses to the most recent
 * reading; otherwise `limit` bounds the returned history.
 */
export const siteTelemetryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).default(288),
    latest: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .openapi("SiteTelemetryQuery", {
    description: "Query parameters for the site-scoped telemetry feed.",
    example: { limit: 288, latest: "false" },
  });

/** Query params for the cross-site cursor page (`GET /telemetry?afterId&limit`). */
export const telemetryPageQuerySchema = z
  .object({
    afterId: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(1000).default(500),
  })
  .openapi("TelemetryPageQuery", {
    description:
      "Cursor page over the global telemetry feed, ordered by ascending row id.",
    example: { afterId: 0, limit: 500 },
  });
