import { z } from "../openapi/extendedZod.js";

/** Deduplicated, reusable OpenAPI component name for the site-create payload. */
const SCHEMA_NAME = "SiteCreate" as const;

/**
 * Validates an inbound site-create payload. Registered as the `SiteCreate`
 * component so any OpenAPI operation referencing it shares one definition.
 * @see {@link SiteCreateInput}
 */
export const siteCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    location: z.string().trim().min(2).max(150),
    pvPeakPowerW: z.coerce.number().int().min(500).max(1_000_000),
    inverterAcPowerW: z.coerce.number().int().min(500).max(1_000_000),
    timezone: z.literal("Asia/Jakarta").default("Asia/Jakarta"),
  })
  .superRefine((data, ctx) => {
    if (data.inverterAcPowerW > data.pvPeakPowerW * 1.25) {
      ctx.addIssue({
        code: "custom",
        path: ["inverterAcPowerW"],
        message: "Inverter AC rating must be within 125% of PV peak capacity",
      });
    }
  })
  .openapi(SCHEMA_NAME, {
    description: "Details required to register a new solar site.",
    example: {
      name: "Warehouse Rooftop",
      location: "Bekasi, West Java",
      pvPeakPowerW: 100000,
      inverterAcPowerW: 80000,
      timezone: "Asia/Jakarta",
    },
  });

/** Shape of a validated site-create payload. */
export type SiteCreateInput = z.infer<typeof siteCreateSchema>;

/**
 * Validates and parses inbound site-create payloads against the Zod schema.
 * @see {@link SiteService#create}
 */
export class SiteCreateDTO {
  /**
   * Parses raw input against the schema, coercing numbers and applying the default timezone.
   * @param {unknown} input Unvalidated payload, typically the request body.
   * @returns {SiteCreateInput} The validated, coerced payload.
   * @throws {import("zod").ZodError} When the input fails field or cross-field validation.
   * @example
   * const input = SiteCreateDTO.parse(req.body);
   */
  public static parse(input: unknown): SiteCreateInput {
    return siteCreateSchema.parse(input);
  }
}
