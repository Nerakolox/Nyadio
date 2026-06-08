import { channelRegistry } from "./registry.js";

let scanner: NodeJS.Timeout | null = null;

export function startChannelLifecycleScanner(): void {
  if (scanner) return;
  scanner = setInterval(() => {
    void channelRegistry.collectIdle();
  }, 10000);
  scanner.unref();
}

export function stopChannelLifecycleScanner(): void {
  if (!scanner) return;
  clearInterval(scanner);
  scanner = null;
}
