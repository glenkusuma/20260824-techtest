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

const healthyPayload = () => ({
  schemaVersion: "1.0",
  source: "telemetry-simulator",
  siteId: DEMO_SITES[0]!.id,
  inverterId: DEMO_SITES[0]!.inverterId,
  observedAt: "2026-08-24T01:00:00.000Z",
  status: "running",
  errorCode: null,
  metrics: {
    acPowerW: 1500,
    acVoltageV: 230.4,
    frequencyHz: 50.01,
    energyTodayWh: 800,
    energyTotalWh: 12500800,
  },
});

describe("telemetry API", () => {
  it("lists seeded sites including their configured inverter", async () => {
    const response = await request(createApp(dependencies)).get(
      "/api/v1/sites",
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].inverterId).toBe("inv-cikarang-a-01");
  });

  it("stores an idempotent telemetry reading", async () => {
    const payload = healthyPayload();
    const app = createApp(dependencies);
    const first = await request(app).post("/api/v1/telemetry").send(payload);
    const second = await request(app).post("/api/v1/telemetry").send(payload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.inverterId).toBe(payload.inverterId);
  });

  it("rejects a conflicting duplicate at the same site timestamp", async () => {
    const payload = healthyPayload();
    const app = createApp(dependencies);
    expect(
      (await request(app).post("/api/v1/telemetry").send(payload)).status,
    ).toBe(201);
    const conflict = await request(app)
      .post("/api/v1/telemetry")
      .send({ ...payload, metrics: { ...payload.metrics, acPowerW: 1400 } });
    expect(conflict.status).toBe(409);
  });

  it("rejects telemetry from an inverter not configured for the site", async () => {
    const response = await request(createApp(dependencies))
      .post("/api/v1/telemetry")
      .send({ ...healthyPayload(), inverterId: "inv-other" });
    expect(response.status).toBe(409);
  });

  it("rejects power above configured inverter capacity", async () => {
    const payload = healthyPayload();
    payload.metrics.acPowerW = 6000;
    const response = await request(createApp(dependencies))
      .post("/api/v1/telemetry")
      .send(payload);
    expect(response.status).toBe(400);
  });

  it("returns collection records after a cursor", async () => {
    const response = await request(createApp(dependencies)).get(
      "/api/v1/telemetry?afterId=20&limit=3",
    );
    expect(response.status).toBe(200);
    expect(
      response.body.data.records.map((row: { id: number }) => row.id),
    ).toEqual([21, 22, 23]);
    expect(response.body.data.hasMore).toBe(true);
  });
});
