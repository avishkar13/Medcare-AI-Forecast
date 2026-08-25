import { Router } from "express";
import { simulationController } from "../controller/simulationcontroller.js";

export const simulationRouter = Router();

simulationRouter.post("/run", simulationController.run);
simulationRouter.get("/history", simulationController.getHistory);
simulationRouter.get("/saved", simulationController.getSaved);
simulationRouter.post("/save", simulationController.save);
simulationRouter.delete("/saved/:id", simulationController.deleteSaved);
