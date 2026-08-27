import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createDependencies,
  type AppDependencies,
} from "../../src/dependencies.js";

let dependencies: AppDependencies;
beforeEach(() => {
  dependencies = createDependencies(":memory:");
});
afterEach(() => dependencies.database.close());

describe("GET /health", () => {
  it("returns backend health using the standard response format", async () => {
    const response = await request(createApp(dependencies))
      .get("/health")
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      statusCode: 200,
      message: "Backend is healthy",
      data: { status: "ok" },
    });
  });
});
