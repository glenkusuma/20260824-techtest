import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Finds the repository root and loads `.env` for local npm execution. */
export const loadRepositoryEnv = (): void => {
  const roots = [process.cwd(), resolve(process.cwd(), "../..")];
  const repositoryRoot =
    roots.find((candidate) => existsSync(resolve(candidate, ".env.example"))) ??
    process.cwd();
  const envFile = resolve(repositoryRoot, ".env");
  if (process.env.NODE_ENV !== "test" && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
};
