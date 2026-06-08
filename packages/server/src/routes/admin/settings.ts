import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { APP_CONFIG_DEFAULTS, type AppConfigKey } from "../../config/defaults.js";
import { configStore } from "../../config/store.js";
import { prisma } from "../../db/client.js";
import { requireSuperAdmin } from "../auth.js";

const configRanges: Record<AppConfigKey, { min: number; max: number }> = {
  MAX_ACTIVE_CHANNELS: { min: 1, max: 1000 },
  ALWAYS_ON_ACTIVE_CHANNELS: { min: 0, max: 1 },
  HLS_SEGMENT_DURATION: { min: 1, max: 30 },
  HLS_WINDOW_SIZE: { min: 1, max: 20 },
  IDLE_TIMEOUT_MS: { min: 1000, max: 600000 },
  MAX_RETRY: { min: 0, max: 10 },
  SUBMISSION_RATE_LIMIT: { min: 1, max: 100 }
};

const configKeys = Object.keys(APP_CONFIG_DEFAULTS) as AppConfigKey[];

const settingsPatchSchema = z
  .record(z.coerce.number().int())
  .superRefine((value, ctx) => {
    for (const [key, numberValue] of Object.entries(value)) {
      if (!configKeys.includes(key as AppConfigKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "未知配置项"
        });
        continue;
      }
      const range = configRanges[key as AppConfigKey];
      if (numberValue < range.min || numberValue > range.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `必须在 ${range.min}-${range.max} 之间`
        });
      }
    }
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

async function readSettings() {
  const rows = await prisma.appConfig.findMany();
  const rowMap = new Map(rows.map((row) => [row.key, row]));
  return configKeys.map((key) => {
    const row = rowMap.get(key);
    const defaultValue = Number.parseInt(APP_CONFIG_DEFAULTS[key], 10);
    return {
      key,
      value: Number.parseInt(row?.value ?? APP_CONFIG_DEFAULTS[key], 10),
      defaultValue,
      min: configRanges[key].min,
      max: configRanges[key].max,
      updatedAt: row?.updatedAt.toISOString() ?? null
    };
  });
}

export async function registerAdminSettingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/settings", { onRequest: requireSuperAdmin }, async () => readSettings());

  app.patch("/admin/settings", { onRequest: requireSuperAdmin }, async (req, reply) => {
    const parsed = settingsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

    await prisma.$transaction(
      Object.entries(parsed.data).map(([key, value]) =>
        prisma.appConfig.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        })
      )
    );
    await configStore.refresh();
    return readSettings();
  });
}
