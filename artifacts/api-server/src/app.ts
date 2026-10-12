import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In a single-service deployment (e.g. Render), this server also serves the
// built storefront. On Replit the storefront is served separately, and this
// folder simply doesn't exist next to the API bundle.
const storefrontDir =
  process.env.STOREFRONT_DIR ??
  path.resolve(import.meta.dirname, "../../circuit-house/dist/public");
if (fs.existsSync(path.join(storefrontDir, "index.html"))) {
  app.use(express.static(storefrontDir, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(storefrontDir, "index.html"));
  });
  logger.info({ storefrontDir }, "Serving storefront");
}

export default app;
