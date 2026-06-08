import type { FastifyInstance, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { setTimeout as sleep } from "node:timers/promises";
import { channelRegistry, type ChannelEntry } from "../channels/registry.js";
import { prisma } from "../db/client.js";
import { readHlsFile } from "../outputs/hls.js";

async function ensureStreamable(entry: ChannelEntry, reply: FastifyReply): Promise<boolean> {
  if (entry.channel.status === "INACTIVE") {
    await reply.status(503).send({ error: "Channel is inactive" });
    return false;
  }
  if (entry.state === "error") {
    await reply.status(503).send({ error: "Channel is unavailable" });
    return false;
  }
  try {
    await channelRegistry.ensureStarted(entry);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "START_FAILED";
    const status = message === "MAX_ACTIVE_CHANNELS" ? 429 : 503;
    await reply.status(status).send({ error: message });
    return false;
  }
}

async function readWithRetry(slug: string, fileName: string): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await readHlsFile(slug, fileName);
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw lastError;
}

async function bumpPopularity(channelId: string): Promise<void> {
  await prisma.$executeRaw(
    Prisma.sql`UPDATE "Channel"
      SET popularity = popularity * POWER(0.9, EXTRACT(EPOCH FROM (NOW() - "lastDecayAt")) / 86400.0) + 1,
          "lastDecayAt" = NOW()
      WHERE id = ${channelId}`
  );
}

export async function registerStreamRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { slug: string } }>("/stream/:slug/index.m3u8", async (req, reply) => {
    const entry = channelRegistry.get(req.params.slug);
    if (!entry) return reply.status(404).send({ error: "Not found" });
    channelRegistry.heartbeat(entry, "hls");
    if (!(await ensureStreamable(entry, reply))) return;
    try {
      const body = await readWithRetry(req.params.slug, "index.m3u8");
      return reply
        .header("Content-Type", "application/vnd.apple.mpegurl")
        .header("Cache-Control", "no-cache, no-store")
        .header("Access-Control-Allow-Origin", "*")
        .send(body);
    } catch {
      return reply.status(503).send({ error: "Playlist is not ready" });
    }
  });

  app.get<{ Params: { slug: string } }>("/stream/:slug/audio.aac", async (req, reply) => {
    const entry = channelRegistry.get(req.params.slug);
    if (!entry) return reply.status(404).send({ error: "Not found" });
    channelRegistry.heartbeat(entry, "stream");
    if (!(await ensureStreamable(entry, reply))) return;

    await bumpPopularity(entry.channel.id);
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "audio/aac",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff"
    });
    entry.broadcaster.addClient(reply);
    channelRegistry.refreshListenerCount(entry);

    const heartbeat = setInterval(() => {
      channelRegistry.heartbeat(entry, "stream");
    }, 10000);
    heartbeat.unref();

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      entry.broadcaster.removeClient(reply);
      channelRegistry.refreshListenerCount(entry);
    });
  });

  app.get<{ Params: { slug: string; n: string } }>("/stream/:slug/seg_:n.aac", async (req, reply) => {
    const entry = channelRegistry.get(req.params.slug);
    if (!entry) return reply.status(404).send({ error: "Not found" });
    if (!/^\d+$/.test(req.params.n)) return reply.status(404).send({ error: "Not found" });
    channelRegistry.heartbeat(entry, "segment");
    try {
      const body = await readHlsFile(req.params.slug, `seg_${req.params.n}.aac`);
      return reply
        .header("Content-Type", "video/mp2t")
        .header("Cache-Control", "max-age=60")
        .header("Access-Control-Allow-Origin", "*")
        .send(body);
    } catch {
      return reply.status(404).send({ error: "Not found" });
    }
  });
}
