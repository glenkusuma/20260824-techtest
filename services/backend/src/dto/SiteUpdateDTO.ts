import { z } from "../openapi/extendedZod.js";

/** Deduplicated, reusable OpenAPI component name for the site-update payload. */
const SCHEMA_NAME = "SiteUpdate" as const;

/**
 * Validates an inbound site-update patch payload. Registered as the `SiteUpdate`
 * component; every field is optional so partial patches are accepted.
 * @see {@link SiteUpdateInput}
 */
export const siteUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    location: z.string().trim().min(2).max(150).optional(),
    pvPeakPowerW: z.coerce.number().int().min(500).max(1_000_000).optional(),
    inverterAcPowerW: z.coerce
      .number()
      .int()
      .min(500)
      .max(1_000_000)
      .optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.inverterAcPowerW !== undefined &&
      data.pvPeakPowerW !== undefined &&
      data.inverterAcPowerW > data.pvPeakPowerW * 1.25
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["inverterAcPowerW"],
        message: "Inverter AC rating must be within 125% of PV peak capacity",
      });
    }
  })
  .openapi(SCHEMA_NAME, {
    description:
      "Partial site update. Only fields present in the payload are applied.",
    example: {
      name: "Warehouse Rooftop (expanded)",
      inverterAcPowerW: 100000,
    },
  });

/** Shape of a validated site-update payload (all fields optional). */
export type SiteUpdateInput = z.infer<typeof siteUpdateSchema>;

/**
 * Validates and parses inbound site-update payloads against the Zod schema.
 * Every field is optional; only present fields are applied.
 * @see {@link SiteService#update}
 */
export class SiteUpdateDTO {
  /**
   * Parses raw input against the schema.
   * @param {unknown} input Unvalidated patch payload, typically the request body.
   * @returns {SiteUpdateInput} The validated, coerced payload (all fields optional).
   * @throws {import("zod").ZodError} When the input fails field or cross-field validation.
   * @example
   * const patch = SiteUpdateDTO.parse(req.body);
   */
  public static parse(input: unknown): SiteUpdateInput {
    return siteUpdateSchema.parse(input);
  }
}
