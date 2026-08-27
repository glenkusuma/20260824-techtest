import { z } from "../openapi/extendedZod.js";

/** Version tag required on every ingested telemetry payload. */
export const TELEMETRY_SCHEMA_VERSION = "1.0" as const;
/** Source identifier expected on every ingested telemetry payload. */
export const TELEMETRY_SOURCE = "telemetry-simulator" as const;

const metricsSchema = z.object({
  acPowerW: z.number().min(0).max(1_000_000),
  acVoltageV: z.number().min(0).max(300),
  frequencyHz: z.number().min(45).max(55),
  energyTodayWh: z.number().min(0).max(100_000_000),
  energyTotalWh: z.number().min(0).max(10_000_000_000),
});

/** Deduplicated, reusable OpenAPI component name for the ingest payload. */
const SCHEMA_NAME = "TelemetryIngest" as const;

/**
 * Validates an inbound telemetry-ingest payload. Registered as the
 * `TelemetryIngest` component so OpenAPI operations share one definition.
 * @see {@link TelemetryIngestInput}
 */
export const telemetrySchema = z
  .object({
    schemaVersion: z.literal(TELEMETRY_SCHEMA_VERSION),
    source: z.literal(TELEMETRY_SOURCE),
    siteId: z.string().trim().min(1).max(100),
    inverterId: z.string().trim().min(1).max(120),
    observedAt: z.iso.datetime({ offset: true }),
    status: z.enum(["night", "starting", "running", "warning", "offline"]),
    errorCode: z.string().trim().min(1).max(100).nullable().optional(),
    metrics: metricsSchema,
  })
  .superRefine((data, ctx) => {
    const errorCode = data.errorCode ?? null;
    if (data.status === "warning" && !errorCode) {
      ctx.addIssue({
        code: "custom",
        path: ["errorCode"],
        message: "Warning readings require an errorCode",
      });
    }
    if (data.status !== "warning" && errorCode) {
      ctx.addIssue({
        code: "custom",
        path: ["errorCode"],
        message: "Only warning readings may include an errorCode",
      });
    }
    if (data.metrics.energyTotalWh < data.metrics.energyTodayWh) {
      ctx.addIssue({
        code: "custom",
        path: ["metrics", "energyTotalWh"],
        message: "Lifetime energy cannot be lower than today's energy",
      });
    }
    if (errorCode === "GRID_OVERVOLTAGE") {
      if (data.metrics.acVoltageV < 253) {
        ctx.addIssue({
          code: "custom",
          path: ["metrics", "acVoltageV"],
          message: "GRID_OVERVOLTAGE requires the demo attention voltage range",
        });
      }
      if (data.metrics.acPowerW !== 0) {
        ctx.addIssue({
          code: "custom",
          path: ["metrics", "acPowerW"],
          message:
            "GRID_OVERVOLTAGE disconnects AC production in this simulator",
        });
      }
    }
  })
  .openapi(SCHEMA_NAME, {
    description: "A single 5-minute inverter reading pushed by the simulator.",
    example: {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      source: TELEMETRY_SOURCE,
      siteId: "site-cikarang-a",
      inverterId: "inv-cikarang-a",
      observedAt: "2026-08-25T14:05:00+07:00",
      status: "running",
      errorCode: null,
      metrics: {
        acPowerW: 85000,
        acVoltageV: 225,
        frequencyHz: 50,
        energyTodayWh: 1_200_000,
        energyTotalWh: 1_200_000_000,
      },
    },
  });

/** Shape of a validated telemetry-ingest payload. */
export type TelemetryIngestInput = z.infer<typeof telemetrySchema>;

/**
 * Validates and normalizes inbound telemetry-ingest payloads against the Zod schema.
 * @see {@link TelemetryService#ingest}
 */
export class TelemetryIngestDTO {
  /**
   * Parses input against the schema and coerces a missing `errorCode` to `null`.
   * @param {unknown} input Unvalidated payload, typically the request body.
   * @returns {TelemetryIngestInput} The validated, normalized payload.
   * @throws {import("zod").ZodError} When the input fails field or cross-field validation.
   * @example
   * const payload = TelemetryIngestDTO.parse({
   *   schemaVersion: "1.0", source: TELEMETRY_SOURCE, siteId: "site-abc",
   *   inverterId: "inv-abc", observedAt: "2026-08-24T00:00:00+07:00",
   *   status: "running", errorCode: null, metrics: { acPowerW: 5000, acVoltageV: 225, frequencyHz: 50, energyTodayWh: 1200000, energyTotalWh: 1200000000 },
   * });
   */
  public static parse(input: unknown): TelemetryIngestInput {
    const parsed = telemetrySchema.parse(input);
    return { ...parsed, errorCode: parsed.errorCode ?? null };
  }
}
