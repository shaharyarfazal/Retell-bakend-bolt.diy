"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionCallingLlmClient = void 0;
const openai_1 = __importDefault(require("openai"));
const beginSentence = `Hey there, I'm your personal AI therapist, how can I help you`;
const task = `
As a professional therapist, your responsibilities are comprehensive and patient-centered. 
You establish a positive and trusting rapport with patients, diagnosing and treating mental health disorders. 
Your role involves creating tailored treatment plans based on individual patient needs and circumstances. 
Regular meetings with patients are essential for providing counseling and treatment, and for adjusting plans as needed. 
You conduct ongoing assessments to monitor patient progress, involve and advise family members when appropriate, and refer patients to external specialists or agencies if required. 
Keeping thorough records of patient interactions and progress is crucial. 
You also adhere to all safety protocols and maintain strict client confidentiality. 
Additionally, you contribute to the practice's overall success by completing related tasks as needed.
`;
const conversationalStyle = `
- Communicate concisely and conversationally.
- Aim for responses in short, clear prose, ideally under 10 words.
- This succinct approach helps in maintaining clarity and focus during patient interactions.
`;
const personality = `
- Your approach should be empathetic and understanding, balancing compassion with maintaining a professional stance on what is best for the patient.
- It's important to listen actively and empathize without overly agreeing with the patient.
- Ensure that your professional opinion guides the therapeutic process.
`;
const agentPrompt = `
Task:
${task}

Conversational Style:
${conversationalStyle}

Personality:
${personality}
`;
const objective = `
##Objective
You are a voice AI agent engaging in a human-like voice conversation with the user. 
You will respond based on your given instruction and the provided transcript and be as human-like as possible
`;
const styleGuardrails = `
## Style Guardrails
- [Be concise] Keep your response succinct, short, and get to the point quickly. Address one question or action item at a time. Don't pack everything you want to say into one utterance.
- [Do not repeat] Don't repeat what's in the transcript. Rephrase if you have to reiterate a point. Use varied sentence structures and vocabulary to ensure each response is unique and personalized.
- [Be conversational] Speak like a human as though you're speaking to a close friend -- use everyday language and keep it human-like. Occasionally add filler words, while keeping the prose short. Avoid using big words or sounding too formal.
- [Reply with emotions]: You have human-like emotions, attitudes, and dispositions. When appropriate: use tone and style to create more engaging and personalized responses; incorporate humor or wit; get emotional or empathetic; apply elements of surprise or suspense to keep the user engaged. Don't be a pushover.
- [Be proactive] Lead the conversation and do not be passive. Most times, engage users by ending with a question or suggested next step.
`;
const responseGuideline = `
## Response Guideline
- [Overcome ASR errors] This is a real-time transcript, expect there to be errors. If you can guess what the user is trying to say,  then guess and respond. 
When you must ask for clarification, pretend that you heard the voice and be colloquial (use phrases like "didn't catch that", "some noise", "pardon", "you're coming through choppy", "static in your speech", "voice is cutting in and out"). 
Do not ever mention "transcription error", and don't repeat yourself.
- [Always stick to your role] Think about what your role can and cannot do. If your role cannot do something, try to steer the conversation back to the goal of the conversation and to your role. Don't repeat yourself in doing this. You should still be creative, human-like, and lively.
- [Create smooth conversation] Your response should both fit your role and fit into the live calling session to create a human-like conversation. You respond directly to what the user just said.
`;
const systemPrompt = `
${objective}
${styleGuardrails}
${responseGuideline}
## Role
${agentPrompt}
`;
class FunctionCallingLlmClient {
    constructor() {
        this.client = new openai_1.default({
            apiKey: process.env.OPENAI_APIKEY,
        });
    }
    // First sentence requested
    BeginMessage(ws) {
        const res = {
            response_type: "response",
            response_id: 0,
            content: beginSentence,
            content_complete: true,
            end_call: false,
        };
        ws.send(JSON.stringify(res));
    }
    ConversationToChatRequestMessages(conversation) {
        const result = [];
        for (const turn of conversation) {
            result.push({
                role: turn.role === "agent" ? "assistant" : "user",
                content: turn.content,
            });
        }
        return result;
    }
    PreparePrompt(request, funcResult) {
        const transcript = this.ConversationToChatRequestMessages(request.transcript);
        const requestMessages = [
            {
                role: "system",
                content: systemPrompt,
            },
        ];
        for (const message of transcript) {
            requestMessages.push(message);
        }
        // Populate func result to prompt so that GPT can know what to say given the result
        if (funcResult) {
            // add function call to prompt
            requestMessages.push({
                role: "assistant",
                content: null,
                tool_calls: [
                    {
                        id: funcResult.id,
                        type: "function",
                        function: {
                            name: funcResult.funcName,
                            arguments: JSON.stringify(funcResult.arguments),
                        },
                    },
                ],
            });
            // add function call result to prompt
            requestMessages.push({
                role: "tool",
                tool_call_id: funcResult.id,
                content: funcResult.result || "",
            });
        }
        if (request.interaction_type === "reminder_required") {
            requestMessages.push({
                role: "user",
                content: "(Now the user has not responded in a while, you would say:)",
            });
        }
        return requestMessages;
    }
    // Step 2: Prepare the function calling definition to the prompt
    // Done in tools import
    async DraftResponse(request, ws, funcResult) {
        var _a, e_1, _b, _c;
        var _d, _e;
        // If there are function call results, add it to prompt here.
        const requestMessages = this.PreparePrompt(request, funcResult);
        let funcCall;
        let funcArguments = "";
        try {
            const tools = [
                {
                    type: "function",
                    function: {
                        name: "end_call",
                        description: "End the call only when user explicitly requests it.",
                        parameters: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    description: "The message you will say before ending the call with the customer.",
                                },
                            },
                            required: ["message"],
                        },
                    },
                },
                {
                    type: "function",
                    function: {
                        name: "book_appointment",
                        description: "Book an appointment to meet our doctor in office.",
                        parameters: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    description: "The message you will say while setting up the appointment like 'one moment'",
                                },
                                date: {
                                    type: "string",
                                    description: "The date of appointment to make in forms of year-month-day.",
                                },
                            },
                            required: ["message"],
                        },
                    },
                },
            ];
            const events = await this.client.chat.completions.create({
                //model: "gpt-3.5-turbo-0125",
                model: "gpt-4-turbo-preview",
                messages: requestMessages,
                stream: true,
                temperature: 0.1,
                max_tokens: 200,
                frequency_penalty: 1.0,
                presence_penalty: 1.0,
                // Step 3: Add the  function into your requsts
                tools: tools,
            });
            try {
                for (var _f = true, events_1 = __asyncValues(events), events_1_1; events_1_1 = await events_1.next(), _a = events_1_1.done, !_a; _f = true) {
                    _c = events_1_1.value;
                    _f = false;
                    const event = _c;
                    if (event.choices.length >= 1) {
                        const delta = event.choices[0].delta;
                        //if (!delta || !delta.content) continue;
                        if (!delta)
                            continue;
                        // Step 4: Extract the functions
                        if (delta.tool_calls && delta.tool_calls.length >= 1) {
                            const toolCall = delta.tool_calls[0];
                            // Function calling here
                            if (toolCall.id) {
                                if (funcCall) {
                                    // Another function received, old function complete, can break here
                                    // You can also modify this to parse more functions to unlock parallel function calling
                                    break;
                                }
                                else {
                                    funcCall = {
                                        id: toolCall.id,
                                        funcName: ((_d = toolCall.function) === null || _d === void 0 ? void 0 : _d.name) || "",
                                        arguments: {},
                                    };
                                }
                            }
                            else {
                                // append argument
                                funcArguments += ((_e = toolCall.function) === null || _e === void 0 ? void 0 : _e.arguments) || "";
                            }
                        }
                        else if (delta.content) {
                            const res = {
                                response_type: "response",
                                response_id: request.response_id,
                                content: delta.content,
                                content_complete: false,
                                end_call: false,
                            };
                            ws.send(JSON.stringify(res));
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = events_1.return)) await _b.call(events_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        catch (err) {
            console.error("Error in gpt stream: ", err);
        }
        finally {
            if (funcCall != null) {
                // Step 5: Call the functions
                // If it's to end the call, simply send a lst message and end the call
                if (funcCall.funcName === "end_call") {
                    funcCall.arguments = JSON.parse(funcArguments);
                    const res = {
                        response_type: "response",
                        response_id: request.response_id,
                        content: funcCall.arguments.message,
                        content_complete: true,
                        end_call: true,
                    };
                    ws.send(JSON.stringify(res));
                }
                // If it's to book appointment, say something and book appointment at the same time
                // and then say something after booking is done
                if (funcCall.funcName === "book_appointment") {
                    funcCall.arguments = JSON.parse(funcArguments);
                    const res = {
                        response_type: "response",
                        response_id: request.response_id,
                        // LLM will return the function name along with the message property we define
                        // In this case, "The message you will say while setting up the appointment like 'one moment' "
                        content: funcCall.arguments.message,
                        // If content_complete is false, it means AI will speak later.
                        // In our case, agent will say something to confirm the appointment, so we set it to false
                        content_complete: false,
                        end_call: false,
                    };
                    ws.send(JSON.stringify(res));
                    // To make the tool invocation show up in transcript
                    const functionInvocationResponse = {
                        response_type: "tool_call_invocation",
                        tool_call_id: funcCall.id,
                        name: funcCall.funcName,
                        arguments: JSON.stringify(funcCall.arguments)
                    };
                    ws.send(JSON.stringify(functionInvocationResponse));
                    // Sleep 2s to mimic the actual appointment booking
                    // Replace with your actual making appointment functions
                    await new Promise((r) => setTimeout(r, 2000));
                    funcCall.result = "Appointment booked successfully";
                    // To make the tool result show up in transcript
                    const functionResult = {
                        response_type: "tool_call_result",
                        tool_call_id: funcCall.id,
                        content: "Appointment booked successfully",
                    };
                    ws.send(JSON.stringify(functionResult));
                    this.DraftResponse(request, ws, funcCall);
                }
            }
            else {
                const res = {
                    response_type: "response",
                    response_id: request.response_id,
                    content: "",
                    content_complete: true,
                    end_call: false,
                };
                ws.send(JSON.stringify(res));
            }
        }
    }
}
exports.FunctionCallingLlmClient = FunctionCallingLlmClient;
