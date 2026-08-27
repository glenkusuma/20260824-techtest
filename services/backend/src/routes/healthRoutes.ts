import { Router } from "express";
import { getHealth } from "../controllers/healthController.js";

/**
 * Router exposing the service health check at `GET /health`.
 * @see {@link getHealth}
 */
const router = Router();

router.get("/", getHealth);

export default router;
