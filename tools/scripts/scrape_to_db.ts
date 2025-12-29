
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';

const prisma = new PrismaClient();

const TARGET_URL = 'https://chesapeakeceramics.com/collections/bisque';
const SKU_SELECTOR = '.sku'; 
const PRICE_SELECTOR = '.hide-price-guest';

async function autoScroll(page: any){
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                // @ts-ignore
                var scrollHeight = document.body.scrollHeight;
                // @ts-ignore
                window.scrollBy(0, distance);
                totalHeight += distance;

                // @ts-ignore
                if(totalHeight >= scrollHeight - window.innerHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

(async () => {
  console.log('Using database:', process.env.DATABASE_URL || 'default sqlite');
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  console.log('Scraping data with "Next" button traversal...');
  
  let totalProducts = 0;
  let pageNum = 1;
  let hasMore = true;

  // Initial navigation is handled inside the loop
  
  while (hasMore && pageNum <= 50) {
    const pageUrl = `${TARGET_URL}?page=${pageNum}`;
    console.log(`Navigating to ${pageUrl}...`);
    
    try {
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
        console.log(`Navigation failed for ${pageUrl}, retrying...`);
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    
    await autoScroll(page);

    console.log(`Processing Page ${pageNum}...`);

    const productsOnPage = await page.evaluate((skuSel, priceSel) => {
        const pResults: {sku: string, price: number, name: string}[] = [];
        // @ts-ignore
        const potentialProducts = document.querySelectorAll('.grid-view-item, .product-card, .product-item, .card, .grid__item, .product, .productitem');
        
        potentialProducts.forEach((card: any) => {
             const skuEl = card.querySelector(skuSel) as any;
             const priceEl = card.querySelector(priceSel) as any;
             const titleEl = card.querySelector('.productitem--title a') as any;

             if (skuEl && priceEl) {
                 const sku = skuEl.innerText.trim();
                 const priceText = priceEl.innerText.trim().replace(/[$,]/g, '');
                 const price = parseFloat(priceText);
                 const name = titleEl ? titleEl.innerText.trim() : '';
                 
                 if (!name) {
                    console.log(`Warning: Name not found for SKU ${sku}`);
                 }

                 if (sku && !isNaN(price)) pResults.push({ sku, price, name });
             }
        });

        if (pResults.length === 0) {
            // @ts-ignore
             const skuElements = document.querySelectorAll(skuSel);
             skuElements.forEach((skuEl: any) => {
                const sku = (skuEl as any).innerText.trim();
                let parent = skuEl.parentElement;
                let priceEl: any = null;
                let titleEl: any = null;
                
                // Traverse up to find a container that might have the title and price
                for (let i = 0; i < 5; i++) {
                    if (!parent) break;
                    priceEl = parent.querySelector(priceSel);
                    titleEl = parent.querySelector('.productitem--title a');
                    if (priceEl && titleEl) break;
                    parent = parent.parentElement;
                }
                
                if (sku && priceEl) {
                    const priceText = (priceEl as any).innerText.trim().replace(/[$,]/g, '');
                    const price = parseFloat(priceText);
                    const name = titleEl ? (titleEl as any).innerText.trim() : '';
                    if (!isNaN(price)) pResults.push({ sku, price, name });
                }
             });
        }
        return pResults;
    }, SKU_SELECTOR, PRICE_SELECTOR);

    if (productsOnPage.length === 0) {
        console.log('No products found on this page. Stopping.');
        hasMore = false;
    } else {
        console.log(`Found ${productsOnPage.length} items on page ${pageNum}. First SKU: ${productsOnPage[0].sku}`);
        for (const p of productsOnPage) {
            await prisma.product.upsert({
                where: { sku: p.sku },
                update: { price: p.price, vendorId: 1, vendorName: 'chesapeake', name: p.name },
                create: { sku: p.sku, price: p.price, vendorId: 1, vendorName: 'chesapeake', name: p.name }
            });
            totalProducts++;
        }
        pageNum++;
    }
  }

  console.log(`\nSuccessfully saved ${totalProducts} products to the database.`);

  console.log('Closing browser...');
  await browser.close();
  await prisma.$disconnect();
  process.exit(0);

})();
