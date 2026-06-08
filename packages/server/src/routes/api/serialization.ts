import type { FastifyRequest } from "fastify";
import type { ChannelStatus, Prisma } from "@prisma/client";
import { channelRegistry, type ChannelState } from "../../channels/registry.js";

export type PublicChannelRecord = Prisma.ChannelGetPayload<{
  include: { tags: { include: { tag: true } } };
}>;

export type PlayState = "live" | "preparing" | "unavailable" | "inactive";

export function playStateFor(channelId: string, status: ChannelStatus): PlayState {
  const state = channelRegistry.statusFor(channelId, status);
  return playStateFromRuntime(state);
}

function playStateFromRuntime(state: ChannelState | "inactive"): PlayState {
  if (state === "running") return "live";
  if (state === "error") return "unavailable";
  if (state === "inactive") return "inactive";
  return "preparing";
}

export function isOnline(playState: PlayState): boolean {
  return playState === "live" || playState === "preparing";
}

export function decayedPopularity(channel: { popularity: number; lastDecayAt: Date }, now = Date.now()): number {
  const elapsedDays = Math.max(0, now - channel.lastDecayAt.getTime()) / 86_400_000;
  return channel.popularity * Math.pow(0.9, elapsedDays);
}

export function serializePublicChannel(channel: PublicChannelRecord, now = Date.now()) {
  const playState = playStateFor(channel.id, channel.status);
  const entry = channelRegistry.getById(channel.id);
  return {
    id: channel.id,
    slug: channel.slug,
    name: channel.name,
    description: channel.description,
    featured: channel.featured,
    tags: channel.tags.map((item) => item.tag.name),
    online: isOnline(playState),
    playState,
    listenerCount: entry?.listenerCount ?? 0,
    popularity: decayedPopularity(channel, now)
  };
}

export function publicOutputUrls(req: FastifyRequest, slug: string) {
  const origin = requestOrigin(req);
  const encodedSlug = encodeURIComponent(slug);
  return {
    hls: `${origin}/stream/${encodedSlug}/index.m3u8`,
    stream: `${origin}/stream/${encodedSlug}/audio.aac`
  };
}

function requestOrigin(req: FastifyRequest): string {
  const forwardedProto = headerFirst(req.headers["x-forwarded-proto"]);
  const forwardedHost = headerFirst(req.headers["x-forwarded-host"]);
  const proto = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function headerFirst(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(",")[0]?.trim() || null;
}
