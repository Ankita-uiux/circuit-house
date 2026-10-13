/**
 * Circuit House catalog — real products sold in India, with reference prices
 * in rupees (INR) checked in October 2026.
 *
 * Prices are listed or launch prices from the linked source on the date shown.
 * They change often (sales, card offers), so the storefront labels them as
 * reference prices and the assistant never claims they are live.
 *
 * `image` is null for every product: freely licensed photos could not be
 * verified when this list was made, so the storefront shows a brand tile.
 * To add a photo, set `image` to a URL you have the right to use.
 */

type PriceSource = { label: string; url: string; asOf: string };

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  category: "Phones" | "Laptops" | "Tablets" | "Audio" | "Wearables" | "Accessories";
  price: number;
  description: string;
  specs: string[];
  image: string | null;
  tags: string[];
  badge: string | null;
  priceSource: PriceSource;
};

const SRC = {
  phonesUnder30k: { label: "91mobiles, phones under ₹30,000", url: "https://www.91mobiles.com/top-10-mobiles-below-30000-in-india", asOf: "12 Oct 2026" },
  phonesUnder50k: { label: "91mobiles, phones under ₹50,000", url: "https://www.91mobiles.com/top-10-mobiles-below-50000-in-india", asOf: "12 Oct 2026" },
  phonesUnder20k: { label: "91mobiles, phones under ₹20,000", url: "https://www.91mobiles.com/top-10-mobiles-below-20000-in-india", asOf: "13 Oct 2026" },
  phonesUnder40k: { label: "91mobiles, phones under ₹40,000", url: "https://www.91mobiles.com/list-of-phones/top-10-mobiles-below-40000-in-india", asOf: "13 Oct 2026" },
  iphoneHike: { label: "MySmartPrice, iPhone prices after Sept 2026 revision", url: "https://www.mysmartprice.com/personal-tech/mobiles/mobiles-news/apple-hikes-iphone-prices-in-india-after-iphone-18-pro-launch/", asOf: "Sept 2026" },
  iphone17: { label: "Beebom, iPhone 17 India price revision", url: "https://gadgets.beebom.com/news/apple-iphone-17-price-in-india-hiked-after-iphone-18-pro-launch", asOf: "10 Sept 2026" },
  iphone18Pro: { label: "Telangana Today, iPhone 18 Pro India launch", url: "https://telanganatoday.com/apple-to-launch-iphone-18-pro-series-in-india-on-sep-18", asOf: "Sept 2026" },
  macbookNeo: { label: "FoneArena, MacBook Neo India launch", url: "https://www.fonearena.com/blog/476834/apple-macbook-neo-price-india-specifications.html", asOf: "Mar 2026" },
  macbookAir: { label: "ETV Bharat, MacBook Air (M5) India launch", url: "https://www.etvbharat.com/en/technology/apple-macbook-air-2026-launched-in-india-price-specifications-enn26030401257", asOf: "Mar 2026" },
  macbookPro: { label: "Digit, MacBook Pro (M5) India price", url: "https://www.digit.in/news/laptops/macbook-pro-with-m5-chip-goes-on-sale-how-to-order-india-price-and-other-details.html", asOf: "Oct 2025 launch price" },
  lenovoLoq: { label: "Digit, Lenovo LOQ RTX 50 series India launch", url: "https://www.digit.in/news/laptops/lenovo-india-launches-loq-gaming-laptops-with-next-gen-nvidia-rtx-50-series-graphics-starting-at-109990.html", asOf: "Aug 2025 launch price" },
  laptops80to100k: { label: "Smartprix, laptops ₹80,000–₹1,00,000", url: "https://www.smartprix.com/laptops/price-80000_to_100000", asOf: "12 Oct 2026" },
  laptops50to60k: { label: "Smartprix, laptops ₹50,000–₹60,000", url: "https://www.smartprix.com/laptops/price-50000_to_60000", asOf: "Oct 2026" },
  ipadAir: { label: "91mobiles, iPad Air (M4) price", url: "https://www.91mobiles.com/hub/ipad-air-m4-rs-69999-amazon-great-indian-festival-sale-2026/", asOf: "24 Sept 2026 list price" },
  ipad: { label: "price-history.in, iPad (A16) on Amazon", url: "https://price-history.in/product/apple-ipad-11-a16-chip-27-Wm3AVomb", asOf: "8 Oct 2026" },
  tablets: { label: "91mobiles, tablets for students", url: "https://www.91mobiles.com/list-of-tablets/tablets-for-students", asOf: "Oct 2026" },
  sonyXm6: { label: "MySmartPrice, Sony WH-1000XM6 India launch", url: "https://www.mysmartprice.com/gear/audio/audio-news/sony-expands-1000x-line-with-wh-1000xm6-priced-at-%E2%82%B939990-in-india/", asOf: "India launch price" },
  airpodsPro3: { label: "IBTimes India, AirPods Pro 3 price revision", url: "https://www.ibtimes.co.in/airpods-pro-3-price-hiked-rs-27900-airpods-max-2-also-get-price-hike-after-airpods-5-launch-905701", asOf: "Sept 2026" },
  jblFlip7: { label: "Smartprix, JBL Flip 7", url: "https://www.smartprix.com/mobile_speakers/jbl-flip-7-35w-bluetooth-speaker-ppd172loo9ja", asOf: "10 Oct 2026" },
  tws5k: { label: "Free Press Journal, best TWS under ₹5,000", url: "https://www.freepressjournal.in/tech/5-best-tws-earbuds-under-5000-in-india-2026", asOf: "Mar 2026" },
  audioUnder5k: { label: "Smartprix, audio under ₹5,000", url: "https://www.smartprix.com/mobile_headphones/price-below_5000", asOf: "11 Oct 2026" },
  watchSe3: { label: "Smartprix, Apple Watch SE 3", url: "https://www.smartprix.com/smartwatches/apple-watch-se-3-ppd18f6ckpvn", asOf: "8 Oct 2026" },
  noiseWatches: { label: "Smartprix, Noise smartwatches under ₹10,000", url: "https://www.smartprix.com/smartwatches/noise-brand/price-below_10000", asOf: "11 Oct 2026" },
  mxMaster: { label: "PriceHistory, MX Master 3S on Amazon", url: "https://pricehistory.app/p/logitech-mx-master-3s-performance-wireless-mouse-1fRkwNIm", asOf: "11 Oct 2026" },
  apple20w: { label: "Apple India online store", url: "https://www.apple.com/in/shop/product/MUVR3HN/A/20w-usb-c-power-adapter", asOf: "12 Oct 2026" },
} satisfies Record<string, PriceSource>;

