#!/usr/bin/env bash
set -euo pipefail

# ---------- Storage ----------
awslocal s3 mb s3://sea-uploads-dev || true

# UploadFiles table
awslocal dynamodb create-table \
  --table-name UploadFiles \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  >/dev/null 2>&1 || true

# ExtractedDocs table
awslocal dynamodb create-table \
  --table-name ExtractedDocs \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  >/dev/null 2>&1 || true

# Transactions table
awslocal dynamodb create-table \
  --table-name Transactions \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI2PK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    'IndexName=GSI2,KeySchema=[{AttributeName=GSI2PK,KeyType=HASH}],Projection={ProjectionType=ALL}' \
  --billing-mode PAY_PER_REQUEST \
  >/dev/null 2>&1 || true

# ---------- Events (SNS -> SQS) ----------
TOPIC_NAME="sea-events"
EXTRACTION_QUEUE_NAME="sea-extraction-queue"
TRANSACTIONS_QUEUE_NAME="sea-transactions-queue"

# 1) Create SNS topic (idempotent)
TOPIC_ARN="$(awslocal sns create-topic --name "${TOPIC_NAME}" --query 'TopicArn' --output text)"

# ── Extraction Queue ──────────────────────────────────────────────────────────

# 2) Create extraction SQS queue
EXTRACTION_QUEUE_URL="$(awslocal sqs create-queue --queue-name "${EXTRACTION_QUEUE_NAME}" --query 'QueueUrl' --output text)"

# 3) Get extraction queue ARN
EXTRACTION_QUEUE_ARN="$(awslocal sqs get-queue-attributes \
  --queue-url "${EXTRACTION_QUEUE_URL}" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

# 4) Allow SNS → extraction queue
EXTRACTION_POLICY="$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Allow-SNS-SendMessage",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "sqs:SendMessage",
      "Resource": "${EXTRACTION_QUEUE_ARN}",
      "Condition": {
        "ArnEquals": { "aws:SourceArn": "${TOPIC_ARN}" }
      }
    }
  ]
}
POLICY
)"

awslocal sqs set-queue-attributes \
  --queue-url "${EXTRACTION_QUEUE_URL}" \
  --attributes Policy="$(echo "${EXTRACTION_POLICY}" | tr -d '\n')" \
  >/dev/null 2>&1 || true

# 5) Subscribe extraction queue to SNS topic
EXISTING_EXTRACTION_SUB="$(awslocal sns list-subscriptions-by-topic --topic-arn "${TOPIC_ARN}" \
  --query "Subscriptions[?Endpoint=='${EXTRACTION_QUEUE_ARN}'].SubscriptionArn | [0]" --output text || true)"

if [[ -z "${EXISTING_EXTRACTION_SUB}" || "${EXISTING_EXTRACTION_SUB}" == "None" ]]; then
  awslocal sns subscribe \
    --topic-arn "${TOPIC_ARN}" \
    --protocol sqs \
    --notification-endpoint "${EXTRACTION_QUEUE_ARN}" \
    >/dev/null 2>&1 || true
fi

# ── Transactions Queue ────────────────────────────────────────────────────────

# 6) Create transactions SQS queue
TRANSACTIONS_QUEUE_URL="$(awslocal sqs create-queue --queue-name "${TRANSACTIONS_QUEUE_NAME}" --query 'QueueUrl' --output text)"

# 7) Get transactions queue ARN
TRANSACTIONS_QUEUE_ARN="$(awslocal sqs get-queue-attributes \
  --queue-url "${TRANSACTIONS_QUEUE_URL}" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

# 8) Allow SNS → transactions queue
TRANSACTIONS_POLICY="$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Allow-SNS-SendMessage",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "sqs:SendMessage",
      "Resource": "${TRANSACTIONS_QUEUE_ARN}",
      "Condition": {
        "ArnEquals": { "aws:SourceArn": "${TOPIC_ARN}" }
      }
    }
  ]
}
POLICY
)"

awslocal sqs set-queue-attributes \
  --queue-url "${TRANSACTIONS_QUEUE_URL}" \
  --attributes Policy="$(echo "${TRANSACTIONS_POLICY}" | tr -d '\n')" \
  >/dev/null 2>&1 || true

# 9) Subscribe transactions queue to SNS topic
EXISTING_TRANSACTIONS_SUB="$(awslocal sns list-subscriptions-by-topic --topic-arn "${TOPIC_ARN}" \
  --query "Subscriptions[?Endpoint=='${TRANSACTIONS_QUEUE_ARN}'].SubscriptionArn | [0]" --output text || true)"

if [[ -z "${EXISTING_TRANSACTIONS_SUB}" || "${EXISTING_TRANSACTIONS_SUB}" == "None" ]]; then
  awslocal sns subscribe \
    --topic-arn "${TOPIC_ARN}" \
    --protocol sqs \
    --notification-endpoint "${TRANSACTIONS_QUEUE_ARN}" \
    >/dev/null 2>&1 || true
fi

# ---------- Summary ----------
echo "LocalStack initialized:"
echo "  S3:       sea-uploads-dev"
echo "  DynamoDB: UploadFiles"
echo "  DynamoDB: ExtractedDocs"
echo "  DynamoDB: Transactions"
echo "  SNS:      ${TOPIC_NAME} (${TOPIC_ARN})"
echo "  SQS:      ${EXTRACTION_QUEUE_NAME} (${EXTRACTION_QUEUE_URL})"
echo "  SQS:      ${TRANSACTIONS_QUEUE_NAME} (${TRANSACTIONS_QUEUE_URL})"