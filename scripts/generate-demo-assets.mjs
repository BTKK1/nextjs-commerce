import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const catalog = JSON.parse(
  await readFile(join(root, "src", "data", "demo-catalog.json"), "utf8")
);

const missing = [];
for (const product of catalog.products) {
  if (!product.imagePath?.startsWith("/store-products/")) {
    missing.push(`${product.slug}: expected /store-products image path`);
    continue;
  }
  try {
    await access(join(root, "public", product.imagePath.replace(/^\//, "")));
  } catch {
    missing.push(`${product.slug}: missing ${product.imagePath}`);
  }
}

try {
  await access(join(root, "public", "store-products", "hero.jpg"));
} catch {
  missing.push("missing /store-products/hero.jpg");
}

if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}

console.log("Verified Maison Vert product image assets.");
