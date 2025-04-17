const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const formFields = require("./updated_addresses.json");

puppeteer.use(StealthPlugin());

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
    // Ensure directory exists
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

// Helper function to inspect the page and save details
async function inspectPage(page, filename) {
  try {
    // Save a screenshot
    const screenshotPath = `./${filename}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to ${screenshotPath}`);
    
    // Get all forms and their elements
    const formData = await page.evaluate(() => {
      const results = {
        url: window.location.href,
        forms: [],
        inputs: [],
        buttons: []
      };
      
      // Get all forms
      const forms = document.querySelectorAll('form');
      forms.forEach((form, formIndex) => {
        results.forms.push({
          index: formIndex,
          id: form.id || 'no-id',
          action: form.action,
          method: form.method,
          className: form.className
        });
      });
      
      // Get all inputs
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input) => {
        results.inputs.push({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || 'no-name',
          id: input.id || 'no-id',
          placeholder: input.placeholder || 'no-placeholder',
          value: input.value || 'no-value',
          isVisible: input.offsetParent !== null
        });
      });
      
      // Get all buttons
      const buttons = document.querySelectorAll('button, input[type="submit"]');
      buttons.forEach((button) => {
        results.buttons.push({
          type: button.type || button.tagName.toLowerCase(),
          id: button.id || 'no-id',
          className: button.className,
          text: button.innerText || button.value || 'no-text',
          isVisible: button.offsetParent !== null
        });
      });
      
      // Check for iframes
      const iframes = document.querySelectorAll('iframe');
      results.iframeCount = iframes.length;
      
      return results;
    });
    
    // Save the form data to a file
    const formDataPath = `./${filename}-data-${Date.now()}.json`;
    fs.writeFileSync(formDataPath, JSON.stringify(formData, null, 2));
    console.log(`Page inspection data saved to ${formDataPath}`);
    
    // Log a summary to the console
    console.log(`Current URL: ${formData.url}`);
    console.log(`Number of forms found: ${formData.forms.length}`);
    console.log(`Number of inputs found: ${formData.inputs.length}`);
    console.log(`Number of buttons found: ${formData.buttons.length}`);
    console.log(`Number of iframes found: ${formData.iframeCount}`);
    
    // If there are iframes, try to inspect their content too
    if (formData.iframeCount > 0) {
      console.log("Iframes detected - checking iframe content...");
      
      const frames = page.frames();
      console.log(`Found ${frames.length} frames in page.frames()`);
      
      for (let i = 0; i < frames.length; i++) {
        try {
          const frame = frames[i];
          console.log(`Inspecting frame ${i}, url: ${frame.url()}`);
          
          const frameData = await frame.evaluate(() => {
            const results = {
              inputs: [],
              buttons: []
            };
            
            // Get all inputs in the frame
            const inputs = document.querySelectorAll('input, select, textarea');
            inputs.forEach((input) => {
              results.inputs.push({
                type: input.type || input.tagName.toLowerCase(),
                name: input.name || 'no-name',
                id: input.id || 'no-id',
                placeholder: input.placeholder || 'no-placeholder'
              });
            });
            
            // Get all buttons in the frame
            const buttons = document.querySelectorAll('button, input[type="submit"]');
            buttons.forEach((button) => {
              results.buttons.push({
                type: button.type || button.tagName.toLowerCase(),
                id: button.id || 'no-id',
                className: button.className,
                text: button.innerText || button.value || 'no-text'
              });
            });
            
            return results;
          });
          
          console.log(`Frame ${i} contains ${frameData.inputs.length} inputs and ${frameData.buttons.length} buttons`);
          
          // Save the frame data
          const frameDataPath = `./${filename}-frame${i}-${Date.now()}.json`;
          fs.writeFileSync(frameDataPath, JSON.stringify(frameData, null, 2));
        } catch (frameError) {
          console.error(`Error inspecting frame ${i}:`, frameError.message);
        }
      }
    }
    
    return formData;
  } catch (error) {
    console.error("Error during page inspection:", error);
    return null;
  }
}

