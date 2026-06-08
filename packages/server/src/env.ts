import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(moduleDir, "..");
const repoRoot = path.resolve(moduleDir, "../../..");

config({ path: path.join(repoRoot, ".env") });

// Legacy fallback for old local checkouts that still have packages/server/.env.
// Values already loaded from the root .env keep precedence.
config({ path: path.join(serverRoot, ".env") });
