import type { RequestHandler } from "express";
import { ApiResponse } from "../utils/ApiResponse.js";

/**
 * `GET /health` liveness probe. Returns a fixed `200` with `{ status: "ok" }`
 * inside the standard {@link ApiResponse} envelope so monitoring tooling can
 * treat any 2xx as healthy.
 * @param _req Unused request.
 * @param res The response to write the health payload to.
 */
export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json(
    new ApiResponse(
      200,
      {
        status: "ok",
      },
      "Backend is healthy",
    ),
  );
};
