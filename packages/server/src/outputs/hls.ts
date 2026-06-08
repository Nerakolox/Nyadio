import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export function hlsRoot(): string {
  return process.env.HLS_DIR ?? (process.platform === "win32" ? path.join(os.tmpdir(), "nyadio") : "/dev/shm/nyadio");
}

export function channelHlsDir(slug: string): string {
  return path.join(hlsRoot(), slug);
}

export async function ensureHlsDir(slug: string): Promise<string> {
  const dir = channelHlsDir(slug);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanupHlsDir(slug: string): Promise<void> {
  await fs.rm(channelHlsDir(slug), { recursive: true, force: true });
}

export async function readHlsFile(slug: string, fileName: string): Promise<Buffer> {
  if (fileName !== "index.m3u8" && !/^seg_\d+\.aac$/.test(fileName)) {
    throw new Error("INVALID_HLS_FILE");
  }
  return fs.readFile(path.join(channelHlsDir(slug), fileName));
}
