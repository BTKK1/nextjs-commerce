import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

async function loadEnv(path) {
  try {
    const contents = await readFile(path, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one product row.");
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { throw new Error(`Invalid JSON field: ${value.slice(0, 40)}`); }
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140);
}

await loadEnv(".env");
await loadEnv(".env.local");
const file = argument("file");
const merchantId = argument("merchant-id");
const platform = argument("platform") || "demo";
if (!file || !merchantId) throw new Error("Usage: pnpm catalog:import:csv --file=products.csv --merchant-id=<uuid> [--platform=demo|salla|zid]");
if (!/^[0-9a-f-]{36}$/i.test(merchantId)) throw new Error("merchant-id must be a UUID.");
if (!new Set(["demo", "salla", "zid"]).has(platform)) throw new Error("platform must be demo, salla, or zid.");

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase server credentials are required.");
const rows = parseCsv(await readFile(resolve(file), "utf8"));
const required = ["name", "description", "price", "images", "category", "availability", "variants"];
const products = rows.map((row, index) => {
  for (const field of required) if (!row[field]) throw new Error(`Row ${index + 2} is missing required field: ${field}`);
  const price = Number(row.price);
  if (!Number.isFinite(price) || price < 0) throw new Error(`Row ${index + 2} has an invalid price.`);
  const slug = row.slug || slugify(row.name);
  if (!slug) throw new Error(`Row ${index + 2} needs a slug-compatible name or explicit slug.`);
  const images = parseJson(row.images, []);
  const variants = parseJson(row.variants, []);
  return {
    merchant_id: merchantId, external_id: row.external_id || row.sku || slug, platform, slug, name: row.name,
    arabic_name: row.arabic_name || null, description: row.description, short_description: row.short_description || row.description.slice(0, 320),
    price, compare_at_price: row.compare_at_price ? Number(row.compare_at_price) : null, currency: row.currency || "SAR",
    image_url: Array.isArray(images) ? images[0] ?? null : String(images), category: row.category, availability: row.availability,
    inventory_count: row.inventory ? Number(row.inventory) : null, variants: Array.isArray(variants) ? variants : [],
    attributes: { images, sku: row.sku || null, tags: parseJson(row.tags, []), shippingNotes: row.shipping_notes || null },
    faqs: parseJson(row.faqs, []), sales_guidance: {}, raw_platform_payload: { import_source: "csv", row: index + 2 }, updated_at: new Date().toISOString(),
  };
});

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await supabase.from("products").upsert(products, { onConflict: "merchant_id,platform,slug" });
if (error) throw new Error(`Catalog import failed: ${error.message}`);
console.log(`Catalog import complete: ${products.length} normalized products for merchant ${merchantId.slice(0, 8)}… (${platform}).`);

