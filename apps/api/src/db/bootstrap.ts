import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function applySchema() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = await readFile(schemaPath, "utf8");
  await pool.query(sql);
}
