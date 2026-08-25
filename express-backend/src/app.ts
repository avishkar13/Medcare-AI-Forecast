import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { CORS, IS_PRODUCTION, SERVER } from "./config/constants.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { currentUser } from "./middleware/currentUser.js";
import { requestContext } from "./middleware/requestContext.js";
import { dashboardRouter } from "./routes/dashboard_route.js";
import { healthRouter } from "./routes/health_route.js";
import { inventoryRouter } from "./routes/inventory_route.js";
import { masterDataRouter } from "./routes/masterdata_route.js";
import { planningRouter } from "./routes/planning_route.js";
import { scenarioRouter } from "./routes/scenario_route.js";
import { trainingRouter } from "./routes/training_route.js";
import { alertsRouter } from "./routes/alerts_route.js";
import { expiryRouter } from "./routes/expiry_route.js";
import { forecastRouter } from "./routes/forecast_route.js";
import { recommendationsRouter } from "./routes/recommendations_route.js";
import { settingsRouter } from "./routes/settings_route.js";
import { simulationRouter } from "./routes/simulation_route.js";

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

// After the parsers, before the routes: everything downstream reads req.userId.
app.use(currentUser);

app.get("/", (_req, res) => {
  res.json({ status: "working", api: SERVER.apiPrefix });
});

app.use(`${SERVER.apiPrefix}/health`, healthRouter);
app.use(SERVER.apiPrefix, masterDataRouter);
app.use(`${SERVER.apiPrefix}/dashboard`, dashboardRouter);
app.use(`${SERVER.apiPrefix}/planning`, planningRouter);
app.use(`${SERVER.apiPrefix}/scenarios`, scenarioRouter);
app.use(`${SERVER.apiPrefix}/inventory`, inventoryRouter);
app.use(`${SERVER.apiPrefix}/training-data`, trainingRouter);
app.use(`${SERVER.apiPrefix}/alerts`, alertsRouter);
app.use(`${SERVER.apiPrefix}/expiry`, expiryRouter);
app.use(`${SERVER.apiPrefix}/forecast`, forecastRouter);
app.use(`${SERVER.apiPrefix}/recommendations`, recommendationsRouter);
app.use(`${SERVER.apiPrefix}/settings`, settingsRouter);
app.use(`${SERVER.apiPrefix}/simulation`, simulationRouter);

app.use(notFound);
app.use(errorHandler);
