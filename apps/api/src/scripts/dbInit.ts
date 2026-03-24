import { applySchema } from "../db/bootstrap.js";
import { pool } from "../db/pool.js";

async function main() {
  await applySchema();
  console.log("LaborForce schema applied.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

