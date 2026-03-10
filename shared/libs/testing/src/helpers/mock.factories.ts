// File: shared/libs/testing/src/helpers/mock.factories.ts

export function createMockDdbClient() {
  return { send: jest.fn().mockResolvedValue({}) };
}

export function createMockSnsClient() {
  return { send: jest.fn().mockResolvedValue({ MessageId: "mock-message-id" }) };
}

export function createMockSqsClient() {
  return { send: jest.fn().mockResolvedValue({ Messages: [] }) };
}

export function createMockBedrockClient() {
  return {
    send: jest.fn().mockResolvedValue({
      output: { message: { role: "assistant", content: [{ text: "Mock response" }] } },
      stopReason: "end_turn"
    })
  };
}

export function createMockRepo<T extends object>(methods: (keyof T)[]): jest.Mocked<T> {
  const mock: Partial<jest.Mocked<T>> = {};
  for (const m of methods) (mock as any)[m] = jest.fn();
  return mock as jest.Mocked<T>;
}