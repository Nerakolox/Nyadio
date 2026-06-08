import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { publicOutputUrls, serializePublicChannel } from "./serialization.js";

const listQuerySchema = z.object({
  featured: z.enum(["true"]).optional(),
  tag: z.string().min(1).max(30).optional()
});

const includePublicChannel = {
  tags: { include: { tag: true } }
} satisfies Prisma.ChannelInclude;

const includePublicChannelDetail = {
  tags: { include: { tag: true } },
  source: { select: { protocol: true, url: true } }
} satisfies Prisma.ChannelInclude;

type SerializedPublicChannel = ReturnType<typeof serializePublicChannel>;

function sortPublicChannels(channels: SerializedPublicChannel[]) {
  return channels.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    if (b.popularity !== a.popularity) return b.popularity - a.popularity;
    return a.name.localeCompare(b.name, "zh-Hans-CN", { sensitivity: "base" });
  });
}

export async function registerPublicChannelRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/channels", async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: "请求参数不合法" });

    const channels = await prisma.channel.findMany({
      where: {
        status: "ACTIVE",
        featured: parsed.data.featured === "true" ? true : undefined,
        tags: parsed.data.tag ? { some: { tag: { name: parsed.data.tag } } } : undefined
      },
      include: includePublicChannel
    });

    const now = Date.now();
    return sortPublicChannels(channels.map((channel) => serializePublicChannel(channel, now))).map(
      ({ popularity, ...channel }) => channel
    );
  });

  app.get<{ Params: { slug: string } }>("/api/channels/:slug", async (req, reply) => {
    const channel = await prisma.channel.findFirst({
      where: { slug: req.params.slug, status: "ACTIVE" },
      include: includePublicChannelDetail
    });
    if (!channel) return reply.status(404).send({ error: "Not found" });

    const { popularity, ...serialized } = serializePublicChannel(channel);
    void popularity;
    return {
      ...serialized,
      source: channel.source,
      outputs: publicOutputUrls(req, channel.slug)
    };
  });
}
