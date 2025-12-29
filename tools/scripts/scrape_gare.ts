import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const CATEGORY_IDS = [5, 6, 8, 9, 10, 11];
const BASE_URL = 'https://store.gareceramics.com';
const LOGIN_URL = `${BASE_URL}/account.cfm`;

interface Product {
  title: string;
  sku: string;
  price: string;
  categoryUrl: string;
}

async function scrape() {
  console.log('Starting Gare Ceramics scraper...');
  // Launch in non-headless mode so user can see and log in
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null, // Allow browser to be resized
  });
  const page = await browser.newPage();

  // Navigate to login page
  console.log('Navigating to login page...');
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle0' });

  // Robust login detection
  console.log('Waiting for login... (Time limit: 5 minutes)');
  console.log('Please log in manually in the browser window.');
  
  try {
      await page.waitForFunction(() => {
          // @ts-ignore
          const body = document.body.innerText.toLowerCase();
          // Stricter check: Only 'sign out' or 'log out' to avoid false positives on 'my account'
          return body.includes('sign out') || body.includes('log out');
      }, { timeout: 300000, polling: 1000 });
  } catch (e) {
      console.error('Login timed out.');
      throw e;
  }

  console.log('Login detected! Starting scrape...');
  await new Promise(r => setTimeout(r, 2000));

  const allProducts: Product[] = [];

  for (const categoryId of CATEGORY_IDS) {
    const categoryUrl = `${BASE_URL}/products_list.cfm?categoryID=${categoryId}`;
    console.log(`Scraping category ${categoryId}: ${categoryUrl}`);
    
    await page.goto(categoryUrl, { waitUntil: 'networkidle0' });

    // Scrape products on the page
    const products = await page.evaluate((catUrl) => {
      const items: any[] = [];
      // @ts-ignore
      const cardBodies = document.querySelectorAll('.card-body.text-center');

      cardBodies.forEach((card: any) => {
        const titleElement = card.querySelector('.card-title a.text-dark');
        const skuElement = card.querySelector('small.text-muted');
        
        if (titleElement && skuElement) {
          const title = (titleElement as any).innerText.trim();
          let skuText = (skuElement as any).innerText.trim(); // e.g., "Item No. 123"
          
          // Extract digits from SKU
          const skuMatch = skuText.match(/\d+/);
          let sku = skuMatch ? skuMatch[0] : '';
          
          if (sku) {
            sku = 'G' + sku; // Prepend 'G'
          }

          // Extract price from the whole card text
          const cardText = (card as any).innerText;
          const priceMatch = cardText.match(/\$\d+\.\d{2}/);
          const price = priceMatch ? priceMatch[0] : 'Price Not Found';

          items.push({
            title,
            sku,
            price,
            categoryUrl: catUrl
          });
        }
      });

      return items;
    }, categoryUrl);

    console.log(`Found ${products.length} products in category ${categoryId}.`);
    allProducts.push(...products);
  }

  await browser.close();

  // Save to JSON for backup/reference
  const outputPath = path.resolve(process.cwd(), 'gare_products.json');
  fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2));
  console.log(`Scraping complete. Data saved to ${outputPath}`);

  // Save to Database
  const prisma = new PrismaClient();
  console.log('Saving to database...');
  
  for (const product of allProducts) {
    const priceFloat = parseFloat(product.price.replace('$', ''));
    if (isNaN(priceFloat)) {
        console.warn(`Skipping product with invalid price: ${product.title} (${product.price})`);
        continue;
    }

    try {
        await prisma.product.upsert({
            where: { sku: product.sku },
            update: {
                cost: priceFloat,
                vendorName: 'gare',
                vendorId: 2,
                name: product.title
            },
            create: {
                sku: product.sku,
                cost: priceFloat,
                vendorName: 'gare',
                vendorId: 2,
                name: product.title
            }
        });
    } catch (e) {
        console.error(`Failed to upsert product ${product.sku}:`, e);
    }
  }
  console.log('Database sync complete.');
  
  // Running export
  console.log('Running data export...');
  const { exec } = await import('child_process');
  await new Promise<void>((resolve, reject) => {
      // Use process.cwd() for path resolution
      const scriptPath = path.resolve(process.cwd(), 'tools/scripts/export-data.ts');
      exec(`npx ts-node "${scriptPath}"`, { cwd: process.cwd() }, (error: any, stdout: any, stderr: any) => {
          if (error) {
              console.error(`Export error: ${error}`);
              // Don't reject, just log
          }
          console.log(`Export output: ${stdout}`);
          resolve();
      });
  });

  await prisma.$disconnect();
}

scrape().catch((err) => {
  console.error('Scraping failed:', err);
  process.exit(1);
});
