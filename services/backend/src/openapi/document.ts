import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import { siteCreateSchema } from "../dto/SiteCreateDTO.js";
import { siteUpdateSchema } from "../dto/SiteUpdateDTO.js";
import { telemetrySchema } from "../dto/TelemetryIngestDTO.js";
import {
  siteTelemetryQuerySchema,
  telemetryPageQuerySchema,
} from "../dto/TelemetryQueryDTO.js";
import { z } from "./extendedZod.js";

/**
 * OpenAPI schema for a stored solar site. Derived here as a Zod schema (rather
 * than from the TypeScript `Site` interface) so it can be emitted as a reusable
 * `Site` component and `$ref`'d from every site endpoint.
 */
const siteSchema = z
  .object({
    id: z.string(),
    inverterId: z.string(),
    name: z.string(),
    location: z.string(),
    pvPeakPowerW: z.number(),
    inverterAcPowerW: z.number(),
    timezone: z.literal("Asia/Jakarta"),
    enabled: z.boolean(),
    protected: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Site", {
    description: "A registered solar site as persisted by the backend.",
    example: {
      id: "site-cikarang-a",
      inverterId: "inv-cikarang-a",
      name: "Cikarang Rooftop A",
      location: "Cikarang, West Java",
      pvPeakPowerW: 100000,
      inverterAcPowerW: 80000,
      timezone: "Asia/Jakarta",
      enabled: true,
      protected: true,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    },
  });

/**
 * OpenAPI schema for a stored telemetry reading emitted as the reusable
 * `TelemetryReading` component.
 */
const telemetryReadingSchema = z
  .object({
    id: z.number(),
    siteId: z.string(),
    inverterId: z.string(),
    observedAt: z.string(),
    receivedAt: z.string(),
    acPowerW: z.number(),
    acVoltageV: z.number(),
    frequencyHz: z.number(),
    energyTodayWh: z.number(),
    energyTotalWh: z.number(),
    status: z.enum(["night", "starting", "running", "warning", "offline"]),
    errorCode: z.string().nullable(),
  })
  .openapi("TelemetryReading", {
    description: "A persisted 5-minute telemetry reading.",
    example: {
      id: 1,
      siteId: "site-cikarang-a",
      inverterId: "inv-cikarang-a",
      observedAt: "2026-08-25T05:00:00+07:00",
      receivedAt: "2026-08-25T05:00:01.000Z",
      acPowerW: 85000,
      acVoltageV: 225,
      frequencyHz: 50,
      energyTodayWh: 1200000,
      energyTotalWh: 1200000000,
      status: "running",
      errorCode: null,
    },
  });

/** Site list payload returned by `GET /sites`. */
const siteListSchema = siteSchema.array().openapi("SiteList");
/** Telemetry history/page payload returned by the collection endpoints. */
const telemetryListSchema = telemetryReadingSchema
  .array()
  .openapi("TelemetryReadingList");

/** Path parameter matching the persisted numeric {@code :siteId} slug. */
const siteIdParamSchema = z.object({ siteId: z.string() });

/**
 * Wraps a payload schema in the standard `ApiResponse` envelope so each
 * endpoint's success body mirrors the actual `new ApiResponse(status, data)`
 * payload emitted by the controllers.
 * @param {z.ZodTypeAny} data The payload schema serialized under `data`.
 * @returns {z.ZodTypeAny} An envelope object: `{ success, statusCode, data, message }`.
 */
const envelope = (data: z.ZodTypeAny): z.ZodTypeAny =>
  z.object({
    success: z.boolean(),
    statusCode: z.number(),
    data,
    message: z.string(),
  });

const registry = new OpenAPIRegistry();

registry.register("Site", siteSchema);
registry.register("TelemetryReading", telemetryReadingSchema);
registry.register("SiteList", siteListSchema);
registry.register("TelemetryReadingList", telemetryListSchema);
registry.register("SiteCreate", siteCreateSchema);
registry.register("SiteUpdate", siteUpdateSchema);
registry.register("TelemetryIngest", telemetrySchema);
registry.register("SiteTelemetryQuery", siteTelemetryQuerySchema);
registry.register("TelemetryPageQuery", telemetryPageQuerySchema);