export const catalog: CatalogProduct[] = [
  // ---------------- Phones ----------------
  {
    id: "iphone-18-pro", name: "iPhone 18 Pro", brand: "Apple", category: "Phones", price: 164900,
    description: "Apple's newest Pro iPhone, launched in September 2026. The premium choice if budget isn't the limit.",
    specs: ["256GB base storage", "Launched Sept 2026"],
    image: null, tags: ["phone", "iphone", "premium", "camera", "apple"], badge: "New", priceSource: SRC.iphone18Pro,
  },
  {
    id: "iphone-17", name: "iPhone 17", brand: "Apple", category: "Phones", price: 99900,
    description: "The standard iPhone 17. Price revised upward in September 2026.",
    specs: ["256GB storage", "Works with Mac, iPad and AirPods"],
    image: null, tags: ["phone", "iphone", "apple", "camera", "everyday"], badge: null, priceSource: SRC.iphone17,
  },
  {
    id: "iphone-17e", name: "iPhone 17e", brand: "Apple", category: "Phones", price: 79900,
    description: "The lowest-priced current iPhone. Price revised upward in September 2026.",
    specs: ["Entry model in the iPhone 17 family"],
    image: null, tags: ["phone", "iphone", "apple", "everyday", "student"], badge: null, priceSource: SRC.iphoneHike,
  },
  {
    id: "pixel-10a", name: "Google Pixel 10a", brand: "Google", category: "Phones", price: 49499,
    description: "Compact Pixel with Google's own chip and a clean Android experience.",
    specs: ["8GB RAM, 256GB storage", "Google Tensor G4", "6.3\" P-OLED display", "48MP + 13MP cameras", "5100mAh battery, 45W charging"],
    image: null, tags: ["phone", "android", "camera", "compact", "pixel"], badge: null, priceSource: SRC.phonesUnder50k,
  },
  {
    id: "nothing-phone-4a-pro", name: "Nothing Phone (4a) Pro", brand: "Nothing", category: "Phones", price: 48899,
    description: "Distinctive design with a triple camera and a large AMOLED screen.",
    specs: ["8GB RAM, 128GB storage", "Snapdragon 7 Gen 4", "6.83\" AMOLED display", "50MP triple camera", "5400mAh battery, 50W charging"],
    image: null, tags: ["phone", "android", "camera", "design"], badge: null, priceSource: SRC.phonesUnder50k,
  },
  {
    id: "oneplus-nord-6", name: "OnePlus Nord 6", brand: "OnePlus", category: "Phones", price: 42999,
    description: "Fast chip, a huge battery and a smooth 165Hz screen for the price.",
    specs: ["8GB RAM, 256GB storage", "Snapdragon 8s Gen 4", "6.78\" AMOLED, 165Hz", "50MP main camera", "9000mAh battery, 80W charging"],
    image: null, tags: ["phone", "android", "performance", "gaming", "battery"], badge: null, priceSource: SRC.phonesUnder50k,
  },
  {
    id: "cmf-phone-2-pro", name: "CMF Phone 2 Pro", brand: "CMF by Nothing", category: "Phones", price: 29499,
    description: "Budget phone from Nothing's CMF brand with an AMOLED screen.",
    specs: ["8GB RAM, 128GB storage", "Dimensity 7300 Pro", "6.77\" flexible AMOLED", "50MP main camera", "5000mAh battery"],
    image: null, tags: ["phone", "android", "budget", "student"], badge: "Under ₹30k", priceSource: SRC.phonesUnder30k,
  },
  {
    id: "redmi-note-15", name: "Redmi Note 15", brand: "Xiaomi", category: "Phones", price: 28999,
    description: "Value phone with a 108MP camera and an AMOLED display.",
    specs: ["8GB RAM, 128GB storage", "Snapdragon 6 Gen 3", "6.77\" AMOLED", "108MP main camera", "5520mAh battery"],
    image: null, tags: ["phone", "android", "budget", "camera", "student"], badge: "Under ₹30k", priceSource: SRC.phonesUnder30k,
  },
  {
    id: "poco-x8", name: "POCO X8 5G", brand: "POCO", category: "Phones", price: 26999,
    description: "Biggest battery in this range, for students who forget to charge.",
    specs: ["6GB RAM, 128GB storage", "Snapdragon 6s Gen 4", "6.83\" AMOLED", "50MP main camera", "9000mAh battery"],
    image: null, tags: ["phone", "android", "budget", "battery", "student"], badge: "Under ₹30k", priceSource: SRC.phonesUnder30k,
  },
  {
    id: "galaxy-m47", name: "Samsung Galaxy M47 5G", brand: "Samsung", category: "Phones", price: 26999,
    description: "Samsung's mid-range M series with a Super AMOLED screen.",
    specs: ["6GB RAM, 128GB storage", "Snapdragon 6 Gen 3", "6.66\" Super AMOLED", "50MP main camera", "6000mAh battery"],
    image: null, tags: ["phone", "android", "budget", "samsung", "student"], badge: "Under ₹30k", priceSource: SRC.phonesUnder30k,
  },

  // Phones under ₹20,000 and ₹40,000 (added 13 Oct 2026)
  {
    id: "samsung-galaxy-a37", name: "Samsung Galaxy A37 5G", brand: "Samsung", category: "Phones", price: 39999,
    description: "Samsung's mid-range A series with a Super AMOLED screen and Exynos chip.",
    specs: ["8GB RAM, 128GB storage", "Exynos 1480", "6.7\" Super AMOLED", "50MP main camera", "5000mAh battery, 45W charging"],
    image: null, tags: ["phone", "android", "samsung", "camera"], badge: null, priceSource: SRC.phonesUnder40k,
  },
  {
    id: "nothing-phone-4a", name: "Nothing Phone (4a)", brand: "Nothing", category: "Phones", price: 38965,
    description: "Nothing's mid-range phone with a flexible AMOLED display.",
    specs: ["8GB RAM, 128GB storage", "Snapdragon 7s Gen 4", "6.78\" flexible AMOLED", "50MP main camera", "5400mAh battery, 50W charging"],
    image: null, tags: ["phone", "android", "design", "camera"], badge: null, priceSource: SRC.phonesUnder40k,
  },
  {
    id: "vivo-t5-pro", name: "vivo T5 Pro", brand: "vivo", category: "Phones", price: 38699,
    description: "Very large 9020mAh battery with fast 90W charging.",
    specs: ["8GB RAM, 128GB storage", "Snapdragon 7s Gen 4", "6.83\" AMOLED", "50MP main camera", "9020mAh battery, 90W charging"],
    image: null, tags: ["phone", "android", "battery", "performance"], badge: null, priceSource: SRC.phonesUnder40k,
  },
  {
    id: "iqoo-z11", name: "iQOO Z11 5G", brand: "iQOO", category: "Phones", price: 34999,
    description: "Performance-focused phone with a fast Dimensity chip, good for gaming.",
    specs: ["6GB RAM, 128GB storage", "Dimensity 7500 Turbo", "6.83\" AMOLED", "50MP main camera", "7050mAh battery, 44W charging"],
    image: null, tags: ["phone", "android", "gaming", "performance"], badge: null, priceSource: SRC.phonesUnder40k,
  },
  {
    id: "motorola-edge-70", name: "Motorola Edge 70", brand: "Motorola", category: "Phones", price: 34980,
    description: "Slim Motorola with 256GB storage as standard.",
    specs: ["8GB RAM, 256GB storage", "Snapdragon 7 Gen 4", "6.7\" AMOLED", "50MP main camera", "5000mAh battery, 68W charging"],
    image: null, tags: ["phone", "android", "storage", "camera"], badge: null, priceSource: SRC.phonesUnder40k,
  },
  {
    id: "oneplus-nord-ce-6", name: "OnePlus Nord CE 6 5G", brand: "OnePlus", category: "Phones", price: 33999,
    description: "Big 8000mAh battery with 80W charging and a bright AMOLED screen.",
    specs: ["8GB RAM, 128GB storage", "Snapdragon 7s Gen 4", "6.78\" AMOLED", "50MP main camera", "8000mAh battery, 80W charging"],
    image: null, tags: ["phone", "android", "battery"], badge: null, priceSource: SRC.phonesUnder40k,
  },
  {
    id: "realme-p4s", name: "realme P4s 5G", brand: "realme", category: "Phones", price: 32999,
    description: "Large battery and AMOLED display at a mid-range price.",
    specs: ["8GB RAM, 128GB storage", "Dimensity 7400 Ultra", "6.78\" AMOLED", "50MP main camera", "8000mAh battery, 80W charging"],
    image: null, tags: ["phone", "android", "battery"], badge: null, priceSource: SRC.phonesUnder40k,
  },
  {
    id: "samsung-galaxy-m17", name: "Samsung Galaxy M17 5G", brand: "Samsung", category: "Phones", price: 19999,
    description: "Budget Samsung with a Super AMOLED screen and triple camera.",
    specs: ["4GB RAM, 128GB storage", "Exynos 1330", "6.7\" Super AMOLED", "50MP + 5MP + 2MP cameras", "5000mAh battery, 25W charging"],
    image: null, tags: ["phone", "android", "samsung", "budget", "student"], badge: "Under ₹20k", priceSource: SRC.phonesUnder20k,
  },
  {
    id: "iqoo-z11-lite", name: "iQOO Z11 Lite 5G", brand: "iQOO", category: "Phones", price: 19497,
    description: "Budget 5G phone with a smooth 120Hz screen.",
    specs: ["4GB RAM, 128GB storage", "Dimensity 6300", "6.74\" LCD, 120Hz", "50MP main camera", "6500mAh battery, 44W charging"],
    image: null, tags: ["phone", "android", "budget", "5g", "student"], badge: "Under ₹20k", priceSource: SRC.phonesUnder20k,
  },
  {
    id: "poco-m8x", name: "POCO M8x 5G", brand: "POCO", category: "Phones", price: 18890,
    description: "Huge 7900mAh battery and a big 120Hz screen for the price.",
    specs: ["4GB RAM, 128GB storage", "Snapdragon 4 Gen 5", "6.9\" LCD, 120Hz", "50MP main camera", "7900mAh battery, 33W charging"],
    image: null, tags: ["phone", "android", "budget", "battery", "student"], badge: "Under ₹20k", priceSource: SRC.phonesUnder20k,
  },
  {
    id: "moto-g37-power", name: "Moto G37 Power 5G", brand: "Motorola", category: "Phones", price: 18250,
    description: "Long-lasting budget Motorola with a 7000mAh battery.",
    specs: ["4GB RAM, 128GB storage", "Dimensity 6400", "6.67\" LCD", "50MP main camera", "7000mAh battery, 30W charging"],
    image: null, tags: ["phone", "android", "budget", "battery"], badge: "Under ₹20k", priceSource: SRC.phonesUnder20k,
  },
  {
    id: "realme-c100x", name: "realme C100X", brand: "realme", category: "Phones", price: 17999,
    description: "Entry phone with an 8000mAh battery. Only 64GB storage.",
    specs: ["4GB RAM, 64GB storage", "Unisoc T7250", "6.8\" LCD", "50MP main camera", "8000mAh battery, 45W charging"],
    image: null, tags: ["phone", "android", "budget", "battery"], badge: "Under ₹20k", priceSource: SRC.phonesUnder20k,
  },
  {
    id: "tecno-spark-50", name: "Tecno Spark 50 5G", brand: "Tecno", category: "Phones", price: 17499,
    description: "Affordable 5G phone with fast 45W charging.",
    specs: ["4GB RAM, 128GB storage", "Dimensity 6400 Ultimate", "6.78\" LCD", "50MP main camera", "6500mAh battery, 45W charging"],
    image: null, tags: ["phone", "android", "budget", "5g"], badge: "Under ₹20k", priceSource: SRC.phonesUnder20k,
  },
  {
    id: "samsung-galaxy-m17e", name: "Samsung Galaxy M17e 5G", brand: "Samsung", category: "Phones", price: 16998,
    description: "Samsung's most affordable 5G phone here.",
    specs: ["4GB RAM, 128GB storage", "Dimensity 6300", "6.7\" LCD", "50MP + 2MP cameras", "6000mAh battery, 25W charging"],
    image: null, tags: ["phone", "android", "samsung", "budget", "student"], badge: "Under ₹20k", priceSource: SRC.phonesUnder20k,
  },
  {
    id: "lava-virat-v1-pro", name: "Lava Virat V1 Pro 5G", brand: "Lava", category: "Phones", price: 15999,
    description: "Indian brand Lava's budget 5G phone with 6GB RAM.",
    specs: ["6GB RAM, 128GB storage", "Unisoc T8200", "6.74\" LCD", "50MP main camera", "6000mAh battery, 18W charging"],
    image: null, tags: ["phone", "android", "budget", "5g", "made in india"], badge: "Under ₹20k", priceSource: SRC.phonesUnder20k,
  },

  // ---------------- Laptops ----------------
  {
    id: "macbook-pro-14-m5", name: "MacBook Pro 14\" (M5)", brand: "Apple", category: "Laptops", price: 169900,
    description: "Apple's Pro laptop with active cooling (fans), so it holds performance during long editing or design sessions.",
    specs: ["Apple M5 chip", "16GB memory, 512GB SSD", "14.2\" Liquid Retina XDR, 120Hz", "Has fans (active cooling)", "1.55 kg"],
    image: null, tags: ["laptop", "mac", "design", "video editing", "figma", "coding", "creator"], badge: null, priceSource: SRC.macbookPro,
  },
  {
    id: "macbook-air-13-m5", name: "MacBook Air 13\" (M5)", brand: "Apple", category: "Laptops", price: 119900,
    description: "Thin, light Mac with plenty of memory for design and coding. Fanless, so it is silent but can slow down under long heavy loads.",
    specs: ["Apple M5, 10-core CPU", "16GB memory, 512GB SSD", "13\" Liquid Retina, 500 nits", "Fanless", "1.23 kg"],
    image: null, tags: ["laptop", "mac", "design", "figma", "coding", "portable", "student"], badge: "New", priceSource: SRC.macbookAir,
  },
  {
    id: "macbook-neo", name: "MacBook Neo", brand: "Apple", category: "Laptops", price: 69900,
    description: "Apple's lowest-priced Mac. Good for notes, browsing, assignments and light design work.",
    specs: ["Apple A18 Pro chip", "8GB memory, 256GB SSD", "13\" Liquid Retina, 500 nits", "Fanless", "Up to 11 hrs web browsing", "1.23 kg"],
    image: null, tags: ["laptop", "mac", "budget", "student", "portable", "notes"], badge: "Lowest-priced Mac", priceSource: SRC.macbookNeo,
  },
  {
    id: "lenovo-loq-rtx5060", name: "Lenovo LOQ (RTX 5060)", brand: "Lenovo", category: "Laptops", price: 109990,
    description: "Gaming laptop with an RTX 5060 graphics card. Strong for video editing, 3D and games. Heavier, with shorter battery life than thin laptops.",
    specs: ["NVIDIA RTX 5060, 8GB", "Intel Core i7-14700HX or AMD Ryzen 7 250", "Up to 32GB RAM", "Up to 165Hz display", "Starting price for build-to-order"],
    image: null, tags: ["laptop", "windows", "gaming", "rtx 5060", "video editing", "gpu", "3d"], badge: "RTX 5060", priceSource: SRC.lenovoLoq,
  },
  {
    id: "asus-tuf-a15-rtx3050", name: "ASUS TUF Gaming A15 (RTX 3050)", brand: "ASUS", category: "Laptops", price: 98401,
    description: "Rugged entry gaming laptop with a dedicated RTX 3050 graphics card.",
    specs: ["NVIDIA RTX 3050", "AMD Ryzen 7 7445HS", "16GB DDR5, 512GB SSD", "15.6\" Full HD"],
    image: null, tags: ["laptop", "windows", "gaming", "gpu", "video editing"], badge: null, priceSource: SRC.laptops80to100k,
  },
  {
    id: "hp-victus-15-rtx4050", name: "HP Victus 15 (RTX 4050)", brand: "HP", category: "Laptops", price: 96303,
    description: "Mid-range gaming laptop. The RTX 4050 handles editing and most games at Full HD.",
    specs: ["NVIDIA RTX 4050, 6GB", "AMD Ryzen 7 7445H", "16GB DDR5, 512GB SSD", "15.6\" Full HD"],
    image: null, tags: ["laptop", "windows", "gaming", "gpu", "video editing", "coding"], badge: null, priceSource: SRC.laptops80to100k,
  },
  {
    id: "asus-vivobook-14-ultra5", name: "ASUS Vivobook 14 (Core Ultra 5)", brand: "ASUS", category: "Laptops", price: 81990,
    description: "Thin everyday laptop with a recent Intel chip. Good for coding, office work and browser-based design tools.",
    specs: ["Intel Core Ultra 5 225H", "16GB DDR5, 512GB SSD", "14\" 1920×1200 display", "Integrated Intel Arc graphics"],
    image: null, tags: ["laptop", "windows", "coding", "student", "portable", "figma"], badge: null, priceSource: SRC.laptops80to100k,
  },
  {
    id: "acer-aspire-3", name: "Acer Aspire 3 (Core i5)", brand: "Acer", category: "Laptops", price: 55900,
    description: "Budget Windows laptop for assignments, browsing and light coding.",
    specs: ["Intel Core i5-1334U", "16GB RAM, 512GB SSD", "15.6\" Full HD"],
    image: null, tags: ["laptop", "windows", "budget", "student", "coding"], badge: null, priceSource: SRC.laptops50to60k,
  },
  {
    id: "asus-vivobook-15-core5", name: "ASUS Vivobook 15 (Core 5)", brand: "ASUS", category: "Laptops", price: 51950,
    description: "The most affordable laptop here with 16GB RAM. Fine for college work and coding practice.",
    specs: ["Intel Core 5 120U", "16GB DDR5, 512GB SSD", "15.6\" Full HD"],
    image: null, tags: ["laptop", "windows", "budget", "student", "coding"], badge: "Lowest price", priceSource: SRC.laptops50to60k,
  },

  // ---------------- Tablets ----------------
  {
    id: "ipad-air-m4", name: "iPad Air 11\" (M4)", brand: "Apple", category: "Tablets", price: 89900,
    description: "Powerful iPad for drawing, design and note-taking. List price rose from its ₹64,900 launch price; festive sales often go lower.",
    specs: ["Apple M4 chip", "128GB storage", "11\" display"],
    image: null, tags: ["tablet", "ipad", "design", "notes", "drawing"], badge: null, priceSource: SRC.ipadAir,
  },
  {
    id: "ipad-a16", name: "iPad 11\" (A16)", brand: "Apple", category: "Tablets", price: 61900,
    description: "The standard iPad. Good for notes, reading and streaming.",
    specs: ["Apple A16 chip", "256GB storage, Wi-Fi"],
    image: null, tags: ["tablet", "ipad", "notes", "student"], badge: null, priceSource: SRC.ipad,
  },
  {
    id: "redmi-pad-2-pro-5g", name: "Redmi Pad 2 Pro 5G", brand: "Xiaomi", category: "Tablets", price: 31999,
    description: "Big 12.1\" screen and a very large battery, with 5G and expandable storage.",
    specs: ["Snapdragon 7s Gen 4", "8GB RAM, 128GB (expandable to 2TB)", "12.1\" 120Hz display", "12000mAh battery"],
    image: null, tags: ["tablet", "android", "5g", "notes", "student", "battery"], badge: null, priceSource: SRC.tablets,
  },
  {
    id: "oneplus-pad-go-2", name: "OnePlus Pad Go 2", brand: "OnePlus", category: "Tablets", price: 29999,
    description: "Large-screen Android tablet for lectures, reading and video.",
    specs: ["Dimensity 7300 Ultra", "8GB RAM, 128GB", "12.1\" 120Hz display", "10050mAh battery"],
    image: null, tags: ["tablet", "android", "notes", "student", "streaming"], badge: null, priceSource: SRC.tablets,
  },
  {
    id: "lenovo-tab-m10-5g", name: "Lenovo Tab M10 5G", brand: "Lenovo", category: "Tablets", price: 17999,
    description: "Affordable 5G tablet for online classes and reading.",
    specs: ["Snapdragon 695", "6GB RAM, 128GB (expandable to 1TB)", "10.61\" 90Hz display", "7700mAh battery"],
    image: null, tags: ["tablet", "android", "budget", "5g", "student"], badge: null, priceSource: SRC.tablets,
  },

  // ---------------- Audio ----------------
  {
    id: "sony-wh-1000xm6", name: "Sony WH-1000XM6", brand: "Sony", category: "Audio", price: 39990,
    description: "Sony's flagship noise-cancelling over-ear headphones with a foldable design.",
    specs: ["Over-ear, wireless", "Active noise cancellation", "Foldable"],
    image: null, tags: ["headphones", "over-ear", "noise cancelling", "travel", "premium"], badge: null, priceSource: SRC.sonyXm6,
  },
  {
    id: "airpods-pro-3", name: "AirPods Pro 3", brand: "Apple", category: "Audio", price: 27900,
    description: "Apple's noise-cancelling earbuds. Pair most easily with iPhone and Mac.",
    specs: ["In-ear, true wireless", "Active noise cancellation"],
    image: null, tags: ["earbuds", "apple", "noise cancelling", "iphone"], badge: null, priceSource: SRC.airpodsPro3,
  },
  {
    id: "jbl-flip-7", name: "JBL Flip 7", brand: "JBL", category: "Audio", price: 9999,
    description: "Portable Bluetooth speaker that survives water and dust, for hostel rooms and trips.",
    specs: ["35W output", "IP68 water and dust resistant", "Up to 16 hours playtime"],
    image: null, tags: ["speaker", "portable", "waterproof", "music", "hostel"], badge: null, priceSource: SRC.jblFlip7,
  },
  {
    id: "cmf-buds-pro-2", name: "CMF Buds Pro 2", brand: "CMF by Nothing", category: "Audio", price: 4299,
    description: "Budget earbuds with strong noise cancellation and a handy dial on the case.",
    specs: ["ANC up to 50dB", "LDAC hi-res audio", "Up to 43 hours with case"],
    image: null, tags: ["earbuds", "noise cancelling", "budget", "commute"], badge: null, priceSource: SRC.tws5k,
  },
  {
    id: "oneplus-nord-buds-4-pro", name: "OnePlus Nord Buds 4 Pro", brand: "OnePlus", category: "Audio", price: 3799,
    description: "Long-lasting earbuds with 55dB noise cancellation under ₹4,000.",
    specs: ["ANC up to 55dB", "Bluetooth 6.0", "Up to 54 hours with case"],
    image: null, tags: ["earbuds", "noise cancelling", "budget", "commute", "battery"], badge: null, priceSource: SRC.tws5k,
  },
  {
    id: "oneplus-nord-buds-3-pro", name: "OnePlus Nord Buds 3 Pro", brand: "OnePlus", category: "Audio", price: 2699,
    description: "Previous-generation OnePlus earbuds with ANC at a lower price.",
    specs: ["Active noise cancellation", "True wireless"],
    image: null, tags: ["earbuds", "noise cancelling", "budget"], badge: null, priceSource: SRC.audioUnder5k,
  },
  {
    id: "boat-nirvana-ion-anc", name: "boAt Nirvana Ion ANC", brand: "boAt", category: "Audio", price: 1699,
    description: "Affordable boAt earbuds with noise cancellation.",
    specs: ["Active noise cancellation", "True wireless"],
    image: null, tags: ["earbuds", "noise cancelling", "budget", "boat"], badge: null, priceSource: SRC.audioUnder5k,
  },
  {
    id: "boat-airdopes-280-anc", name: "boAt Airdopes 280 ANC", brand: "boAt", category: "Audio", price: 1199,
    description: "One of the cheapest earbuds with noise cancellation.",
    specs: ["Active noise cancellation", "True wireless"],
    image: null, tags: ["earbuds", "noise cancelling", "budget", "boat"], badge: null, priceSource: SRC.audioUnder5k,
  },
  {
    id: "noise-buds-n1", name: "Noise Buds N1", brand: "Noise", category: "Audio", price: 799,
    description: "Basic wireless earbuds for calls and music on a tight budget.",
    specs: ["True wireless"],
    image: null, tags: ["earbuds", "budget", "calls"], badge: "Under ₹1,000", priceSource: SRC.audioUnder5k,
  },

  // ---------------- Wearables ----------------
  {
    id: "apple-watch-se-3", name: "Apple Watch SE 3 (40mm, GPS)", brand: "Apple", category: "Wearables", price: 23499,
    description: "Apple's entry smartwatch. Needs an iPhone.",
    specs: ["1.17\" always-on OLED", "Up to 18 hrs battery (32 hrs low power)", "0–80% charge in about 45 min", "Requires iPhone"],
    image: null, tags: ["watch", "smartwatch", "apple", "fitness", "iphone"], badge: null, priceSource: SRC.watchSe3,
  },
  {
    id: "noise-colorfit-ultra-4", name: "Noise ColorFit Ultra 4", brand: "Noise", category: "Wearables", price: 4999,
    description: "Large-screen smartwatch with Bluetooth calling.",
    specs: ["2\" display", "Bluetooth calling"],
    image: null, tags: ["watch", "smartwatch", "budget", "calling", "fitness"], badge: null, priceSource: SRC.noiseWatches,
  },
  {
    id: "noisefit-endeavour", name: "NoiseFit Endeavour", brand: "Noise", category: "Wearables", price: 2499,
    description: "Budget smartwatch with built-in GPS for runs and rides.",
    specs: ["1.46\" display", "Built-in GPS", "Bluetooth calling"],
    image: null, tags: ["watch", "smartwatch", "budget", "gps", "fitness", "running"], badge: null, priceSource: SRC.noiseWatches,
  },
  {
    id: "noise-caliber-3-go", name: "Noise ColorFit Caliber 3 Go", brand: "Noise", category: "Wearables", price: 999,
    description: "Very affordable smartwatch with long battery life.",
    specs: ["1.85\" display", "Up to 10 days battery", "Bluetooth calling"],
    image: null, tags: ["watch", "smartwatch", "budget", "battery"], badge: "Under ₹1,000", priceSource: SRC.noiseWatches,
  },

  // ---------------- Accessories ----------------
  {
    id: "logitech-mx-master-3s", name: "Logitech MX Master 3S", brand: "Logitech", category: "Accessories", price: 18565,
    description: "Premium productivity mouse popular with designers and developers. Expensive for a mouse; cheaper mice work fine for most students.",
    specs: ["Wireless", "Quiet clicks", "Designed for productivity"],
    image: null, tags: ["mouse", "accessory", "design", "coding", "productivity"], badge: null, priceSource: SRC.mxMaster,
  },
  {
    id: "apple-20w-usb-c-adapter", name: "Apple 20W USB-C Power Adapter", brand: "Apple", category: "Accessories", price: 2190,
    description: "iPhones don't include a charger in the box. Add one if you don't already have a USB-C charger.",
    specs: ["20W USB-C", "For iPhone, iPad and AirPods"],
    image: null, tags: ["charger", "accessory", "iphone", "apple", "usb-c"], badge: null, priceSource: SRC.apple20w,
  },
];
