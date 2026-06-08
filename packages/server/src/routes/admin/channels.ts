import type { FastifyInstance } from "fastify";
import { Prisma, Protocol } from "@prisma/client";
import { z } from "zod";
import { channelRegistry, type RegistryChannel } from "../../channels/registry.js";
import { prisma } from "../../db/client.js";
import { validateUrl } from "../../security/ssrf.js";
import { requireAdmin, requireSuperAdmin } from "../auth.js";

const reservedSlugs = new Set(["api", "admin", "stream", "health"]);
const slugSchema = z.string().regex(/^[a-z0-9-]+$/).min(1).max(50).refine((value) => !reservedSlugs.has(value));

const includeChannel = {
  source: true,
  tags: { include: { tag: true } }
} satisfies Prisma.ChannelInclude;

function runtimeFor(channel: { id: string; status: "ACTIVE" | "INACTIVE" }) {
  return channelRegistry.runtime(channel.id) ?? {
    state: channel.status === "ACTIVE" ? "idle" : "inactive",
    retryCount: 0,
    lastHeartbeat: null,
    listenerCount: 0,
    hlsPollerCount: 0,
    idleSecondsRemaining: null
  };
}

function serializeChannel(channel: RegistryChannel, role: "SUPERADMIN" | "MODERATOR") {
  return {
    id: channel.id,
    slug: channel.slug,
    name: channel.name,
    description: channel.description,
    featured: channel.featured,
    status: channel.status,
    tags: channel.tags.map((item) => ({ id: item.tag.id, name: item.tag.name })),
    source: role === "SUPERADMIN" && channel.source ? { protocol: channel.source.protocol, url: channel.source.url } : null,
    runtime: runtimeFor(channel)
  };
}

const createSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  sourceUrl: z.string().min(1),
  sourceProtocol: z.nativeEnum(Protocol),
  tagIds: z.array(z.string()).default([]),
  featured: z.boolean().default(false)
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  featured: z.boolean().optional(),
  tagIds: z.array(z.string()).optional()
});

function validationError(error: z.ZodError) {
  return {
    error: "请求参数不合法",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}

export async function registerAdminChannelRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/channels", { onRequest: requireAdmin }, async (req) => {
    const channels = await prisma.channel.findMany({
      include: includeChannel,
      orderBy: { createdAt: "desc" }
    });
    return channels.map((channel) => serializeChannel(channel, req.user.role));
  });

  app.post("/admin/channels", { onRequest: requireSuperAdmin }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
    const validatedUrl = await validateUrl(parsed.data.sourceUrl).catch((error: Error) => error);
    if (validatedUrl instanceof Error) return reply.status(400).send({ error: validatedUrl.message });

    try {
      const channel = await prisma.channel.create({
        data: {
          slug: parsed.data.slug,
          name: parsed.data.name,
          description: parsed.data.description,
          featured: parsed.data.featured,
          source: {
            create: {
              protocol: parsed.data.sourceProtocol,
              url: validatedUrl.toString()
            }
          },
          tags: {
            create: parsed.data.tagIds.map((tagId) => ({ tagId }))
          }
        },
        include: includeChannel
      });
      channelRegistry.add(channel);
      return reply.status(201).send(serializeChannel(channel, req.user.role));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ error: "slug 已被使用" });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/admin/channels/:id", { onRequest: requireSuperAdmin }, async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

    const channel = await prisma.$transaction(async (tx) => {
      const updated = await tx.channel.update({
        where: { id: req.params.id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          featured: parsed.data.featured
        }
      });
      if (parsed.data.tagIds) {
        await tx.channelTag.deleteMany({ where: { channelId: req.params.id } });
        if (parsed.data.tagIds.length > 0) {
          await tx.channelTag.createMany({
            data: parsed.data.tagIds.map((tagId) => ({ channelId: req.params.id, tagId })),
            skipDuplicates: true
          });
        }
      }
      return tx.channel.findUniqueOrThrow({ where: { id: updated.id }, include: includeChannel });
    });
    await channelRegistry.reload(channel.id);
    return serializeChannel(channel, req.user.role);
  });

  app.patch<{ Params: { id: string } }>("/admin/channels/:id/status", { onRequest: requireSuperAdmin }, async (req, reply) => {
    const parsed = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

    await prisma.channel.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status }
    });
    if (parsed.data.status === "INACTIVE") {
      await channelRegistry.stopById(req.params.id);
      const entry = channelRegistry.getById(req.params.id);
      if (entry) await channelRegistry.remove(entry.channel.slug);
    } else {
      await channelRegistry.reload(req.params.id);
    }
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/admin/channels/:id/runtime", { onRequest: requireAdmin }, async (req, reply) => {
    const channel = await prisma.channel.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!channel) return reply.status(404).send({ error: "Not found" });
    return runtimeFor(channel);
  });

  app.post<{ Params: { id: string } }>("/admin/channels/:id/start", { onRequest: requireSuperAdmin }, async (req, reply) => {
    try {
      await channelRegistry.forceStart(req.params.id);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "START_FAILED";
      const status = message === "MAX_ACTIVE_CHANNELS" ? 429 : message === "CHANNEL_NOT_FOUND" ? 404 : 400;
      return reply.status(status).send({ error: message });
    }
  });

  app.post<{ Params: { id: string } }>("/admin/channels/:id/stop", { onRequest: requireSuperAdmin }, async (req) => {
    await channelRegistry.stopById(req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/admin/channels/:id/reset-error", { onRequest: requireSuperAdmin }, async (req, reply) => {
    if (!channelRegistry.resetError(req.params.id)) {
      return reply.status(400).send({ error: "当前状态不是 error" });
    }
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/admin/channels/:id/source-history", { onRequest: requireSuperAdmin }, async (req) => {
    return prisma.sourceHistory.findMany({
      where: { channelId: req.params.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, protocol: true, url: true, replacedBy: true, createdAt: true }
    });
  });
}
