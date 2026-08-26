import { Router } from "express";
import { loginController } from "../controller/auth.controller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/login", rateLimiter.auth, loginController);

export { router as authRouter };
