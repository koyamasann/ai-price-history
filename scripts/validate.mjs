import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data/ai-prices.csv");
const statePath = path.join(root, "data/state.json");
const expectedHeader = ["model", "date", "field", "usd", "jpy", "source"];
const allowedFields = new Set(["input", "output", "cached_input"]);
const secretPatterns = [
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i,
  /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[=:]\s*["']?[A-Za-z0-9._-]{16,}/i,
];

function fail(message) {
  console.error(`[validate] ${message}`);
  process.exitCode = 1;
}

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error("unterminated quoted CSV field");
  cells.push(value);
  return cells;
}

function isPublicUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return ["http:", "https:"].includes(url.protocol)
      && !url.username
      && !url.password
      && host !== "localhost"
      && host !== "127.0.0.1"
      && host !== "::1"
      && host !== "capture.kukits.com"
      && !host.endsWith(".workers.dev")
      && !host.endsWith(".internal")
      && !/^10\./.test(host)
      && !/^192\.168\./.test(host)
      && !/^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch {
    return false;
  }
}

const source = fs.readFileSync(csvPath, "utf8").replace(/\r\n/g, "\n");
const lines = source.split("\n");
if (lines.at(-1) === "") lines.pop();
const header = parseCsvLine(lines.shift() || "");
if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
  fail(`header must be exactly ${expectedHeader.join(",")}`);
}

const seen = new Set();
const models = new Set();
const dates = new Set();
const fields = new Set();
let maxDate = "";
for (let index = 0; index < lines.length; index += 1) {
  const lineNumber = index + 2;
  const line = lines[index];
  if (!line) {
    fail(`blank row at line ${lineNumber}`);
    continue;
  }
  if (seen.has(line)) fail(`duplicate row at line ${lineNumber}`);
  seen.add(line);
  let cells;
  try {
    cells = parseCsvLine(line);
  } catch (error) {
    fail(`line ${lineNumber}: ${error.message}`);
    continue;
  }
  if (cells.length !== expectedHeader.length) {
    fail(`line ${lineNumber}: expected 6 columns, got ${cells.length}`);
    continue;
  }
  const [model, date, field, usd, jpy, evidence] = cells;
  if (!model.trim()) fail(`line ${lineNumber}: model is empty`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`line ${lineNumber}: invalid date`);
  if (!allowedFields.has(field)) fail(`line ${lineNumber}: invalid field ${field}`);
  for (const [currency, value] of [["usd", usd], ["jpy", jpy]]) {
    if (!value || !Number.isFinite(Number(value)) || Number(value) < 0) {
      fail(`line ${lineNumber}: invalid ${currency}`);
    }
  }
  if (!isPublicUrl(evidence)) fail(`line ${lineNumber}: source is not a public URL`);
  models.add(model);
  dates.add(date);
  fields.add(field);
  if (date > maxDate) maxDate = date;
}

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
if (state.schema_version !== 1) fail("state schema_version must be 1");
if (state.observation_rows !== lines.length) {
  fail(`state row count ${state.observation_rows} does not match CSV ${lines.length}`);
}
if (lines.length > 0 && state.verified_date !== maxDate) {
  fail(`state verified_date ${state.verified_date} does not match max CSV date ${maxDate}`);
}

for (const relativePath of [
  "README.md",
  "LICENSE",
  "schema.json",
  "data/ai-prices.csv",
  "data/state.json",
  "scripts/validate.mjs",
  "examples/plot.py",
]) {
  const content = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) fail(`${relativePath}: possible secret material detected`);
  }
}

for (const forbiddenName of [".env", ".dev.vars", "credentials.json", "secrets.json"]) {
  if (fs.existsSync(path.join(root, forbiddenName))) fail(`forbidden file: ${forbiddenName}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(JSON.stringify({
  rows: lines.length,
  models: models.size,
  dates: dates.size,
  fields: [...fields].sort(),
  verified_date: state.verified_date,
}));
