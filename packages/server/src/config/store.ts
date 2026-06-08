import { prisma } from "../db/client.js";
import { APP_CONFIG_DEFAULTS, type AppConfigKey } from "./defaults.js";

type RefreshListener = () => void | Promise<void>;

class ConfigStore {
  private values = new Map<string, string>();
  private listeners = new Set<RefreshListener>();

  async load(): Promise<void> {
    const rows = await prisma.appConfig.findMany();
    const next = new Map<string, string>(Object.entries(APP_CONFIG_DEFAULTS));
    for (const row of rows) next.set(row.key, row.value);
    this.values = next;
  }

  get(key: AppConfigKey): string {
    return this.values.get(key) ?? APP_CONFIG_DEFAULTS[key];
  }

  getInt(key: AppConfigKey): number {
    const parsed = Number.parseInt(this.get(key), 10);
    if (!Number.isFinite(parsed)) {
      return Number.parseInt(APP_CONFIG_DEFAULTS[key], 10);
    }
    return parsed;
  }

  subscribe(listener: RefreshListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async refresh(): Promise<void> {
    await this.load();
    await Promise.all([...this.listeners].map((listener) => listener()));
  }
}

export const configStore = new ConfigStore();
