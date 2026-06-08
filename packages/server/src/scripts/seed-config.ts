import { prisma } from "../db/client.js";
import { APP_CONFIG_DEFAULTS } from "../config/defaults.js";

async function main(): Promise<void> {
  for (const [key, value] of Object.entries(APP_CONFIG_DEFAULTS)) {
    await prisma.appConfig.upsert({
      where: { key },
      update: {},
      create: { key, value }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
