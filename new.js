const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const formFields = require("./updated_addresses.json");
const { log } = require("console");

puppeteer.use(StealthPlugin());

function generatePhoneNumber() {
  // Randomly pick a starting digit: 9, 8, or 7
  const startingDigit = [9, 8, 7][Math.floor(Math.random() * 3)];

  // Generate the remaining 9 digits randomly
  const remainingDigits = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");

  // Combine starting digit with the remaining digits
  const phoneNumber = `${startingDigit}${remainingDigits}`;
  return phoneNumber;
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
  return 0; // Default to 0 if the file doesn't exist
};

// Function to save the current value of `i`
const saveLastIndex = (index) => {
  try {
    // Make sure the directory exists
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

// Helper function to wait for selector with multiple retries
async function waitForSelectorWithRetry(page, selector, options = {}) {
  const { maxRetries = 3, retryInterval = 2000, ...waitOptions } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout: 10000, ...waitOptions });
      console.log(`Selector '${selector}' found on attempt ${attempt}`);
      return true;
    } catch (error) {
      console.log(`Attempt ${attempt}/${maxRetries} - Selector '${selector}' not found: ${error.message}`);
      
      if (attempt < maxRetries) {
        // Take a screenshot to debug
        try {
          const screenshotPath = `./error-screenshot-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`Screenshot saved to ${screenshotPath}`);
        } catch (screenshotError) {
          console.error("Failed to take screenshot:", screenshotError);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      } else {
        return false;
      }
    }
  }
  return false;
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
      i = 0; // Reset if we reach the end of the formFields array
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Add this for CI environments
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080"
      ],
    });

    try {
      const page = await browser.newPage();
      
      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set viewport size to a common desktop resolution
      await page.setViewport({ width: 1920, height: 1080 });

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

      const randomUrl =
        urls[Math.floor(Math.random() * urls.length)] ?? urls[0];

      await page.goto(randomUrl, { waitUntil: "networkidle2", timeout: 60000 });
      console.log(`Navigated to ${randomUrl}`);

      // Save a screenshot to check what's on the page
      try {
        const screenshotPath = `./page-screenshot-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Initial page screenshot saved to ${screenshotPath}`);
      } catch (screenshotError) {
        console.error("Failed to take screenshot:", screenshotError);
      }

      await new Promise((resolve) => setTimeout(resolve, 8000)); // Wait 8 seconds

      // Try both selectors with the retry mechanism
      let popupButtonFound = false;
      
      // First try the .es-popup-button-product selector
      popupButtonFound = await waitForSelectorWithRetry(page, ".es-popup-button-product");
      
      // If the first selector wasn't found, try the #es-popup-button selector
      if (!popupButtonFound) {
        popupButtonFound = await waitForSelectorWithRetry(page, "#es-popup-button");
      }
      
      // If neither selector worked, try to find any button that looks similar
      if (!popupButtonFound) {
        console.log("Trying to find alternative popup buttons...");
        
        // Get all buttons on the page
        const buttons = await page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          return allButtons.map(button => ({
            text: button.innerText,
            id: button.id,
            class: button.className,
            visible: button.offsetParent !== null
          }));
        });
        
        console.log("Available buttons:", JSON.stringify(buttons, null, 2));
        
        // Try clicking on buttons that might be related to proceeding with the order
        for (const buttonSelector of [
          ".add-to-cart",
          "button[name='add']",
          ".shopify-payment-button__button",
          "button:contains('Add to Cart')",
          "button:contains('Buy')"
        ]) {
          try {
            console.log(`Trying alternative button selector: ${buttonSelector}`);
            await page.waitForSelector(buttonSelector, { timeout: 5000 });
            await page.click(buttonSelector);
            console.log(`Clicked alternative button: ${buttonSelector}`);
            popupButtonFound = true;
            break;
          } catch (err) {
            console.log(`Alternative button ${buttonSelector} not found`);
          }
        }
      }
      
      if (popupButtonFound) {
        console.log("Popup button found and clicked.");
      } else {
        console.log("Failed to find and click the popup button. Continuing with the form filling anyway.");
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      // Try to find the form fields
      const formFound = await waitForSelectorWithRetry(page, 'input[name="first_name"]', {
        visible: true,
        timeout: 15000
      });
      
      if (!formFound) {
        throw new Error("Form fields not found after popup interaction");
      }

      console.log("Form fields found, proceeding with form filling");
      
      const data = formFields[i];
      let contact = generatePhoneNumber();

      // Fill the form with proper delays between actions
      await page.type('input[name="phone"]', contact, {
        delay: Math.random() * 100 + 50,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      await page.type(
        'input[name="first_name"]',
        data.firstName + " " + data.lastName,
        {
          delay: Math.random() * 100 + 50,
        }
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      await page.type('input[name="address"]', data.address1, {
        delay: Math.random() * 100 + 50,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      await page.type('input[name="address2"]', data.address2, {
        delay: Math.random() * 100 + 50,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      await page.type('input[name="city"]', data.city, {
        delay: Math.random() * 100 + 50,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));

      await page.type('input[name="zip"]', data.postalCode.toString(), {
        delay: Math.random() * 100 + 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

      await page.select('select[name="country"]', "IN");

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

      // State selection with error handling
      try {
        await page.evaluate((state) => {
          const selectElement = document.querySelector('select[name="province"]');
          if (!selectElement) {
            console.error("State/province dropdown not found");
            return;
          }
          
          const options = Array.from(selectElement.options);
          
          // Find the option with the matching text
          const matchingOption = options.find(
            (option) => option.text.trim() === state
          );
          
          if (matchingOption) {
            matchingOption.selected = true; // Set it as selected
            selectElement.dispatchEvent(new Event("change", { bubbles: true })); // Trigger change event
          } else {
            console.error(`State "${state}" not found in dropdown.`);
            // If exact match not found, try to select something close
            for (const option of options) {
              if (option.text.includes(state) || state.includes(option.text)) {
                option.selected = true;
                selectElement.dispatchEvent(new Event("change", { bubbles: true }));
                console.log(`Selected similar state: ${option.text}`);
                break;
              }
            }
          }
        }, data.city);
      } catch (stateError) {
        console.error("Error selecting state:", stateError);
      }

      console.log("Form filled with data:", data);
      console.log("contact info:", contact);

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      // Take a screenshot of the filled form
      try {
        const screenshotPath = `./filled-form-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Filled form screenshot saved to ${screenshotPath}`);
      } catch (screenshotError) {
        console.error("Failed to take screenshot:", screenshotError);
      }

      // Click on the pay button with retry mechanism
      const payButtonFound = await waitForSelectorWithRetry(page, "#es-form-button");
      
      if (payButtonFound) {
        await page.click("#es-form-button");
        console.log("Pay button clicked.");
      } else {
        console.log("Pay button not found, trying alternative buttons...");
        
        // Try alternative button selectors
        for (const buttonSelector of [
          "button[type='submit']",
          ".checkout-button",
          "button:contains('Pay')",
          "button:contains('Continue')",
          "button:contains('Submit')"
        ]) {
          try {
            console.log(`Trying alternative pay button: ${buttonSelector}`);
            await page.waitForSelector(buttonSelector, { timeout: 5000 });
            await page.click(buttonSelector);
            console.log(`Clicked alternative pay button: ${buttonSelector}`);
            break;
          } catch (err) {
            console.log(`Alternative pay button ${buttonSelector} not found`);
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 20000)); // Wait 20 seconds

      // Final screenshot to see where we ended up
      try {
        const screenshotPath = `./final-page-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Final page screenshot saved to ${screenshotPath}`);
      } catch (screenshotError) {
        console.error("Failed to take screenshot:", screenshotError);
      }

      const currentUrl = page.url(); // Get the current URL
      console.log("Final URL:", currentUrl);
      
      if (currentUrl.includes("https://shopify.com/")) {
        console.log("<<<<<<<<<<<<<< success >>>>>>>>>>>>>>");
      } else {
        console.log("URL does not contain 'https://shopify.com/'. Continuing to next iteration...");
      }
    } catch (error) {
      console.error("Error during automation:", error);
    } finally {
      i++;
      j++;
      saveLastIndex(i); // Save the current value of `i`
      await browser.close();
      console.log("Browser closed. Restarting process...");

      if (j > 40) {
        console.log("Reached maximum iterations (40). Exiting...");
        break;
      }
    }
  }
})();
