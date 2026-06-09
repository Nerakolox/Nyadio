import type { ChannelStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { buildFfmpegArgs } from "../ffmpeg/args.js";
import { FfmpegProcess } from "../ffmpeg/process.js";
import { cleanupHlsDir, ensureHlsDir } from "../outputs/hls.js";
import { StreamBroadcaster } from "../outputs/stream.js";
import { configStore } from "../config/store.js";

export type ChannelState = "idle" | "starting" | "running" | "error";

export type RegistryChannel = Prisma.ChannelGetPayload<{
  include: {
    source: true;
    tags: { include: { tag: true } };
  };
}>;

export interface ChannelEntry {
  channel: RegistryChannel;
  state: ChannelState;
  retryCount: number;
  lastHeartbeat: Date;
  listenerCount: number;
  virtualListenerCount: number;
  hlsPollerCount: number;
  process: FfmpegProcess | null;
  broadcaster: StreamBroadcaster;
  startPromise: Promise<void> | null;
}

function includeChannel() {
  return {
    source: true,
    tags: { include: { tag: true } }
  } satisfies Prisma.ChannelInclude;
}

class ChannelRegistry {
  private entries = new Map<string, ChannelEntry>();
  private byId = new Map<string, string>();

  async loadActive(): Promise<void> {
    const channels = await prisma.channel.findMany({
      where: { status: "ACTIVE" },
      include: includeChannel()
    });
    this.entries.clear();
    this.byId.clear();
    for (const channel of channels) this.add(channel);
  }

  get(slug: string): ChannelEntry | undefined {
    return this.entries.get(slug);
  }

  getById(channelId: string): ChannelEntry | undefined {
    const slug = this.byId.get(channelId);
    return slug ? this.entries.get(slug) : undefined;
  }

  list(): ChannelEntry[] {
    return [...this.entries.values()];
  }

  add(channel: RegistryChannel): ChannelEntry {
    const existing = this.entries.get(channel.slug);
    if (existing) {
      existing.channel = channel;
      this.byId.set(channel.id, channel.slug);
      this.syncVirtualListeners(existing);
      return existing;
    }

    const entry: ChannelEntry = {
      channel,
      state: "idle",
      retryCount: 0,
      lastHeartbeat: new Date(0),
      listenerCount: 0,
      virtualListenerCount: 0,
      hlsPollerCount: 0,
      process: null,
      broadcaster: new StreamBroadcaster(),
      startPromise: null
    };
    this.entries.set(channel.slug, entry);
    this.byId.set(channel.id, channel.slug);
    this.syncVirtualListeners(entry);
    return entry;
  }

  async reload(channelId: string): Promise<ChannelEntry | null> {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: includeChannel()
    });
    const old = this.getById(channelId);
    if (!channel || channel.status === "INACTIVE") {
      if (old) await this.remove(old.channel.slug);
      return null;
    }
    if (old && old.channel.slug !== channel.slug) {
      await this.remove(old.channel.slug);
    }
    const entry = this.add(channel);
    await this.ensureAlwaysOn(entry);
    return entry;
  }

  async remove(slug: string): Promise<void> {
    const entry = this.entries.get(slug);
    if (!entry) return;
    await this.stop(entry, "idle");
    this.entries.delete(slug);
    this.byId.delete(entry.channel.id);
  }

  heartbeat(entry: ChannelEntry, kind: "hls" | "segment" | "stream"): void {
    entry.lastHeartbeat = new Date();
    if (kind === "hls") {
      entry.hlsPollerCount += 1;
      setTimeout(() => {
        entry.hlsPollerCount = Math.max(0, entry.hlsPollerCount - 1);
      }, 30000).unref();
    }
  }

  refreshListenerCount(entry: ChannelEntry): void {
    entry.listenerCount = entry.broadcaster.listenerCount + entry.virtualListenerCount;
  }

  async ensureStarted(entry: ChannelEntry): Promise<void> {
    if (entry.channel.status === "INACTIVE") {
      throw new Error("CHANNEL_INACTIVE");
    }
    if (!entry.channel.source) {
      throw new Error("CHANNEL_NO_SOURCE");
    }
    if (entry.state === "error") {
      throw new Error("CHANNEL_ERROR");
    }
    if (entry.state === "running" && !entry.process) {
      entry.state = "idle";
      entry.broadcaster.detach();
      this.refreshListenerCount(entry);
      await cleanupHlsDir(entry.channel.slug);
    }
    if (entry.state === "running") return;
    if (entry.startPromise) return entry.startPromise;

    const activeCount = this.list().filter((item) => item.state === "running" || item.state === "starting").length;
    if (entry.state === "idle" && activeCount >= configStore.getInt("MAX_ACTIVE_CHANNELS")) {
      throw new Error("MAX_ACTIVE_CHANNELS");
    }

    entry.state = "starting";
    entry.startPromise = this.start(entry).finally(() => {
      entry.startPromise = null;
    });
    return entry.startPromise;
  }

  startTimeoutMs(): number {
    return Math.max(5000, configStore.getInt("HLS_SEGMENT_DURATION") * 1000 + 5000);
  }

  async forceStart(channelId: string): Promise<void> {
    const entry = this.getById(channelId) ?? (await this.reload(channelId));
    if (!entry) throw new Error("CHANNEL_NOT_FOUND");
    await this.ensureStarted(entry);
  }

  async stopById(channelId: string): Promise<void> {
    const entry = this.getById(channelId);
    if (!entry) return;
    await this.stop(entry, "idle");
  }

  resetError(channelId: string): boolean {
    const entry = this.getById(channelId);
    if (!entry || entry.state !== "error") return false;
    entry.state = "idle";
    entry.retryCount = 0;
    void this.ensureAlwaysOn(entry);
    return true;
  }

  runtime(channelId: string): object | null {
    const entry = this.getById(channelId);
    if (!entry) return null;
    const idleTimeout = configStore.getInt("IDLE_TIMEOUT_MS");
    const lastHeartbeatMs = entry.lastHeartbeat.getTime();
    const idleRemaining =
      entry.state === "running" && entry.listenerCount === 0
        ? Math.max(0, Math.ceil((idleTimeout - (Date.now() - lastHeartbeatMs)) / 1000))
        : null;
    return {
      state: entry.state,
      retryCount: entry.retryCount,
      lastHeartbeat: lastHeartbeatMs === 0 ? null : entry.lastHeartbeat.toISOString(),
      listenerCount: entry.listenerCount,
      hlsPollerCount: entry.hlsPollerCount,
      idleSecondsRemaining: idleRemaining
    };
  }

  statusFor(channelId: string, dbStatus: ChannelStatus): ChannelState | "inactive" {
    if (dbStatus === "INACTIVE") return "inactive";
    return this.getById(channelId)?.state ?? "idle";
  }

  async reconcileAlwaysOn(): Promise<void> {
    await Promise.all(this.list().map((entry) => this.ensureAlwaysOn(entry)));
  }

  private async start(entry: ChannelEntry): Promise<void> {
    const source = entry.channel.source;
    if (!source) throw new Error("CHANNEL_NO_SOURCE");
    const hlsDir = await ensureHlsDir(entry.channel.slug);
    const args = buildFfmpegArgs({
      protocol: source.protocol,
      url: source.url,
      hlsDir,
      hlsSegmentDuration: configStore.getInt("HLS_SEGMENT_DURATION"),
      hlsWindowSize: configStore.getInt("HLS_WINDOW_SIZE")
    });

    const proc = new FfmpegProcess(args, (normal) => {
      void this.handleExit(entry, normal);
    });
    entry.process = proc;
    if (proc.stdout) entry.broadcaster.attach(proc.stdout);
    try {
      await proc.start(this.startTimeoutMs());
      if (proc.stdout) entry.broadcaster.attach(proc.stdout);
      entry.state = "running";
      entry.retryCount = 0;
    } catch (error) {
      await proc.stop();
      entry.process = null;
      entry.broadcaster.detach();
      await cleanupHlsDir(entry.channel.slug);
      await this.retryOrError(entry);
      throw error;
    }
  }

  private async stop(entry: ChannelEntry, nextState: ChannelState): Promise<void> {
    const proc = entry.process;
    entry.process = null;
    entry.startPromise = null;
    if (proc) await proc.stop();
    entry.broadcaster.detach();
    this.refreshListenerCount(entry);
    await cleanupHlsDir(entry.channel.slug);
    entry.state = nextState;
    if (nextState === "idle") entry.retryCount = 0;
  }

  private async handleExit(entry: ChannelEntry, normal: boolean): Promise<void> {
    entry.process = null;
    entry.broadcaster.detach();
    this.refreshListenerCount(entry);
    await cleanupHlsDir(entry.channel.slug);
    if (normal || entry.state === "idle") return;
    await this.retryOrError(entry);
  }

  private async retryOrError(entry: ChannelEntry): Promise<void> {
    const maxRetry = configStore.getInt("MAX_RETRY");
    if (entry.retryCount >= maxRetry) {
      entry.state = "error";
      return;
    }
    entry.retryCount += 1;
    entry.state = "starting";
    const delayMs = 2 ** entry.retryCount * 1000;
    setTimeout(() => {
      if (entry.state === "starting") {
        entry.startPromise = this.start(entry)
          .catch(() => undefined)
          .finally(() => {
            entry.startPromise = null;
          });
      }
    }, delayMs).unref();
  }

  private alwaysOnEnabled(): boolean {
    return configStore.getInt("ALWAYS_ON_ACTIVE_CHANNELS") === 1;
  }

  private syncVirtualListeners(entry: ChannelEntry): void {
    entry.virtualListenerCount = entry.channel.status === "ACTIVE" && this.alwaysOnEnabled() ? 1 : 0;
    this.refreshListenerCount(entry);
  }

  private async ensureAlwaysOn(entry: ChannelEntry): Promise<void> {
    this.syncVirtualListeners(entry);
    if (entry.virtualListenerCount === 0 || entry.state === "starting" || entry.state === "error") return;
    if (entry.state === "running" && entry.process) return;
    try {
      await this.ensureStarted(entry);
    } catch {
      // Manual stream requests and admin runtime views expose the concrete state/error.
    }
  }

  async collectIdle(): Promise<void> {
    await this.reconcileAlwaysOn();
    const now = Date.now();
    const idleTimeout = configStore.getInt("IDLE_TIMEOUT_MS");
    for (const entry of this.entries.values()) {
      if (
        entry.state === "running" &&
        entry.listenerCount === 0 &&
        now - entry.lastHeartbeat.getTime() > idleTimeout
      ) {
        await this.stop(entry, "idle");
      }
    }
  }
}

export const channelRegistry = new ChannelRegistry();
