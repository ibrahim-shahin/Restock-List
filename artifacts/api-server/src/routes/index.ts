import { Router, type IRouter } from "express";
import healthRouter from "./health";
import homeStockRouter from "./home-stock";

const router: IRouter = Router();

router.use(healthRouter);
router.use(homeStockRouter);

export default router;
