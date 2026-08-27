import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Finds the repository root from either a root command or an npm workspace cwd,
 * then loads `.env` when present. Existing shell/test/container variables are not
 * overwritten by Node's native `process.loadEnvFile`.
 */
export const loadRepositoryEnv = (): string => {
  const roots = [process.cwd(), resolve(process.cwd(), "../..")];
  const repositoryRoot =
    roots.find((candidate) => existsSync(resolve(candidate, ".env.example"))) ??
    process.cwd();
  const envFile = resolve(repositoryRoot, ".env");
  if (process.env.NODE_ENV !== "test" && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  return repositoryRoot;
};
