import { execa } from "execa";
import type { Readable } from "node:stream";

export class FfmpegProcess {
  private child: ReturnType<typeof execa> | null = null;
  private stopping = false;
  private stderrTail: string[] = [];

  constructor(
    private readonly args: string[],
    private readonly onExit: (normal: boolean) => void
  ) {}

  get stdout(): Readable | null {
    return (this.child?.stdout as Readable | null | undefined) ?? null;
  }

  async start(timeoutMs = 5000): Promise<void> {
    this.stopping = false;
    this.stderrTail = [];
    const command = process.env.FFMPEG_PATH ?? "ffmpeg";
    const child = execa(command, this.args, {
      stdout: "pipe",
      stderr: "pipe",
      reject: false
    });
    this.child = child;
    child.stderr?.on("data", (chunk: Buffer) => {
      this.stderrTail.push(chunk.toString("utf8"));
      this.stderrTail = this.stderrTail.slice(-12);
    });

    child.then((result) => {
      const normal = this.stopping || result.exitCode === 0;
      this.child = null;
      this.onExit(normal);
    }).catch(() => {
      this.child = null;
      this.onExit(this.stopping);
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(this.errorMessage("FFMPEG_START_TIMEOUT")));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        child.off("exit", onExit);
        child.off("error", onError);
      };
      const onData = () => {
        cleanup();
        resolve();
      };
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        reject(new Error(this.errorMessage(`FFMPEG_EXITED_BEFORE_OUTPUT code=${code ?? "null"} signal=${signal ?? "null"}`)));
      };
      const onError = (error: Error & { code?: string }) => {
        cleanup();
        const code = error.code === "ENOENT" ? "FFMPEG_NOT_FOUND" : "FFMPEG_START_FAILED";
        reject(new Error(`${code}: ${error.message}`));
      };
      child.stdout?.once("data", onData);
      child.once("exit", onExit);
      child.once("error", onError);
    });
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    child.kill("SIGTERM");
    await Promise.race([
      child.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 5500))
    ]);
    if (this.child) {
      this.child.kill("SIGKILL");
    }
  }

  private errorMessage(prefix: string): string {
    const stderr = this.stderrTail.join("").trim().split(/\r?\n/).slice(-8).join("\n");
    return stderr ? `${prefix}\n${stderr}` : prefix;
  }
}
