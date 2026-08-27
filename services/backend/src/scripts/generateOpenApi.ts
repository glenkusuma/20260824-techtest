import { writeFileSync } from "node:fs";
import { env } from "../config/env.js";
import { generateOpenApiDocument } from "../openapi/document.js";

const OUTPUT_PATH = new URL("../../openapi/openapi.json", import.meta.url);

/**
 * (Re)writes the committed `openapi/openapi.json` artifact so Swagger docs and
 * any external tooling always reflect the current Zod schemas and routes.
 * Invoke via `npm run generate:openapi` from the backend package.
 *
 * The running server serves the document in memory (from
 * {@link generateOpenApiDocument}); this script only emits the artifact for
 * review, diffing, and non-served consumers.
 *
 * @example
 * npm run generate:openapi
 */
writeFileSync(
  OUTPUT_PATH,
  `${JSON.stringify(generateOpenApiDocument(env.PUBLIC_API_URL), null, 2)}\n`,
  "utf-8",
);
