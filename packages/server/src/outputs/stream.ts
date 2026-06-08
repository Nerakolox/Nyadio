import type { FastifyReply } from "fastify";
import type { Readable } from "node:stream";

export class StreamBroadcaster {
  private clients = new Set<FastifyReply>();
  private stdout: Readable | null = null;
  private onData = (chunk: Buffer) => {
    for (const reply of this.clients) {
      reply.raw.write(chunk);
    }
  };

  attach(ffmpegStdout: Readable): void {
    this.detach(false);
    this.stdout = ffmpegStdout;
    this.stdout.on("data", this.onData);
  }

  detach(endClients = true): void {
    if (this.stdout) {
      this.stdout.off("data", this.onData);
      this.stdout = null;
    }
    if (endClients) {
      for (const reply of this.clients) {
        if (!reply.raw.destroyed) reply.raw.end();
      }
      this.clients.clear();
    }
  }

  addClient(reply: FastifyReply): void {
    this.clients.add(reply);
  }

  removeClient(reply: FastifyReply): void {
    this.clients.delete(reply);
  }

  get listenerCount(): number {
    return this.clients.size;
  }
}
