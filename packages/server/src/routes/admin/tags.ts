import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { requireAdmin, requireSuperAdmin } from "../auth.js";

const tagSchema = z.object({
  name: z.string().min(1).max(30)
});

async function listTags() {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { channels: true } } },
    orderBy: { name: "asc" }
  });
  return tags.map((tag) => ({ id: tag.id, name: tag.name, channelCount: tag._count.channels }));
}

export async function registerAdminTagRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/tags", { onRequest: requireAdmin }, async () => listTags());

  app.post("/admin/tags", { onRequest: requireSuperAdmin }, async (req, reply) => {
    const parsed = tagSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Bad request" });
    try {
      const tag = await prisma.tag.create({ data: { name: parsed.data.name } });
      return reply.status(201).send({ id: tag.id, name: tag.name, channelCount: 0 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ error: "tag already exists" });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/admin/tags/:id", { onRequest: requireSuperAdmin }, async (req, reply) => {
    const parsed = tagSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Bad request" });
    try {
      const tag = await prisma.tag.update({ where: { id: req.params.id }, data: { name: parsed.data.name } });
      return { id: tag.id, name: tag.name };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ error: "tag already exists" });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return reply.status(404).send({ error: "Not found" });
      }
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/admin/tags/:id", { onRequest: requireSuperAdmin }, async (req, reply) => {
    try {
      await prisma.tag.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return reply.status(404).send({ error: "Not found" });
      }
      throw error;
    }
  });
}
