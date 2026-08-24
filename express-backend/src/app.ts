import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { CORS, IS_PRODUCTION, SERVER } from "./config/constants.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { requestContext } from "./middleware/requestContext.js";
import { dashboardRouter } from "./routes/dashboard_route.js";
import { healthRouter } from "./routes/health_route.js";
import { masterDataRouter } from "./routes/masterdata_route.js";

export const app = express();

app.use(requestContext);
app.use(helmet({ contentSecurityPolicy: IS_PRODUCTION, crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(
  cors({
    origin: CORS.origins,
    credentials: CORS.credentials,
    exposedHeaders: [...CORS.exposedHeaders],
    maxAge: CORS.maxAgeSeconds,
  }),
);
app.use(rateLimiter.global);
app.use(compression());
app.use(express.json({ limit: SERVER.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: SERVER.bodyLimit }));

app.get("/", (_req, res) => {
  res.json({ status: "working", api: SERVER.apiPrefix });
});

app.use(`${SERVER.apiPrefix}/health`, healthRouter);
app.use(SERVER.apiPrefix, masterDataRouter);
app.use(`${SERVER.apiPrefix}/dashboard`, dashboardRouter);

app.use(notFound);
app.use(errorHandler);
