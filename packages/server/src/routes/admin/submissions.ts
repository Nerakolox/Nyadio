import type { FastifyInstance } from "fastify";
import { Prisma, Protocol, SubmissionStatus } from "@prisma/client";
import { z } from "zod";
import { channelRegistry } from "../../channels/registry.js";
import { prisma } from "../../db/client.js";
import { validateUrl } from "../../security/ssrf.js";
import { requireAdmin } from "../auth.js";

const reservedSlugs = new Set(["api", "admin", "stream", "health"]);
const slugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/)
  .refine((value) => !reservedSlugs.has(value), "slug 是保留字");

const listQuerySchema = z.object({
  status: z.nativeEnum(SubmissionStatus).default("PENDING"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const reviewSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    channelId: z.string().min(1),
    protocol: z.nativeEnum(Protocol).optional(),
    reviewNote: z.string().max(500).optional().nullable()
  }),
  z.object({
    action: z.literal("approve_as_new"),
    newChannel: z.object({
      slug: slugSchema,
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional().nullable(),
      tagIds: z.array(z.string()).default([]),
      featured: z.boolean().default(false)
    }),
    protocol: z.nativeEnum(Protocol).optional(),
    reviewNote: z.string().max(500).optional().nullable()
  }),
  z.object({
    action: z.literal("reject"),
    reviewNote: z.string().max(500).optional().nullable()
  })
]);

const includeSubmission = {
  targetChannel: { select: { id: true, slug: true, name: true } },
  reviewer: { select: { id: true, username: true, role: true } }
} satisfies Prisma.SubmissionInclude;

const includeRegistryChannel = {
  source: true,
  tags: { include: { tag: true } }
} satisfies Prisma.ChannelInclude;

function validationError(error: z.ZodError) {
  return {
    error: "请求参数不合法",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}

function serializeSubmission(submission: Prisma.SubmissionGetPayload<{ include: typeof includeSubmission }>) {
  return {
    id: submission.id,
    url: submission.url,
    protocol: submission.protocol,
    targetChannelId: submission.targetChannelId,
    targetChannel: submission.targetChannel,
    suggestedSlug: submission.suggestedSlug,
    suggestedName: submission.suggestedName,
    note: submission.note,
    contact: submission.contact,
    status: submission.status,
    createdAt: submission.createdAt.toISOString(),
    reviewer: submission.reviewer,
    reviewNote: submission.reviewNote,
    reviewedAt: submission.status === "PENDING" ? null : submission.updatedAt.toISOString()
  };
}

function normalizeNote(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function registerAdminSubmissionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/submissions", { onRequest: requireAdmin }, async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

    const where = { status: parsed.data.status };
    const [total, items] = await prisma.$transaction([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        include: includeSubmission,
        orderBy: { createdAt: "desc" },
        skip: (parsed.data.page - 1) * parsed.data.limit,
        take: parsed.data.limit
      })
    ]);

    return {
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
      items: items.map(serializeSubmission)
    };
  });

  app.patch<{ Params: { id: string } }>("/admin/submissions/:id/review", { onRequest: requireAdmin }, async (req, reply) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

    const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!submission) return reply.status(404).send({ error: "投稿不存在" });
    if (submission.status !== "PENDING") return reply.status(409).send({ error: "投稿已审核" });

    if (parsed.data.action === "reject") {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: "REJECTED",
          reviewedBy: req.user.id,
          reviewNote: normalizeNote(parsed.data.reviewNote)
        }
      });
      return { ok: true };
    }

    const validatedUrl = await validateUrl(submission.url).catch((error: Error) => error);
    if (validatedUrl instanceof Error) return reply.status(400).send({ error: "SUBMISSION_URL_INVALID" });
    const approvedUrl = validatedUrl.toString();

    if (parsed.data.action === "approve") {
      const approvedProtocol = parsed.data.protocol ?? submission.protocol;
      const channel = await prisma.channel.findUnique({
        where: { id: parsed.data.channelId },
        include: { source: true }
      });
      if (!channel) return reply.status(404).send({ error: "频道不存在" });

      await prisma.$transaction(async (tx) => {
        if (channel.source) {
          await tx.sourceHistory.create({
            data: {
              channelId: channel.id,
              protocol: channel.source.protocol,
              url: channel.source.url,
              replacedBy: submission.id
            }
          });
        }
        await tx.source.upsert({
          where: { channelId: channel.id },
          update: { protocol: approvedProtocol, url: approvedUrl },
          create: { channelId: channel.id, protocol: approvedProtocol, url: approvedUrl }
        });
        await tx.submission.update({
          where: { id: submission.id },
          data: {
            status: "APPROVED",
            protocol: approvedProtocol,
            reviewedBy: req.user.id,
            reviewNote: normalizeNote(parsed.data.reviewNote)
          }
        });
      });

      await channelRegistry.reload(channel.id);
      return { ok: true, channelId: channel.id };
    }

    const approveAsNew = parsed.data;
    const approvedProtocol = approveAsNew.protocol ?? submission.protocol;
    const existing = await prisma.channel.findUnique({
      where: { slug: approveAsNew.newChannel.slug },
      select: { id: true }
    });
    if (existing) return reply.status(409).send({ error: `slug "${approveAsNew.newChannel.slug}" 已被使用` });

    try {
      const channel = await prisma.$transaction(async (tx) => {
        const created = await tx.channel.create({
          data: {
            slug: approveAsNew.newChannel.slug,
            name: approveAsNew.newChannel.name,
            description: normalizeNote(approveAsNew.newChannel.description),
            featured: approveAsNew.newChannel.featured,
            tags: {
              create: approveAsNew.newChannel.tagIds.map((tagId: string) => ({ tagId }))
            },
            source: {
              create: { protocol: approvedProtocol, url: approvedUrl }
            }
          },
          include: includeRegistryChannel
        });
        await tx.submission.update({
          where: { id: submission.id },
          data: {
            status: "APPROVED",
            protocol: approvedProtocol,
            reviewedBy: req.user.id,
            reviewNote: normalizeNote(approveAsNew.reviewNote)
          }
        });
        return created;
      });
      channelRegistry.add(channel);
      return { ok: true, channelId: channel.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ error: `slug "${approveAsNew.newChannel.slug}" 已被使用` });
      }
      throw error;
    }
  });
}
