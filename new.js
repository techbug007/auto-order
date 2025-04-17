const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const formFields = require("./updated_addresses.json");

puppeteer.use(StealthPlugin());

// Keep your existing helper functions
function generatePhoneNumber() {
  const startingDigit = [9, 8, 7][Math.floor(Math.random() * 3)];
  const remainingDigits = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
  return `${startingDigit}${remainingDigits}`;
}

const lastIndexPath = process.env.LAST_INDEX_PATH || "./state/last_index.json";

const loadLastIndex = () => {
  try {
    if (fs.existsSync(lastIndexPath)) {
      const data = fs.readFileSync(lastIndexPath, "utf8");
      return JSON.parse(data).lastIndex || 0;
    }
  } catch (error) {
    console.error("Error loading last index:", error);
  }
  return 0;
};

const saveLastIndex = (index) => {
  try {
    const dir = path.dirname(lastIndexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      lastIndexPath,
      JSON.stringify({ lastIndex: index }, null, 2)
    );
    console.log("Saved last index:", index);
  } catch (error) {
    console.error("Error saving last index:", error);
  }
};

(async () => {
  let i = loadLastIndex();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920,1080"
    ],
  });

  try {
    const page = await browser.newPage();
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Step 1: Go to product page
    const urls = [
      "https://ummahcollections.in/products/cassidy-king-2-0-perfume-20ml-pack-of-2",
    ];
    
    await page.goto(urls[0], { waitUntil: "networkidle2", timeout: 60000 });
    console.log(`Navigated to ${urls[0]}`);

    // Step 2: Click product form submit button
    const addToCartSelector = ".product-form__submit";
    await page.waitForSelector(addToCartSelector, { timeout: 10000 });
    await page.click(addToCartSelector);
    console.log("Add to cart button clicked");
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Navigate to cart page
    await page.goto("https://ummahcollections.in/cart", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log("Navigated to cart page");
    
    // Step 4: Click checkout button
    const checkoutButtonId = ".cart__checkout-button";
    await page.waitForSelector(checkoutButtonId, { timeout: 10000 });
    await page.click(checkoutButtonId);
    console.log("Checkout button clicked");
    
    // Step 5: Wait for checkout page to load
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log("Waited 15 seconds for checkout page to load");
    
    // Take a screenshot to see what's on the page
    await page.screenshot({ path: "checkout-page.png", fullPage: true });
    console.log("Screenshot saved to checkout-page.png");
    
    // Print all form fields available
    const formFieldsInfo = await page.evaluate(() => {
      // Collect all form elements on the page
      const forms = Array.from(document.querySelectorAll('form'));
      const formData = forms.map(form => ({
        id: form.id || 'no-id',
        action: form.action,
        method: form.method
      }));
      
      // Collect all input, select, textarea elements
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      const inputData = inputs.map(input => ({
        tagName: input.tagName.toLowerCase(),
        type: input.type || '',
        name: input.name || 'no-name',
        id: input.id || 'no-id',
        placeholder: input.placeholder || '',
        isVisible: input.offsetParent !== null
      }));
      
      // Check for iframes that might contain forms
      const iframes = document.querySelectorAll('iframe');
      const iframeCount = iframes.length;
      
      return { forms: formData, inputs: inputData, iframeCount };
    });
    
    console.log(`\n==== FORM FIELDS INFO ====`);
    console.log(`Found ${formFieldsInfo.forms.length} forms on the page`);
    console.log(`Found ${formFieldsInfo.inputs.length} input elements`);
    console.log(`Found ${formFieldsInfo.iframeCount} iframes`);
    
    console.log("\nFORM DETAILS:");
    formFieldsInfo.forms.forEach((form, index) => {
      console.log(`Form ${index + 1}:`);
      console.log(`  ID: ${form.id}`);
      console.log(`  Action: ${form.action}`);
      console.log(`  Method: ${form.method}`);
    });
    
    console.log("\nINPUT FIELDS:");
    formFieldsInfo.inputs.forEach((input, index) => {
      console.log(`Input ${index + 1}: ${input.tagName} - name="${input.name}" id="${input.id}" type="${input.type}" ${input.isVisible ? 'VISIBLE' : 'HIDDEN'}`);
    });
    
    // Check for specific input fields we're trying to find
    const expectedFields = [
      'input[name="address"]',
      'input[name="first_name"]',
      'input[name="phone"]',
      'input[name="address2"]',
      'input[name="city"]',
      'input[name="zip"]',
      'select[name="country"]',
      'select[name="province"]'
    ];
    
    console.log("\nEXPECTED FIELD AVAILABILITY:");
    for (const fieldSelector of expectedFields) {
      const exists = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null;
      }, fieldSelector);
      
      console.log(`${fieldSelector}: ${exists ? 'FOUND' : 'NOT FOUND'}`);
    }
    
    // Check if we're in an iframe or if there's a different structure
    if (formFieldsInfo.iframeCount > 0) {
      console.log("\nIFRAMES DETECTED - Checking frames for form elements...");
      
      const frames = page.frames();
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        console.log(`\nFrame ${i + 1} URL: ${frame.url()}`);
        
        // Check if the frame contains our expected fields
        for (const fieldSelector of expectedFields) {
          try {
            const exists = await frame.evaluate((selector) => {
              return document.querySelector(selector) !== null;
            }, fieldSelector);
            
            if (exists) {
              console.log(`  ${fieldSelector}: FOUND IN FRAME ${i + 1}`);
            }
          } catch (frameError) {
            // Some frames might not be accessible due to cross-origin restrictions
            console.log(`  Error checking ${fieldSelector} in frame ${i + 1}`);
          }
        }
      }
    }
    
    // Save the current URL
    const currentUrl = page.url();
    console.log(`\nCurrent page URL: ${currentUrl}`);
    
  } catch (error) {
    console.error("Error during automation:", error);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
})();
