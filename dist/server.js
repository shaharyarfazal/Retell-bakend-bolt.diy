"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const express_1 = __importDefault(require("express"));
const express_ws_1 = __importDefault(require("express-ws"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const retell_sdk_1 = require("retell-sdk");
// Any one of these following LLM clients can be used to generate responses.
const llm_openai_func_call_1 = require("./llms/llm_openai_func_call");
// import { DemoLlmClient } from "./llms/llm_azure_openai";
// import { FunctionCallingLlmClient } from "./llms/llm_azure_openai_func_call_end_call";
// import { FunctionCallingLlmClient } from "./llms/llm_azure_openai_func_call";
// import { DemoLlmClient } from "./llms/llm_openrouter";
class Server {
    constructor() {
        this.app = (0, express_ws_1.default)((0, express_1.default)()).app;
        this.httpServer = (0, http_1.createServer)(this.app);
        this.app.use(express_1.default.json());
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.urlencoded({ extended: true }));
        this.handleRetellLlmWebSocket();
        this.handleWebhook();
    }
    listen(port) {
        this.app.listen(port);
        console.log("Listening on " + port);
    }
    /* Handle webhook from Retell server. This is used to receive events from Retell server.
       Including call_started, call_ended, call_analyzed */
    handleWebhook() {
        this.app.post("/webhook", (req, res) => {
            if (!retell_sdk_1.Retell.verify(JSON.stringify(req.body), process.env.RETELL_API_KEY, req.headers["x-retell-signature"])) {
                console.error("Invalid signature");
                return;
            }
            const content = req.body;
            switch (content.event) {
                case "call_started":
                    console.log("Call started event received", content.data.call_id);
                    break;
                case "call_ended":
                    console.log("Call ended event received", content.data.call_id);
                    break;
                case "call_analyzed":
                    console.log("Call analyzed event received", content.data.call_id);
                    break;
                default:
                    console.log("Received an unknown event:", content.event);
            }
            // Acknowledge the receipt of the event
            res.json({ received: true });
        });
    }
    /* Start a websocket server to exchange text input and output with Retell server. Retell server
       will send over transcriptions and other information. This server here will be responsible for
       generating responses with LLM and send back to Retell server.*/
    handleRetellLlmWebSocket() {
        this.app.ws("/llm-websocket/:call_id", async (ws, req) => {
            try {
                const callId = req.params.call_id;
                console.log("Handle llm ws for: ", callId);
                // Send config to Retell server
                const config = {
                    response_type: "config",
                    config: {
                        auto_reconnect: true,
                        call_details: true,
                    },
                };
                ws.send(JSON.stringify(config));
                // Start sending the begin message to signal the client is ready.
                const llmClient = new llm_openai_func_call_1.FunctionCallingLlmClient();
                ws.on("error", (err) => {
                    console.error("Error received in LLM websocket client: ", err);
                });
                ws.on("close", (err) => {
                    console.error("Closing llm ws for: ", callId);
                });
                ws.on("message", async (data, isBinary) => {
                    if (isBinary) {
                        console.error("Got binary message instead of text in websocket.");
                        ws.close(1007, "Cannot find corresponding Retell LLM.");
                    }
                    const request = JSON.parse(data.toString());
                    // There are 5 types of interaction_type: call_details, ping_pong, update_only,response_required, and reminder_required.
                    // Not all of them need to be handled, only response_required and reminder_required.
                    if (request.interaction_type === "call_details") {
                        // print call details
                        console.log("call details: ", request.call);
                        // Send begin message to start the conversation
                        llmClient.BeginMessage(ws);
                    }
                    else if (request.interaction_type === "reminder_required" ||
                        request.interaction_type === "response_required") {
                        console.clear();
                        console.log("req", request);
                        llmClient.DraftResponse(request, ws);
                    }
                    else if (request.interaction_type === "ping_pong") {
                        let pingpongResponse = {
                            response_type: "ping_pong",
                            timestamp: request.timestamp,
                        };
                        ws.send(JSON.stringify(pingpongResponse));
                    }
                    else if (request.interaction_type === "update_only") {
                        // process live transcript update if needed
                    }
                });
            }
            catch (err) {
                console.error("Encountered error:", err);
                ws.close(1011, "Encountered error: " + err);
            }
        });
    }
}
exports.Server = Server;
