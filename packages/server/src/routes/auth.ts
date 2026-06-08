import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { prisma } from "../db/client.js";

const scryptAsync = promisify(scrypt);

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; role: "SUPERADMIN" | "MODERATOR" };
    user: { id: string; role: "SUPERADMIN" | "MODERATOR" };
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) return false;
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hashed, "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.user.id },
      select: { id: true, role: true, disabled: true }
    });
    if (!admin || admin.disabled) {
      await reply.status(401).send({ error: "Unauthorized" });
      return;
    }
    req.user = { id: admin.id, role: admin.role };
  } catch {
    await reply.status(401).send({ error: "Unauthorized" });
  }
}

export async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAdmin(req, reply);
  if (reply.sent) return;
  if (req.user.role !== "SUPERADMIN") {
    await reply.status(403).send({ error: "Forbidden" });
  }
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/admin/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute"
        }
      }
    },
    async (req, reply) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Bad request" });

      const admin = await prisma.adminUser.findUnique({ where: { username: parsed.data.username } });
      if (!admin || admin.disabled || !(await verifyPassword(parsed.data.password, admin.passwordHash))) {
        return reply.status(401).send({ error: "Invalid username or password" });
      }

      const token = app.jwt.sign({ id: admin.id, role: admin.role }, { expiresIn: "8h" });
      return reply.send({ token });
    }
  );
}
