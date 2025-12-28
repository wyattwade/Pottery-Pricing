
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.product.count();
  console.log('Product Count:', count);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