registry.registerPath({
  method: "get",
  path: "/health",
  summary: "Liveness check",
  tags: ["health"],
  responses: {
    "200": { description: "The service is healthy." },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/sites",
  summary: "List solar sites",
  tags: ["sites"],
  responses: {
    "200": {
      description: "Every registered site.",
      content: {
        "application/json": { schema: envelope(siteListSchema) },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/sites",
  summary: "Register a solar site",
  tags: ["sites"],
  request: {
    body: {
      content: { "application/json": { schema: siteCreateSchema } },
    },
  },
  responses: {
    "201": {
      description: "The newly created site.",
      content: {
        "application/json": { schema: envelope(siteSchema) },
      },
    },
    "422": { description: "Payload failed schema validation." },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/sites/{siteId}",
  summary: "Get a site by id",
  tags: ["sites"],
  request: { params: siteIdParamSchema },
  responses: {
    "200": {
      description: "The requested site.",
      content: {
        "application/json": { schema: envelope(siteSchema) },
      },
    },
    "404": { description: "No site has the given id." },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/sites/{siteId}",
  summary: "Replace a site (full update)",
  tags: ["sites"],
  request: {
    params: siteIdParamSchema,
    body: {
      content: { "application/json": { schema: siteUpdateSchema } },
    },
  },
  responses: {
    "200": {
      description: "The updated site.",
      content: {
        "application/json": { schema: envelope(siteSchema) },
      },
    },
    "404": { description: "No site has the given id." },
    "422": { description: "Payload failed schema validation." },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/sites/{siteId}",
  summary: "Partially update a site",
  tags: ["sites"],
  request: {
    params: siteIdParamSchema,
    body: {
      content: { "application/json": { schema: siteUpdateSchema } },
    },
  },
  responses: {
    "200": {
      description: "The updated site.",
      content: {
        "application/json": { schema: envelope(siteSchema) },
      },
    },
    "404": { description: "No site has the given id." },
    "422": { description: "Payload failed schema validation." },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/sites/{siteId}",
  summary: "Delete a site",
  tags: ["sites"],
  request: { params: siteIdParamSchema },
  responses: {
    "204": { description: "The site was deleted." },
    "404": { description: "No site has the given id." },
    "409": { description: "Protected demo sites may not be deleted." },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/sites/{siteId}/telemetry",
  summary: "Site-scoped telemetry feed",
  tags: ["telemetry"],
  request: {
    params: siteIdParamSchema,
    query: siteTelemetryQuerySchema,
  },
  responses: {
    "200": {
      description:
        "The most recent reading (a single object or null) when `latest=true`; otherwise the recent history as an array, newest last.",
      content: {
        "application/json": {
          schema: envelope(
            z.union([telemetryReadingSchema, telemetryListSchema, z.null()]),
          ),
        },
      },
    },
    "404": { description: "No site has the given id." },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/telemetry",
  summary: "Ingest a telemetry reading",
  tags: ["telemetry"],
  request: {
    body: {
      content: { "application/json": { schema: telemetrySchema } },
    },
  },
  responses: {
    "201": {
      description: "The reading was stored.",
      content: {
        "application/json": { schema: envelope(telemetryReadingSchema) },
      },
    },
    "200": {
      description: "The reading already existed and was unchanged.",
      content: {
        "application/json": { schema: envelope(telemetryReadingSchema) },
      },
    },
    "400": { description: "AC power exceeds the site's inverter capacity." },
    "404": { description: "The referenced site does not exist." },
    "409": { description: "The referenced site is disabled." },
    "422": { description: "Payload failed schema validation." },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/telemetry",
  summary: "Cursor page over the global telemetry feed",
  tags: ["telemetry"],
  request: {
    query: telemetryPageQuerySchema,
  },
  responses: {
    "200": {
      description: "A page of readings ordered by ascending row id.",
      content: {
        "application/json": { schema: envelope(telemetryListSchema) },
      },
    },
  },
});

const generator = new OpenApiGeneratorV31(registry.definitions);

/**
 * Builds the complete OpenAPI 3.1 document for the backend from the registered
 * schemas and paths. The returned object is used both to serve the in-memory
 * Swagger UI and to (re)write the committed `openapi/openapi.json` artifact.
 * @returns {OpenAPIObject} The generated OpenAPI document.
 * @see {@link https://swagger.io/specification/}
 */
export const generateOpenApiDocument = (serverUrl: string) =>
  generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Solar Telemetry API",
      version: "1.0.0",
      description:
        "Solar telemetry API. The browser registers solar sites, the simulator posts inverter telemetry, and the automation service reads telemetry incrementally.",
    },
    servers: [{ url: serverUrl }],
  });
