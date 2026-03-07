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
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  >/dev/null 2>&1 || true

# AnalyticsSummaries table
awslocal dynamodb create-table \
  --table-name AnalyticsSummaries \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  >/dev/null 2>&1 || true

# AnomalyDetections table
awslocal dynamodb create-table \
  --table-name AnomalyDetections \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  >/dev/null 2>&1 || true

# Notifications table
awslocal dynamodb create-table \
  --table-name Notifications \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
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

# ── Categorization Queue ─────────────────────────────────────────────────────

CATEGORIZATION_QUEUE_NAME="sea-categorization-queue"

CATEGORIZATION_QUEUE_URL="$(awslocal sqs create-queue --queue-name "${CATEGORIZATION_QUEUE_NAME}" --query 'QueueUrl' --output text)"

CATEGORIZATION_QUEUE_ARN="$(awslocal sqs get-queue-attributes   --queue-url "${CATEGORIZATION_QUEUE_URL}"   --attribute-names QueueArn   --query 'Attributes.QueueArn'   --output text)"

CATEGORIZATION_POLICY="$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Allow-SNS-SendMessage",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "sqs:SendMessage",
      "Resource": "${CATEGORIZATION_QUEUE_ARN}",
      "Condition": {
        "ArnEquals": { "aws:SourceArn": "${TOPIC_ARN}" }
      }
    }
  ]
}
POLICY
)"

awslocal sqs set-queue-attributes   --queue-url "${CATEGORIZATION_QUEUE_URL}"   --attributes Policy="$(echo "${CATEGORIZATION_POLICY}" | tr -d '\n')"   >/dev/null 2>&1 || true

EXISTING_CATEGORIZATION_SUB="$(awslocal sns list-subscriptions-by-topic --topic-arn "${TOPIC_ARN}"   --query "Subscriptions[?Endpoint=='${CATEGORIZATION_QUEUE_ARN}'].SubscriptionArn | [0]" --output text || true)"

if [[ -z "${EXISTING_CATEGORIZATION_SUB}" || "${EXISTING_CATEGORIZATION_SUB}" == "None" ]]; then
  awslocal sns subscribe     --topic-arn "${TOPIC_ARN}"     --protocol sqs     --notification-endpoint "${CATEGORIZATION_QUEUE_ARN}"     >/dev/null 2>&1 || true
fi

# ── Analytics Queue ──────────────────────────────────────────────────────────

ANALYTICS_QUEUE_NAME="sea-analytics-queue"

ANALYTICS_QUEUE_URL="$(awslocal sqs create-queue --queue-name "${ANALYTICS_QUEUE_NAME}" --query 'QueueUrl' --output text)"

ANALYTICS_QUEUE_ARN="$(awslocal sqs get-queue-attributes \
  --queue-url "${ANALYTICS_QUEUE_URL}" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

ANALYTICS_POLICY="$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Allow-SNS-SendMessage",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "sqs:SendMessage",
      "Resource": "${ANALYTICS_QUEUE_ARN}",
      "Condition": {
        "ArnEquals": { "aws:SourceArn": "${TOPIC_ARN}" }
      }
    }
  ]
}
POLICY
)"

awslocal sqs set-queue-attributes \
  --queue-url "${ANALYTICS_QUEUE_URL}" \
  --attributes Policy="$(echo "${ANALYTICS_POLICY}" | tr -d '\n')" \
  >/dev/null 2>&1 || true

EXISTING_ANALYTICS_SUB="$(awslocal sns list-subscriptions-by-topic --topic-arn "${TOPIC_ARN}" \
  --query "Subscriptions[?Endpoint=='${ANALYTICS_QUEUE_ARN}'].SubscriptionArn | [0]" --output text || true)"

if [[ -z "${EXISTING_ANALYTICS_SUB}" || "${EXISTING_ANALYTICS_SUB}" == "None" ]]; then
  awslocal sns subscribe \
    --topic-arn "${TOPIC_ARN}" \
    --protocol sqs \
    --notification-endpoint "${ANALYTICS_QUEUE_ARN}" \
    >/dev/null 2>&1 || true
fi

# ── Anomaly Queue ────────────────────────────────────────────────────────────

ANOMALY_QUEUE_NAME="sea-anomaly-queue"

ANOMALY_QUEUE_URL="$(awslocal sqs create-queue --queue-name "${ANOMALY_QUEUE_NAME}" --query 'QueueUrl' --output text)"

