import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createDependencies,
  type AppDependencies,
} from "../../src/dependencies.js";
import { DEMO_SITES, resetDemoData } from "../../src/seed/demoSeed.js";

let dependencies: AppDependencies;

beforeEach(() => {
  dependencies = createDependencies(":memory:");
  resetDemoData(dependencies.database.connection);
});

afterEach(() => dependencies.database.close());

describe("site CRUD", () => {
  it("creates an unprotected site and returns it via GET", async () => {
    const app = createApp(dependencies);
    const create = await request(app).post("/api/v1/sites").send({
      name: "Test Roof",
      location: "Bandung",
      pvPeakPowerW: 7000,
      inverterAcPowerW: 6000,
      timezone: "Asia/Jakarta",
    });
    expect(create.status).toBe(201);
    expect(create.body.data.protected).toBe(false);

    const get = await request(app).get(`/api/v1/sites/${create.body.data.id}`);
    expect(get.status).toBe(200);
    expect(get.body.data.name).toBe("Test Roof");
  });

  it("updates a site via PATCH", async () => {
    const app = createApp(dependencies);
    const id = DEMO_SITES[0]!.id;
    const update = await request(app).patch(`/api/v1/sites/${id}`).send({
      location: "Cikarang, West Java (Updated)",
    });
    expect(update.status).toBe(200);
    expect(update.body.data.location).toBe("Cikarang, West Java (Updated)");
    expect(update.body.data.name).toBe(DEMO_SITES[0]!.name);
  });

  it("rejects updating an unknown site", async () => {
    const app = createApp(dependencies);
    const response = await request(app)
      .patch("/api/v1/sites/does-not-exist")
      .send({ name: "Ghost" });
    expect(response.status).toBe(404);
  });

  it("deletes an unprotected site", async () => {
    const app = createApp(dependencies);
    const created = await request(app).post("/api/v1/sites").send({
      name: "Temp Roof",
      location: "Bandung",
      pvPeakPowerW: 7000,
      inverterAcPowerW: 6000,
      timezone: "Asia/Jakarta",
    });
    const remove = await request(app).delete(
      `/api/v1/sites/${created.body.data.id}`,
    );
    expect(remove.status).toBe(204);
    const get = await request(app).get(`/api/v1/sites/${created.body.data.id}`);
    expect(get.status).toBe(404);
  });

  it("refuses to delete a protected demo site", async () => {
    const app = createApp(dependencies);
    const id = DEMO_SITES[0]!.id;
    const remove = await request(app).delete(`/api/v1/sites/${id}`);
    expect(remove.status).toBe(409);
    const get = await request(app).get(`/api/v1/sites/${id}`);
    expect(get.status).toBe(200);
  });

  it("returns 404 when deleting an unknown site", async () => {
    const app = createApp(dependencies);
    const response = await request(app).delete("/api/v1/sites/does-not-exist");
    expect(response.status).toBe(404);
  });
});
