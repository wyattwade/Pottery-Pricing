
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import * as path from 'path';

const prisma = new PrismaClient();

// Configuration
const BASE_URL = 'https://chesapeakeceramics.com';
const COLLECTION_URL = `${BASE_URL}/collections/bisque`;
const MAX_PAGES = 50; // Safety limit

// Selectors provided by user
const SELECTORS = {
    card: '.grid-view-item', // Based on typical Shopify themes, also checking variations below
    sku: '.sku',
    price: '.hide-price-guest',
    name: 'a[data-product-page-link]'
};

async function run() {
    console.log('--- Starting Fresh Chesapeake Scraper ---');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'] 
    });
    
    const page = await browser.newPage();
    
    // 1. Login Phase
    console.log('\n[1/3] Login Phase');
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/account/login`, { waitUntil: 'networkidle2' });
    
    // Robust detection of login using window variables found in debug HTML
    console.log('Waiting for login... (Time limit: 5 minutes)');
    let loggedIn = false;
    
    for (let i = 0; i < 300; i++) { // 300 seconds
        let check = false;
        try {
            check = await page.evaluate(() => {
                // Safely check for window variables
                // @ts-ignore
                const cff = (typeof window.cffCustomer !== 'undefined') ? window.cffCustomer : null;
                // @ts-ignore
                const isLogged = (typeof window.customerIsLogged !== 'undefined') ? window.customerIsLogged : false;
                 // @ts-ignore
                const body = document.body.innerText.toLowerCase();
                
                return (cff && cff.hasAccount === 'true') || 
                       (isLogged === true) || 
                       (body.includes('log out') || body.includes('sign out') || body.includes('my account'));
            });
        } catch (e) {
            // Context destroyed means navigation happened, which is good (likely login redirect)
            console.log(`[${i}s] Navigation detected (context destroyed)... continuing.`);
            check = false; 
        }

        if (check) {
            loggedIn = true;
            break;
        }
        
        if (i % 2 === 0) { // Log every 2 seconds
             const currentUrl = page.url();
             console.log(`[${i}s] Waiting for login... Current URL: ${currentUrl}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!loggedIn) {
        console.error('Login validation timed out. Taking screenshot debug_login_fail.webp');
        await page.screenshot({ path: 'debug_login_fail.webp' });
        throw new Error('Login timed out.');
    }
    
    console.log('Login detected! Starting scrape in 3 seconds...');
    await new Promise(r => setTimeout(r, 3000)); // Brief pause

    // 2. Scraping Phase
    console.log('\n[2/3] Scraping Phase');
    let pageNum = 1;
    let hasNextPage = true;
    let totalScraped = 0;

    while (hasNextPage && pageNum <= MAX_PAGES) {
        const url = `${COLLECTION_URL}?page=${pageNum}`;
        console.log(`Scraping Page ${pageNum}: ${url}`);
        
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        } catch (e) {
            console.warn(`Timeout loading page ${pageNum}, trying to proceed with captured content...`);
        }

        // Scroll to bottom to trigger any lazy loading
        await autoScroll(page);

        const currentUrl = page.url();
        console.log(`Current URL before scraping: ${currentUrl}`);

        // Extract Data
        const items = await page.evaluate(() => {
            // @ts-ignore
            const cards = document.querySelectorAll('.productgrid--item');
            const data: any[] = [];

            cards.forEach((card: any) => {
                // Name (inside .productitem--title)
                const nameEl = card.querySelector('.productitem--title a');
                const name = nameEl ? (nameEl as any).innerText.trim() : '';

                // SKU (inside .sku)
                const skuEl = card.querySelector('.sku');
                const sku = skuEl ? (skuEl as any).innerText.trim().replace('SKU:', '').trim() : '';

                // Price Logic: Prioritize "Each Price" inside .casepack, else fallback to main price
                const casePriceEl = card.querySelector('.casepack .hide-price-guest');
                const mainPriceEl = card.querySelector('.price--main .hide-price-guest');
                
                let priceText = '';
                if (casePriceEl) {
                    priceText = (casePriceEl as any).innerText;
                } else if (mainPriceEl) {
                    priceText = (mainPriceEl as any).innerText;
                }
                
                // Clean price text
                priceText = priceText.replace(/[^\d.]/g, '');

                // Validation
                if (sku && priceText) {
                    const cost = parseFloat(priceText);
                    if (!isNaN(cost)) {
                        data.push({ sku, name, cost });
                    }
                }
            });
            return data;
        });

        console.log(`Found ${items.length} valid items on page ${pageNum}.`);
        
        if (items.length === 0) {
            console.log('No items found. Assuming end of pagination.');
            
            if (pageNum === 1) {
                console.log('DEBUG: Capturing screenshot debug_state.webp');
                await page.screenshot({ path: 'debug_state.webp' });
                console.log('DEBUG: Dumping content to debug_page_content.html');
                const html = await page.content();
                const fs = await import('fs'); // Dynamic import for ESM
                fs.writeFileSync('debug_page_content.html', html);
            }
            
            hasNextPage = false;
        } else {
             // Upsert to DB
             for (const item of items) {
                 await prisma.product.upsert({
                     where: { sku: item.sku },
                     update: { 
                         name: item.name,
                         cost: item.cost,
                         vendorId: 1, 
                         vendorName: 'chesapeake'
                     },
                     create: {
                         sku: item.sku,
                         name: item.name,
                         cost: item.cost,
                         vendorId: 1,
                         vendorName: 'chesapeake'
                     }
                 });
             }
             totalScraped += items.length;
             pageNum++;
        }
    }

    console.log(`\nScraping complete! Total items processed: ${totalScraped}`);

    // 3. Export Phase
    console.log('\n[3/3] Export Phase');
    console.log('Triggering data export...');
    
    await new Promise<void>((resolve, reject) => {
        // Use process.cwd() to resolve path safely
        const scriptPath = path.resolve(process.cwd(), 'tools/scripts/export-data.ts');
        exec(`npx ts-node "${scriptPath}"`, { cwd: process.cwd() }, (err, stdout, stderr) => {
            if (err) {
                console.error('Export failed:', err);
                // Don't reject, we want to finish the process properly
            } else {
                console.log(stdout); 
            }
            resolve();
        });
    });

    await browser.close();
    await prisma.$disconnect();
    console.log('\n--- Done ---');
}

// Helper: Auto-scroll to trigger lazy loads
async function autoScroll(page: any) {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                // @ts-ignore
                const scrollHeight = document.body.scrollHeight;
                // @ts-ignore
                window.scrollBy(0, distance);
                totalHeight += distance;

                // @ts-ignore
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 50); // Fast scroll
        });
    });
}

run().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
