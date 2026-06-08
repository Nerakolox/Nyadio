import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { URL } from "node:url";

const IPV4_BLOCKED = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./
];

const IPV6_BLOCKED = [
  /^::1$/i,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^::ffff:127\./i,
  /^::ffff:10\./i,
  /^::ffff:192\.168\./i,
  /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./i
];

function isPrivateAddress(address: string): boolean {
  return IPV4_BLOCKED.some((range) => range.test(address)) || IPV6_BLOCKED.some((range) => range.test(address));
}

export async function validateUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("INVALID_URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("INVALID_URL");
  }

  const host = url.hostname;
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("SSRF_BLOCKED");
    return url;
  }

  const [v4, v6] = await Promise.all([
    dns.resolve4(host).catch(() => [] as string[]),
    dns.resolve6(host).catch(() => [] as string[])
  ]);
  const addresses = [...v4, ...v6];
  if (addresses.length === 0) throw new Error("DNS_RESOLVE_FAILED");
  if (addresses.some(isPrivateAddress)) throw new Error("SSRF_BLOCKED");

  return url;
}
