import path from "node:path";

export function buildTeeOutput(hlsDir: string, hlsTime: number, hlsListSize: number): string {
  const playlist = path.join(hlsDir, "index.m3u8").replaceAll("\\", "/");
  const segment = escapeTeeOptionValue(path.join(hlsDir, "seg_%05d.aac").replaceAll("\\", "/"));
  return [
    `[f=hls:hls_time=${hlsTime}:hls_list_size=${hlsListSize}:hls_flags=delete_segments+append_list:hls_segment_filename=${segment}]${playlist}`,
    "[f=adts]pipe:1"
  ].join("|");
}

function escapeTeeOptionValue(value: string): string {
  return value.replaceAll(":", "\\\\:");
}
