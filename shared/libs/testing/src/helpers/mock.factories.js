"use strict";
// File: shared/libs/testing/src/helpers/mock.factories.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockDdbClient = createMockDdbClient;
exports.createMockSnsClient = createMockSnsClient;
exports.createMockSqsClient = createMockSqsClient;
exports.createMockBedrockClient = createMockBedrockClient;
exports.createMockRepo = createMockRepo;
function createMockDdbClient() {
    return { send: jest.fn().mockResolvedValue({}) };
}
function createMockSnsClient() {
    return { send: jest.fn().mockResolvedValue({ MessageId: "mock-message-id" }) };
}
function createMockSqsClient() {
    return { send: jest.fn().mockResolvedValue({ Messages: [] }) };
}
function createMockBedrockClient() {
    return {
        send: jest.fn().mockResolvedValue({
            output: { message: { role: "assistant", content: [{ text: "Mock response" }] } },
            stopReason: "end_turn"
        })
    };
}
function createMockRepo(methods) {
    const mock = {};
    for (const m of methods)
        mock[m] = jest.fn();
    return mock;
}
//# sourceMappingURL=mock.factories.js.map