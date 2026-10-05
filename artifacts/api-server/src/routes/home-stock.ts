import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  homeStockSyncTable,
} from "@workspace/db";
import {
  GetHomeStockResponse,
  SaveHomeStockBody,
  SaveHomeStockResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/home-stock", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to access cloud sync." });
    return;
  }

  const [saved] = await db
    .select()
    .from(homeStockSyncTable)
    .where(eq(homeStockSyncTable.userId, userId))
    .limit(1);

  res.json(
    GetHomeStockResponse.parse({
      data: saved?.data ?? null,
      updatedAt: saved?.updatedAt.toISOString() ?? null,
    }),
  );
});

router.put("/home-stock", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to access cloud sync." });
    return;
  }

  const parsed = SaveHomeStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [saved] = await db
    .insert(homeStockSyncTable)
    .values({
      userId,
      data: parsed.data.data,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: homeStockSyncTable.userId,
      set: {
        data: parsed.data.data,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(
    SaveHomeStockResponse.parse({
      data: saved.data,
      updatedAt: saved.updatedAt.toISOString(),
    }),
  );
});

export default router;