"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMDummyMock = void 0;
class LLMDummyMock {
    constructor() { }
    // First sentence requested
    BeginMessage(ws) {
        const res = {
            response_type: "response",
            response_id: 0,
            content: "How may I help you?",
            content_complete: true,
            end_call: false,
        };
        ws.send(JSON.stringify(res));
    }
    async DraftResponse(request, ws) {
        try {
            const res = {
                response_type: "response",
                response_id: request.response_id,
                content: "I am sorry, can you say that again?",
                content_complete: true,
                end_call: false,
            };
            ws.send(JSON.stringify(res));
        }
        catch (err) {
            console.error("Error in gpt stream: ", err);
        }
    }
}
exports.LLMDummyMock = LLMDummyMock;
