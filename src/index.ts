import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Top-level error handler for uncaught exceptions/rejections
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
  process.exit(1);
});

// Determine environment and env file path
const NODE_ENV = process.env.NODE_ENV || "development";
const envFile = path.resolve(process.cwd(), `.env.${NODE_ENV}`);

// Check if env file exists, log error if not
if (!fs.existsSync(envFile)) {
  console.error(`❌ Environment file "${envFile}" not found. Please create it with the required API keys.`);
  process.exit(1);
}

// Load up env file which contains credentials
dotenv.config({ path: envFile });

import { Server } from "./server";

try {
  const server = new Server();
  server.listen(8080);
  console.log("✅ Server started on port 8080");
} catch (err) {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
}
