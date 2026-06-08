import "./env.js";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import fastify from "fastify";
import { configStore } from "./config/store.js";
import { startChannelLifecycleScanner } from "./channels/lifecycle.js";
import { channelRegistry } from "./channels/registry.js";
import { registerAdminChannelRoutes } from "./routes/admin/channels.js";
import { registerAdminUserRoutes } from "./routes/admin/admins.js";
import { registerAdminSettingRoutes } from "./routes/admin/settings.js";
import { registerAdminSubmissionRoutes } from "./routes/admin/submissions.js";
import { registerAdminTagRoutes } from "./routes/admin/tags.js";
import { registerPublicChannelRoutes } from "./routes/api/channels.js";
import { registerPublicSubmissionRoutes } from "./routes/api/submissions.js";
import { registerPublicTagRoutes } from "./routes/api/tags.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerStreamRoutes } from "./routes/stream.js";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

const app = fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  trustProxy: true
});

await app.register(cors, { origin: true });
await app.register(rateLimit, {
  global: false
});
await app.register(jwt, { secret: jwtSecret });

await configStore.load();
await channelRegistry.loadActive();
configStore.subscribe(() => channelRegistry.reconcileAlwaysOn());
await channelRegistry.reconcileAlwaysOn();
startChannelLifecycleScanner();

await registerHealthRoutes(app);
await registerPublicChannelRoutes(app);
await registerPublicTagRoutes(app);
await registerPublicSubmissionRoutes(app);
await registerAuthRoutes(app);
await registerAdminChannelRoutes(app);
await registerAdminTagRoutes(app);
await registerAdminSubmissionRoutes(app);
await registerAdminUserRoutes(app);
await registerAdminSettingRoutes(app);
await registerStreamRoutes(app);

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";
await app.listen({ port, host });
