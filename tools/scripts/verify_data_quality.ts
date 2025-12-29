
import * as fs from 'fs';
import * as path from 'path';

const dataPath = path.resolve(process.cwd(), 'frontend/public/data.json');

try {
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(rawData);
  const products = data.products || [];

  console.log(`Total Products: ${products.length}`);

  if (products.length === 0) {
    console.log("No products found!");
    process.exit(1);
  }

  // Cost Analysis
  const under20 = products.filter((p: any) => p.cost < 20);
  const percentage = (under20.length / products.length) * 100;

  console.log(`Products under $20: ${under20.length}`);
  console.log(`Percentage under $20: ${percentage.toFixed(2)}%`);

  // Name Analysis
  console.log("\nSample Names (First 10):");
  products.slice(0, 10).forEach((p: any) => console.log(`- ${p.name} ($${p.cost})`));

  console.log("\nSample Names (Random 5):");
  for(let i=0; i<5; i++) {
     const rand = products[Math.floor(Math.random() * products.length)];
     console.log(`- ${rand.name} ($${rand.cost})`);
  }

} catch (error) {
  console.error("Error verifying data:", error);
}
