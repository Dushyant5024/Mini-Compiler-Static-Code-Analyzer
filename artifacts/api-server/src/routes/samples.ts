import { Router } from "express";
import type { Request, Response } from "express";
import { SAMPLE_PROGRAMS, getSampleById } from "../compiler/samples.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json(SAMPLE_PROGRAMS.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    source: s.source,
    category: s.category,
  })));
});

router.get("/:id", (req: Request, res: Response) => {
  const sample = getSampleById(req.params.id!);
  if (!sample) {
    res.status(404).json({ error: "Sample not found" });
    return;
  }
  res.json(sample);
});

export default router;