(async () => {
  let i = loadLastIndex();
  let j = 0;

  while (true) {
    console.log(
      "\n********************** order number *********************** ",
      i,
      "at : ",
      new Date().toLocaleString()
    );
    if (i >= formFields.length) {
      i = 0;
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080"
      ],
    });

    try {
      const page = await browser.newPage();
      
      // Set realistic user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Enable console logging from the browser
      page.on('console', message => console.log('Browser console:', message.text()));
      
      const urls = [
        "https://ummahcollections.in/products/first-rain-mitti-fragrance",
        "https://ummahcollections.in/products/cassidy-king-2-0-perfume-20ml-pack-of-2",
        "https://ummahcollections.in/products/ratrani-3ml-attar-1pc-and-shahi-gulab-3ml-attar-1pc",
        "https://ummahcollections.in/products/jannat-3ml-attar-1pc-and-jannatul-firdaus-3ml-attar-1pc",
        "https://ummahcollections.in/products/rich-aroma-concept-car-dashboard-perfume-rose-red",
        "https://ummahcollections.in/products/smells-like-a-warm-hug-solid-perfumes",
        "https://ummahcollections.in/products/perfume-for-women-pink-lovepack-of-2",
        "https://ummahcollections.in/products/shahi-gulab3ml-attar-1pc-and-aseel-3ml-attar-1pc",
      ];

      const randomUrl = urls[Math.floor(Math.random() * urls.length)] ?? urls[0];
      await page.goto(randomUrl, { waitUntil: "networkidle2", timeout: 60000 });
      console.log(`Navigated to ${randomUrl}`);
      
      // Inspect the product page
      await inspectPage(page, "product-page");
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Try to find and click the product form submit button
      const buttonSelectors = [
        ".product-form__submit",
        "#es-popup-button",
        ".es-popup-button-product",
        "button[type='submit']",
        "button:contains('Add to Cart')",
        ".add_to_cart",
        ".add-to-cart"
      ];
      
      let buttonClicked = false;
      for (const selector of buttonSelectors) {
        try {
          console.log(`Trying to find button with selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          console.log(`Successfully clicked button with selector: ${selector}`);
          buttonClicked = true;
          break;
        } catch (error) {
          console.log(`Button with selector ${selector} not found or couldn't be clicked`);
        }
      }
      
      if (!buttonClicked) {
        // Try using JavaScript clicking instead
        console.log("Trying JavaScript click on buttons...");
        await page.evaluate(() => {
          // Try to find and click any button that looks like an "Add to Cart" button
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const button of buttons) {
            const text = button.innerText.toLowerCase();
            if (text.includes('add to cart') || text.includes('buy now') || text.includes('submit')) {
              console.log("Found button:", text);
              button.click();
              return true;
            }
          }
          return false;
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Inspect the page after button click
      await inspectPage(page, "after-button-click");
      
      // Go to cart page
      await page.goto("https://ummahcollections.in/cart", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
      console.log("Navigated to cart page");
      
      // Inspect the cart page
      await inspectPage(page, "cart-page");
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Click checkout button
      const checkoutButtonSelectors = [
        ".cart__checkout-button",
        "#checkout",
        ".checkout-button",
        "button:contains('Checkout')"
      ];
      
      let checkoutClicked = false;
      for (const selector of checkoutButtonSelectors) {
        try {
          console.log(`Trying to find checkout button with selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          console.log(`Successfully clicked checkout button with selector: ${selector}`);
          checkoutClicked = true;
          break;
        } catch (error) {
          console.log(`Checkout button with selector ${selector} not found`);
        }
      }
      
      if (!checkoutClicked) {
        console.log("Trying JavaScript click on checkout buttons...");
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          for (const button of buttons) {
            const text = (button.innerText || button.textContent || '').toLowerCase();
            if (text.includes('checkout') || text.includes('proceed to')) {
              console.log("Found checkout button:", text);
              button.click();
              return true;
            }
          }
          return false;
        });
      }
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Inspect the checkout page
      const checkoutData = await inspectPage(page, "checkout-page");
      
      // Now try to find the form elements
      const formElements = {};
      
      // Log the availability of form fields
      const formFieldSelectors = [
        'input[name="address"]',
        'input[name="first_name"]',
        'input[name="phone"]',
        'input[name="address2"]',
        'input[name="city"]',
        'input[name="zip"]',
        'select[name="country"]',
        'select[name="province"]'
      ];
      
      for (const selector of formFieldSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          formElements[selector] = true;
          console.log(`Form field ${selector} is available`);
        } catch (error) {
          formElements[selector] = false;
          console.log(`Form field ${selector} is NOT available`);
        }
      }
      
      // Try to check if there are any iframes
      const iframeCount = await page.evaluate(() => document.querySelectorAll('iframe').length);
      console.log(`Number of iframes on page: ${iframeCount}`);
      
      if (iframeCount > 0) {
        console.log("Iframes found - the form might be inside an iframe");
        
        // List all frames
        const frames = page.frames();
        console.log(`Total frames: ${frames.length}`);
        
        for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
          const frame = frames[frameIndex];
          console.log(`Frame ${frameIndex} URL: ${frame.url()}`);
          
          // Check the same form fields in this frame
          for (const selector of formFieldSelectors) {
            try {
              const elementExists = await frame.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el !== null;
              }, selector);
              
              if (elementExists) {
                console.log(`Form field ${selector} found in frame ${frameIndex}`);
              }
            } catch (frameError) {
              console.log(`Error checking for ${selector} in frame ${frameIndex}: ${frameError.message}`);
            }
          }
        }
      }
      
      // Log page HTML for debugging
      const pageHtml = await page.content();
      fs.writeFileSync(`./page-html-${Date.now()}.html`, pageHtml);
      console.log("Page HTML saved for debugging");
      
      // Check for alternate form structure
      await page.evaluate(() => {
        // Find all possible input fields regardless of their name/id
        const inputs = document.querySelectorAll('input');
        console.log(`Total inputs found: ${inputs.length}`);
        
        inputs.forEach((input, index) => {
          console.log(`Input ${index}:`, {
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            isVisible: input.offsetParent !== null
          });
        });
      });
      
      console.log("Finished debugging the checkout process");
      
    } catch (error) {
      console.error("Error during automation:", error);
    } finally {
      i++;
      j++;
      saveLastIndex(i);
      await browser.close();
      console.log("Browser closed. Restarting process...");

      if (j > 2) { // Reduced to 2 for debugging purposes
        console.log("Reached maximum iterations for debugging. Exiting...");
        break;
      }
    }
  }
})();
