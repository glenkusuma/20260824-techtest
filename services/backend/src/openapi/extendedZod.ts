import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

/**
 * Augments the shared {@link z} namespace with the `.openapi()` helper so any
 * schema declared in this codebase can carry OpenAPI metadata and be registered
 * into a generated document.
 *
 * This module is imported by every DTO so the augmentation is applied exactly
 * once, at module load, before any schema that uses `.openapi()` is constructed.
 *
 * @see https://github.com/asteasolutions/zod-to-openapi
 */
extendZodWithOpenApi(z);

/** The extended Zod namespace with `.openapi()` available. */
export { z };
