import { z } from "zod";

export const pageSchema = z.object({
  pageNumber: z.number().int().min(1).max(1000),
});