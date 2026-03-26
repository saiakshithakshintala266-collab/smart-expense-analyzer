import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

type PublishEventInput = {
  topicArn: string;
  message: unknown;
  messageAttributes?: Record<string, { DataType: "String"; StringValue: string }>;
};

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

export function createSnsClient(): SNSClient {
  const endpoint = process.env.SNS_ENDPOINT_URL;
  return new SNSClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint } : {}),
  });
}

export async function publishEvent(sns: SNSClient, input: PublishEventInput): Promise<void> {
  await sns.send(
    new PublishCommand({
      TopicArn: input.topicArn,
      Message: JSON.stringify(input.message),
      MessageAttributes: input.messageAttributes
    })
  );
}

export function mustGetEventsTopicArn(): string {
  return mustGetEnv("EVENTS_TOPIC_ARN");
}