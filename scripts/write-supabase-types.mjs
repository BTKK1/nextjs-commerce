import { access, readFile } from "node:fs/promises";

const file = new URL("../src/lib/supabase/types.ts", import.meta.url);
await access(file);
const contents = await readFile(file, "utf8");
if (!contents.includes("interface Database")) {
  throw new Error("Supabase types file is incomplete.");
}
console.log("Supabase database types are present at src/lib/supabase/types.ts");
