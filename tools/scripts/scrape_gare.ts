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

  console.log('Please log in manually in the browser window.');
  console.log('Waiting for you to log in...');

  // Wait for a signal that login is complete. 
  // We can look for the "Sign Out" link or check if we are on the account page with a specific element.
  // A safe bet is to wait until the "Sign In" button/text is gone or "Sign Out" appears.
  // Based on typical sites, finding 'a[href*="logout"]' or similar is good.
  // Or we can just wait for a long timeout or loop checking.
  // Let's wait for the URL to potentially settle or a specific "Welcome" element.
  // We will wait for the user to NOT be on the login form, or for a "Sign Out" link.
  
  // Wait indefinitely (timeout: 0) for a selector that likely indicates authentication.
  // Adjust this selector if "Sign Out" is different. 
  // Often it's 'a[href*="logout"]' or text "Sign Out".
  // Note: If the user is ALREADY logged in (unlikely with fresh puppeteer session), this might hang if we only check for transition.
  // But puppeteer starts fresh.
  
  try {
    // Wait for the specific "Sign Out" link or similar indicator. 
    // We'll try to match a common logout pattern or the absence of the login form.
    // Looking at the previous analysis, there was a "Sign In" link.
    // We can wait for that to disappear or for 'a[href*="logout"]' to appear.
    // Let's use a function to check.
    await page.waitForFunction(() => {
        // Check for common logout text or link
        const links = Array.from(document.querySelectorAll('a'));
        return links.some(a => a.innerText.toLowerCase().includes('sign out') || a.innerText.toLowerCase().includes('log out'));
    }, { timeout: 0, polling: 1000 });
    
  } catch (e) {
    console.log("Error waiting for login:", e);
  }

  console.log('Login detected! Starting scrape...');
  
  // Small delay to ensure state is settled
  await new Promise(r => setTimeout(r, 2000));

  const allProducts: Product[] = [];

  for (const categoryId of CATEGORY_IDS) {
    const categoryUrl = `${BASE_URL}/products_list.cfm?categoryID=${categoryId}`;
    console.log(`Scraping category ${categoryId}: ${categoryUrl}`);
    
    await page.goto(categoryUrl, { waitUntil: 'networkidle0' });

    // Scrape products on the page
    const products = await page.evaluate((catUrl) => {
      const items: any[] = [];
      const cardBodies = document.querySelectorAll('.card-body.text-center');

      cardBodies.forEach((card) => {
        const titleElement = card.querySelector('.card-title a.text-dark');
        const skuElement = card.querySelector('small.text-muted');
        
        if (titleElement && skuElement) {
          const title = (titleElement as HTMLElement).innerText.trim();
          let skuText = (skuElement as HTMLElement).innerText.trim(); // e.g., "Item No. 123"
          
          // Extract digits from SKU
          const skuMatch = skuText.match(/\d+/);
          let sku = skuMatch ? skuMatch[0] : '';
          
          if (sku) {
            sku = 'G' + sku; // Prepend 'G'
          }

          // Extract price from the whole card text
          const cardText = (card as HTMLElement).innerText;
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
  const outputPath = path.resolve(__dirname, '../gare_products.json');
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
                price: priceFloat,
                vendorName: 'gare',
                vendorId: 2
            },
            create: {
                sku: product.sku,
                price: priceFloat,
                vendorName: 'gare',
                vendorId: 2
            }
        });
    } catch (e) {
        console.error(`Failed to upsert product ${product.sku}:`, e);
    }
  }
  console.log('Database sync complete.');
  await prisma.$disconnect();
}

scrape().catch((err) => {
  console.error('Scraping failed:', err);
  process.exit(1);
});
