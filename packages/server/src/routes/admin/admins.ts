import type { FastifyInstance } from "fastify";
import { AdminRole, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { hashPassword, requireSuperAdmin } from "../auth.js";

const createAdminSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
  role: z.nativeEnum(AdminRole)
});

const statusSchema = z.object({
  disabled: z.boolean()
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

function serializeAdmin(admin: {
  id: string;
  username: string;
  role: AdminRole;
  disabled: boolean;
  createdAt: Date;
}) {
  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    disabled: admin.disabled,
    createdAt: admin.createdAt.toISOString()
  };
}

export async function registerAdminUserRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/admins", { onRequest: requireSuperAdmin }, async () => {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        role: true,
        disabled: true,
        createdAt: true
      }
    });
    return admins.map(serializeAdmin);
  });

  app.post("/admin/admins", { onRequest: requireSuperAdmin }, async (req, reply) => {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

    try {
      const admin = await prisma.adminUser.create({
        data: {
          username: parsed.data.username,
          passwordHash: await hashPassword(parsed.data.password),
          role: parsed.data.role
        },
        select: {
          id: true,
          username: true,
          role: true,
          disabled: true,
          createdAt: true
        }
      });
      return reply.status(201).send(serializeAdmin(admin));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ error: "用户名已存在" });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/admin/admins/:id/status", { onRequest: requireSuperAdmin }, async (req, reply) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
    if (req.params.id === req.user.id && parsed.data.disabled) {
      return reply.status(400).send({ error: "不能禁用自己" });
    }

    try {
      await prisma.adminUser.update({
        where: { id: req.params.id },
        data: { disabled: parsed.data.disabled }
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return reply.status(404).send({ error: "管理员不存在" });
      }
      throw error;
    }
  });
}
