import { Router } from "express";
import * as masterDataController from "../controller/masterdatacontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const masterDataRouter = Router();

masterDataRouter.get("/products", rateLimiter.read, authorize("inventory:view"), masterDataController.listProducts);
masterDataRouter.get("/products/:id", rateLimiter.read, authorize("inventory:view"), masterDataController.getProduct);
masterDataRouter.get("/warehouses", rateLimiter.read, authorize("inventory:view"), masterDataController.listWarehouses);
masterDataRouter.get("/warehouses/:id", rateLimiter.read, authorize("inventory:view"), masterDataController.getWarehouse);
masterDataRouter.get("/distributors", rateLimiter.read, authorize("inventory:view"), masterDataController.listDistributors);
masterDataRouter.get("/promotions", rateLimiter.read, authorize("inventory:view"), masterDataController.listPromotions);
