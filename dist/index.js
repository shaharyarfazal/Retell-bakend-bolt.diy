"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
const envFile = path_1.default.resolve(process.cwd(), `.env.${NODE_ENV}`);
// Check if env file exists, log error if not
if (!fs_1.default.existsSync(envFile)) {
    console.error(`❌ Environment file "${envFile}" not found. Please create it with the required API keys.`);
    process.exit(1);
}
// Load up env file which contains credentials
dotenv_1.default.config({ path: envFile });
const server_1 = require("./server");
try {
    const server = new server_1.Server();
    server.listen(8080);
    console.log("✅ Server started on port 8080");
}
catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
}
