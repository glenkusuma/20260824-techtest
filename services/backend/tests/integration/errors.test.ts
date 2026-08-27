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

describe("API error handling", () => {
  it("returns a standardized 404 response for unknown routes", async () => {
    const response = await request(createApp(dependencies))
      .get("/unknown-route")
      .expect(404);
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 404,
      message: "Route not found: GET /unknown-route",
    });
  });
});
