import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Protocol } from "@prisma/client";
import { z } from "zod";
import { configStore } from "../../config/store.js";
import { prisma } from "../../db/client.js";
import { validateUrl } from "../../security/ssrf.js";

const slugSchema = z.string().min(3).max(50).regex(/^[a-z0-9-]+$/);

const submissionSchema = z
  .object({
    url: z.string().min(1),
    protocol: z.nativeEnum(Protocol),
    targetChannelId: z.string().optional().nullable(),
    suggestedSlug: slugSchema.optional().nullable(),
    suggestedName: z.string().min(1).max(100).optional().nullable(),
    note: z.string().max(500).optional().nullable(),
    contact: z.string().max(100).optional().nullable()
  })
  .superRefine((value, ctx) => {
    const hasTarget = Boolean(value.targetChannelId);
    const hasSuggested = Boolean(value.suggestedSlug || value.suggestedName);
    if (hasTarget && hasSuggested) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetChannelId"],
        message: "不能同时绑定已有频道和建议新建频道"
      });
    }
    if (value.suggestedSlug && !value.suggestedName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestedName"],
        message: "建议新建频道时必须填写名称"
      });
    }
    if (value.suggestedName && !value.suggestedSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestedSlug"],
        message: "建议新建频道时必须填写 slug"
      });
    }
  });

const buckets = new Map<string, { count: number; resetAt: number }>();

function validationError(error: z.ZodError) {
  return {
    error: "请求参数不合法",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}

function clientKey(req: FastifyRequest): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function submissionRateLimit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const now = Date.now();
  const key = clientKey(req);
  const max = configStore.getInt("SUBMISSION_RATE_LIMIT");
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return;
  }
  if (current.count >= max) {
    await reply.status(429).send({ error: "投稿过于频繁，请稍后再试" });
    return;
  }
  current.count += 1;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function registerPublicSubmissionRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/submissions", { preHandler: submissionRateLimit }, async (req, reply) => {
    const parsed = submissionSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

    const validatedUrl = await validateUrl(parsed.data.url).catch((error: Error) => error);
    if (validatedUrl instanceof Error) return reply.status(400).send({ error: "URL 格式有误或包含不支持的地址" });

    const targetChannelId = emptyToNull(parsed.data.targetChannelId);
    if (targetChannelId) {
      const target = await prisma.channel.findUnique({
        where: { id: targetChannelId },
        select: { id: true }
      });
      if (!target) return reply.status(400).send({ error: "目标频道不存在" });
    }

    const submission = await prisma.submission.create({
      data: {
        url: validatedUrl.toString(),
        protocol: parsed.data.protocol,
        targetChannelId,
        suggestedSlug: emptyToNull(parsed.data.suggestedSlug),
        suggestedName: emptyToNull(parsed.data.suggestedName),
        note: emptyToNull(parsed.data.note),
        contact: emptyToNull(parsed.data.contact)
      },
      select: { id: true, status: true, createdAt: true }
    });

    return reply.status(201).send({
      id: submission.id,
      status: submission.status,
      createdAt: submission.createdAt.toISOString()
    });
  });
}
