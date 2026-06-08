import type { Protocol } from "@prisma/client";
import { buildTeeOutput } from "./tee.js";

export interface FfmpegArgsInput {
  protocol: Protocol;
  url: string;
  hlsDir: string;
  hlsSegmentDuration: number;
  hlsWindowSize: number;
}

export function buildFfmpegArgs(input: FfmpegArgsInput): string[] {
  return [
    "-re",
    "-i",
    input.url,
    "-map",
    "0:a",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-f",
    "tee",
    "-use_fifo",
    "1",
    buildTeeOutput(input.hlsDir, input.hlsSegmentDuration, input.hlsWindowSize)
  ];
}
