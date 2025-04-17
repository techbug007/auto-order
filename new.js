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
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();

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

      // (Rest of your automation logic...)

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 10 seconds

      // Click on the popup button
      //   const popupButtonId = "#es-popup-button";
      //   await page.waitForSelector(popupButtonId, { timeout: 10000 });
      //   await page
      //     .click(popupButtonId)
      //     .catch(() => console.log("Popup button not found"));

      const popupButtonSelector = ".product-form__submit";
      await page.waitForSelector(popupButtonSelector, { timeout: 10000 });
      await page.click(popupButtonSelector);
      console.log("Popup button clicked.");

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      // Refresh the page
      await page.reload({ waitUntil: "networkidle2" });
      console.log("Page refreshed.");

      await page.goto("https://ummahcollections.in/cart", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      console.log("Navigated to cart page");

      // // Click on the checkout button
      const checkoutButtonId = ".cart__checkout-button"; //".cart__checkout-button";

      await page.waitForSelector(checkoutButtonId, { timeout: 10000 });

      await page.click(checkoutButtonId);
      console.log("checkoutButtonId button clicked.");
      await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds
      console.log("waited 5 seconds");

      const data = formFields[i];

      await page.waitForSelector('input[name="email"]', {
        visible: true,
        timeout: 30000,
      });

      let contact = generatePhoneNumber();

      await page.type('input[name="email"]', contact, {
        delay: Math.random() * 200 + 50,
      });
      await page.type('input[name="firstName"]', data.firstName, {
        delay: Math.random() * 200 + 50,
      });
      await page.type('input[name="lastName"]', data.lastName, {
        delay: Math.random() * 200 + 50,
      });
      await page.type('input[name="address1"]', data.address1, {
        delay: Math.random() * 200 + 50,
      });
      await page.type('input[name="address2"]', data.address2, {
        delay: Math.random() * 200 + 50,
      });
      await page.type('input[name="city"]', data.city, {
        delay: Math.random() * 200 + 50,
      });

      await page.type('input[name="postalCode"]', data.postalCode.toString(), {
        delay: Math.random() * 200 + 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

      // await page.select('select[name="country"]', "IN");

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

      await page.evaluate((state) => {
        const selectElement = document.querySelector('select[name="zone"]');
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
        }
      }, data.city);

      console.log("Form filled with data:", data);
      console.log("contact info:", contact);

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 10 seconds

      // Click on the pay button
      const payButtonId = "#checkout-pay-button";
      await page
        .click(payButtonId)
        .catch(() => console.log("Pay button not found"));

      await new Promise((resolve) => setTimeout(resolve, 20000)); // Wait 30 seconds

      const currentUrl = page.url(); // Get the current URL
      if (currentUrl.includes("https://shopify.com/")) {
        console.log("<<<<<<<<<<<<<< success >>>>>>>>>>>>>>");
      } else {
        console.log("URL does not contain 'https://shopify.com/'. Breaking...");
        break;
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
        break;
      }
    }
  }
})();
