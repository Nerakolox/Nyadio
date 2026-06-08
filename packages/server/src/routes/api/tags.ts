import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";

export async function registerPublicTagRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/tags", async () => {
    const tags = await prisma.tag.findMany({
      include: {
        channels: {
          where: { channel: { status: "ACTIVE" } },
          select: { channelId: true }
        }
      }
    });

    return tags
      .map((tag) => ({ id: tag.id, name: tag.name, channelCount: tag.channels.length }))
      .sort((a, b) => b.channelCount - a.channelCount || a.name.localeCompare(b.name, "zh-Hans-CN", { sensitivity: "base" }));
  });
}
