import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

async function exportData() {
  const prisma = new PrismaClient();
  console.log('Fetching data for static export...');

  try {
    const rules = await prisma.rule.findMany({ where: { userId: 1 } });
    const pricingMatrix = await prisma.pricingMatrix.findMany({ where: { userId: 1 } });
    const products = await prisma.product.findMany();

    const data = {
      rules,
      pricingMatrix,
      products
    };

    const outputPath = path.resolve(process.cwd(), '../../frontend/public/data.json');
    console.log(`Writing data to ${outputPath}...`);
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log('Export complete!');

  } catch (e) {
    console.error('Error exporting data:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
