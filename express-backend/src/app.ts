import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { CORS, IS_PRODUCTION, SERVER } from "./config/constants.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { authenticate } from "./middleware/authenticate.js";
import { scopeDc } from "./middleware/scopeDc.js";
import { currentUser } from "./middleware/currentUser.js";
import { requestContext } from "./middleware/requestContext.js";
import { authRouter } from "./routes/auth.route.js";
import { dashboardRouter } from "./routes/dashboard_route.js";
import { healthRouter } from "./routes/health_route.js";
import { inventoryRouter } from "./routes/inventory_route.js";
import { masterDataRouter } from "./routes/masterdata_route.js";
import { modelsRouter } from "./routes/models_route.js";
import { parametersRouter } from "./routes/parameters_route.js";
import { plansRouter } from "./routes/plans_route.js";
import { planningRouter } from "./routes/planning_route.js";
import { scenarioRouter } from "./routes/scenario_route.js";
import { trainingRouter } from "./routes/training_route.js";
import { alertsRouter } from "./routes/alerts_route.js";
import { expiryRouter } from "./routes/expiry_route.js";
import { forecastRouter } from "./routes/forecast_route.js";
import { recommendationsRouter } from "./routes/recommendations_route.js";
import { settingsRouter } from "./routes/settings_route.js";
import { simulationRouter } from "./routes/simulation_route.js";
import { roleRoutes } from "./routes/admin/role.routes.js";
import { userRoutes } from "./routes/admin/user.routes.js";

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
app.use(`${SERVER.apiPrefix}/auth`, authRouter);

// After the parsers and public routes, before the protected routes:
app.use(SERVER.apiPrefix, authenticate);
app.use(SERVER.apiPrefix, scopeDc);
app.use(SERVER.apiPrefix, currentUser);

app.use(SERVER.apiPrefix, masterDataRouter);
app.use(`${SERVER.apiPrefix}/dashboard`, dashboardRouter);
app.use(`${SERVER.apiPrefix}/planning/parameters`, parametersRouter);
app.use(`${SERVER.apiPrefix}/planning/models`, modelsRouter);
app.use(`${SERVER.apiPrefix}/planning`, planningRouter);
app.use(`${SERVER.apiPrefix}/scenarios`, scenarioRouter);
app.use(SERVER.apiPrefix, plansRouter);
app.use(`${SERVER.apiPrefix}/inventory`, inventoryRouter);
app.use(`${SERVER.apiPrefix}/training-data`, trainingRouter);
app.use(`${SERVER.apiPrefix}/alerts`, alertsRouter);
app.use(`${SERVER.apiPrefix}/expiry`, expiryRouter);
app.use(`${SERVER.apiPrefix}/forecast`, forecastRouter);
app.use(`${SERVER.apiPrefix}/recommendations`, recommendationsRouter);
app.use(`${SERVER.apiPrefix}/settings`, settingsRouter);
app.use(`${SERVER.apiPrefix}/simulation`, simulationRouter);

app.use(`${SERVER.apiPrefix}/admin/roles`, roleRoutes);
app.use(`${SERVER.apiPrefix}/admin/users`, userRoutes);

app.use(notFound);
app.use(errorHandler);
