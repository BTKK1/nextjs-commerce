import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

const binaryExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".lockb",
  ".pdf",
  ".png",
  ".webp",
  ".woff",
  ".woff2",
]);

const allowList = new Set([
  ".env.example",
  "scripts/check-secrets.mjs",
]);

const patterns = [
  {
    name: "api_key_like_value",
    regex: /\b(?:sk|or)-[A-Za-z0-9][A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "supabase_key_like_value",
    regex: /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "jwt_like_value",
    regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "postgres_url_with_real_password",
    regex: /postgres(?:ql)?:\/\/[^:\s]+:[^@[\]\s$]{8,}@[^/\s"']+/g,
  },
];

function lineForIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

const commitCandidates = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const findings = [];

for (const file of commitCandidates) {
  if (allowList.has(file)) continue;
  if (binaryExtensions.has(extname(file).toLowerCase())) continue;
  if (!existsSync(file)) continue;

  const content = readFileSync(file, "utf8");
  for (const { name, regex } of patterns) {
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      const value = match[0] ?? "";
      if (name === "postgres_url_with_real_password" && /@(localhost|127\.0\.0\.1)(:|\/)/i.test(value)) {
        continue;
      }
      findings.push({
        file,
        line: lineForIndex(content, match.index ?? 0),
        name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Commit-candidate secret scan failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.name}`);
  }
  process.exit(1);
}

console.log(`Commit-candidate secret scan passed across ${commitCandidates.length} files.`);
