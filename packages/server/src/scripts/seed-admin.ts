import { AdminRole, Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { hashPassword } from "../routes/auth.js";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const username = argValue("username");
  const password = argValue("password");
  if (!username || !password) {
    throw new Error("Usage: pnpm --filter server seed:admin --username admin --password <password>");
  }
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    throw new Error("username must be 3-30 chars: letters, numbers, underscore");
  }
  if (password.length < 8) {
    throw new Error("password must be at least 8 chars");
  }

  try {
    await prisma.adminUser.create({
      data: {
        username,
        passwordHash: await hashPassword(password),
        role: AdminRole.SUPERADMIN
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`admin "${username}" already exists`);
    }
    throw error;
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
