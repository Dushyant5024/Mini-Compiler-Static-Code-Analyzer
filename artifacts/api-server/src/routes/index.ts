import { Router, type IRouter } from "express";
import healthRouter from "./health";
import compilerRouter from "./compiler";
import samplesRouter from "./samples";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/compiler", compilerRouter);
router.use("/samples", samplesRouter);

export default router;
