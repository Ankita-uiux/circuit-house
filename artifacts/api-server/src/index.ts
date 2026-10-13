import app from "./app";
import { logger } from "./lib/logger";
import { ensureSchema } from "./lib/ensure-schema";
import { startIcecatImageLookup } from "./lib/icecat";
import { catalog } from "./data/catalog";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

try {
  await ensureSchema();
} catch (err) {
  logger.error(
    { err },
    "Could not prepare the database. Check that DATABASE_URL is correct and the database is reachable.",
  );
  process.exit(1);
}

startIcecatImageLookup(catalog);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
