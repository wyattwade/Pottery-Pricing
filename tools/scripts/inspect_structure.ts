
import puppeteer from 'puppeteer';
import * as fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Login first as price is hidden
  await page.goto('https://chesapeakeceramics.com/account/login', { waitUntil: 'networkidle2' });
  console.log("Please log in...");
  
   try {
    await page.waitForFunction(() => {
        // @ts-ignore
        const links = Array.from(document.querySelectorAll('a'));
        // @ts-ignore
        return links.some(a => a.innerText.toLowerCase().includes('log out') || a.innerText.toLowerCase().includes('sign out'));
    }, { timeout: 0 });
  } catch (e) { console.log(e); }

  // Wait for network idle after navigation
  console.log("Navigated. Waiting for selectors...");
  await new Promise(r => setTimeout(r, 5000)); // Fixed waitForTimeout

  const debugData = await page.evaluate(() => {
     // @ts-ignore
     const cards = document.querySelectorAll('.grid-view-item, .product-card, .product-item, .card, .grid__item, .product');
     if(cards.length > 0) {
         return Array.from(cards).slice(0, 3).map((c: any) => c.outerHTML);
     }
     // If no cards, capture the body HTML to see what IS there
     // @ts-ignore
     return [document.body.innerHTML];
  });
  
  if (debugData.length === 1 && debugData[0].length > 50000) {
      console.log("No cards found! Saving full page HTML for analysis.");
  } else {
      console.log(`Found ${debugData.length} cards.`);
  }
  
  fs.writeFileSync('chesapeake_debug.html', debugData.join('\n\n<!-- SEPARATOR -->\n\n'));
  console.log("Saved HTML to chesapeake_debug.html");
  
  await browser.close();
})();