ANOMALY_QUEUE_ARN="$(awslocal sqs get-queue-attributes \
  --queue-url "${ANOMALY_QUEUE_URL}" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

ANOMALY_POLICY="$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Allow-SNS-SendMessage",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "sqs:SendMessage",
      "Resource": "${ANOMALY_QUEUE_ARN}",
      "Condition": {
        "ArnEquals": { "aws:SourceArn": "${TOPIC_ARN}" }
      }
    }
  ]
}
POLICY
)"

awslocal sqs set-queue-attributes \
  --queue-url "${ANOMALY_QUEUE_URL}" \
  --attributes Policy="$(echo "${ANOMALY_POLICY}" | tr -d '\n')" \
  >/dev/null 2>&1 || true

EXISTING_ANOMALY_SUB="$(awslocal sns list-subscriptions-by-topic --topic-arn "${TOPIC_ARN}" \
  --query "Subscriptions[?Endpoint=='${ANOMALY_QUEUE_ARN}'].SubscriptionArn | [0]" --output text || true)"

if [[ -z "${EXISTING_ANOMALY_SUB}" || "${EXISTING_ANOMALY_SUB}" == "None" ]]; then
  awslocal sns subscribe \
    --topic-arn "${TOPIC_ARN}" \
    --protocol sqs \
    --notification-endpoint "${ANOMALY_QUEUE_ARN}" \
    >/dev/null 2>&1 || true
fi

# ── Notifications Queue ──────────────────────────────────────────────────────

NOTIFICATIONS_QUEUE_NAME="sea-notifications-queue"

NOTIFICATIONS_QUEUE_URL="$(awslocal sqs create-queue --queue-name "${NOTIFICATIONS_QUEUE_NAME}" --query 'QueueUrl' --output text)"

NOTIFICATIONS_QUEUE_ARN="$(awslocal sqs get-queue-attributes \
  --queue-url "${NOTIFICATIONS_QUEUE_URL}" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

NOTIFICATIONS_POLICY="$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Allow-SNS-SendMessage",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "sqs:SendMessage",
      "Resource": "${NOTIFICATIONS_QUEUE_ARN}",
      "Condition": {
        "ArnEquals": { "aws:SourceArn": "${TOPIC_ARN}" }
      }
    }
  ]
}
POLICY
)"

awslocal sqs set-queue-attributes \
  --queue-url "${NOTIFICATIONS_QUEUE_URL}" \
  --attributes Policy="$(echo "${NOTIFICATIONS_POLICY}" | tr -d '\n')" \
  >/dev/null 2>&1 || true

EXISTING_NOTIFICATIONS_SUB="$(awslocal sns list-subscriptions-by-topic --topic-arn "${TOPIC_ARN}" \
  --query "Subscriptions[?Endpoint=='${NOTIFICATIONS_QUEUE_ARN}'].SubscriptionArn | [0]" --output text || true)"

if [[ -z "${EXISTING_NOTIFICATIONS_SUB}" || "${EXISTING_NOTIFICATIONS_SUB}" == "None" ]]; then
  awslocal sns subscribe \
    --topic-arn "${TOPIC_ARN}" \
    --protocol sqs \
    --notification-endpoint "${NOTIFICATIONS_QUEUE_ARN}" \
    >/dev/null 2>&1 || true
fi

# ---------- Summary ----------
echo "LocalStack initialized:"
echo "  S3:       sea-uploads-dev"
echo "  DynamoDB: UploadFiles"
echo "  DynamoDB: ExtractedDocs"
echo "  DynamoDB: Transactions
  DynamoDB: AnalyticsSummaries
  DynamoDB: AnomalyDetections
  DynamoDB: Notifications"
echo "  SNS:      ${TOPIC_NAME} (${TOPIC_ARN})"
echo "  SQS:      ${EXTRACTION_QUEUE_NAME} (${EXTRACTION_QUEUE_URL})"
echo "  SQS:      ${TRANSACTIONS_QUEUE_NAME} (${TRANSACTIONS_QUEUE_URL})
  SQS:      ${CATEGORIZATION_QUEUE_NAME} (${CATEGORIZATION_QUEUE_URL})
  SQS:      ${ANALYTICS_QUEUE_NAME} (${ANALYTICS_QUEUE_URL})
  SQS:      ${ANOMALY_QUEUE_NAME} (${ANOMALY_QUEUE_URL})
  SQS:      ${NOTIFICATIONS_QUEUE_NAME} (${NOTIFICATIONS_QUEUE_URL})"