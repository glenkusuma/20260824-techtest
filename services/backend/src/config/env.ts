import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { loadRepositoryEnv } from "./loadRepositoryEnv.js";

const repositoryRoot = loadRepositoryEnv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /**
   * Data-tier selector. `prod` uses the production application database;
   * `test` uses a dedicated test database so simulation/automation never
   * contaminate production data. Defaults to `test` under NODE_ENV=test.
   */
  DB_TIER: z.enum(["test", "prod"]).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  /**
   * Public base URL advertised in the generated OpenAPI document's `servers`
   * entry. Defaults to a local URL derived from `PORT`; override when the API
   * is exposed behind a proxy or on a different host.
   */
  PUBLIC_API_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10000),
  HTTP_LOGGING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  DATABASE_PATH: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

const tier: "test" | "prod" =
  parsed.DB_TIER ?? (parsed.NODE_ENV === "test" ? "test" : "prod");

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  DB_TIER: tier,
  PORT: parsed.PORT,
  PUBLIC_API_URL: parsed.PUBLIC_API_URL ?? `http://localhost:${parsed.PORT}`,
  CORS_ORIGIN: parsed.CORS_ORIGIN,
  RATE_LIMIT_WINDOW_MS: parsed.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX: parsed.RATE_LIMIT_MAX,
  HTTP_LOGGING: parsed.HTTP_LOGGING,
  DATABASE_PATH: parsed.DATABASE_PATH
    ? isAbsolute(parsed.DATABASE_PATH)
      ? parsed.DATABASE_PATH
      : resolve(repositoryRoot, parsed.DATABASE_PATH)
    : resolve(
        repositoryRoot,
        `.runtime/backend/application${tier === "test" ? "-test" : ""}.db`,
      ),
};
