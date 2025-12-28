
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
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

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

  // Initial navigation
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await autoScroll(page);

  while (hasMore && pageNum <= 10) {
    console.log(`Processing Page ${pageNum}...`);

    const productsOnPage = await page.evaluate((skuSel, priceSel) => {
        const pResults: {sku: string, price: number}[] = [];
        const potentialProducts = document.querySelectorAll('.grid-view-item, .product-card, .product-item, .card, .grid__item, .product');
        
        potentialProducts.forEach(card => {
             const skuEl = card.querySelector(skuSel) as HTMLElement;
             const priceEl = card.querySelector(priceSel) as HTMLElement;
             if (skuEl && priceEl) {
                 const sku = skuEl.innerText.trim();
                 const priceText = priceEl.innerText.trim().replace(/[$,]/g, '');
                 const price = parseFloat(priceText);
                 if (sku && !isNaN(price)) pResults.push({ sku, price });
             }
        });

        if (pResults.length === 0) {
             const skuElements = document.querySelectorAll(skuSel);
             skuElements.forEach(skuEl => {
                const sku = (skuEl as HTMLElement).innerText.trim();
                let parent = skuEl.parentElement;
                let priceEl: Element | null = null;
                for (let i = 0; i < 5; i++) {
                    if (!parent) break;
                    priceEl = parent.querySelector(priceSel);
                    if (priceEl) break;
                    parent = parent.parentElement;
                }
                if (sku && priceEl) {
                    const priceText = (priceEl as HTMLElement).innerText.trim().replace(/[$,]/g, '');
                    const price = parseFloat(priceText);
                    if (!isNaN(price)) pResults.push({ sku, price });
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
                update: { price: p.price, vendorId: 1, vendorName: 'chesapeake' },
                create: { sku: p.sku, price: p.price, vendorId: 1, vendorName: 'chesapeake' }
            });
            totalProducts++;
        }
    }

    // Try to find Next button
    const nextButtonSelector = '.pagination .next a, .pagination .next, a[aria-label="Next"], .pagination__next';
    const nextButton = await page.$(nextButtonSelector);

    if (nextButton && hasMore) {
        console.log('Clicking Next...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => console.log('Navigation timeout, continuing...')),
            nextButton.click(),
        ]);
        await autoScroll(page);
        pageNum++;
    } else {
        console.log('No Next button found or stopped. Finished.');
        hasMore = false;
    }
  }

  console.log(`\nSuccessfully saved ${totalProducts} products to the database.`);

  console.log('Closing browser...');
  await browser.close();
  await prisma.$disconnect();
  process.exit(0);

})();
