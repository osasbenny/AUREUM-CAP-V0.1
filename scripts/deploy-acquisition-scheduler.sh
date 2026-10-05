#!/usr/bin/env bash
set -euo pipefail

REGION="eu-north-1"
ACCOUNT="795804715712"
CLUSTER="aureum-cap-v01-api"
IMAGE="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/aureum-cap-v01-api:production"
EXEC_ROLE="arn:aws:iam::$ACCOUNT:role/aureum-cap-v01-ecs-execution-role"
TASK_ROLE="arn:aws:iam::$ACCOUNT:role/aureum-cap-v01-api-task-role"
RUNTIME_SECRET_NAME="aureum-cap-v01-api-runtime"
TASK_SG="sg-0653bfae5521b3400"
SUBNETS=$(aws ec2 describe-subnets --region "$REGION" --filters Name=vpc-id,Values=vpc-02f0b750c4f333666 --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' --output text | tr '\t' ',')
LOG_GROUP="/ecs/aureum-cap-v01-api"

echo "=== 0. Building and publishing current repository image ==="
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
docker build --pull -t aureum-cap-v01-api:production .
docker tag aureum-cap-v01-api:production "$IMAGE"
docker push "$IMAGE"
IMAGE_DIGEST=$(aws ecr describe-images --region "$REGION" --repository-name aureum-cap-v01-api --image-ids imageTag=production --query 'imageDetails[0].imageDigest' --output text)
echo "Production image digest: $IMAGE_DIGEST"


echo "=== 1. Setting up SNS Alert Topic & EventBridge Scheduler DLQ ==="
SNS_TOPIC_ARN=$(aws sns create-topic --region "$REGION" --name "aureum-cap-v01-alerts" --query 'TopicArn' --output text 2>/dev/null || aws sns list-topics --region "$REGION" --query "Topics[?ends_with(TopicArn, ':aureum-cap-v01-alerts')].TopicArn | [0]" --output text)
echo "SNS Alert Topic ARN: $SNS_TOPIC_ARN"

DLQ_URL=$(aws sqs create-queue --region "$REGION" --queue-name "aureum-cap-v01-scheduler-dlq" --query 'QueueUrl' --output text 2>/dev/null || aws sqs get-queue-url --region "$REGION" --queue-name "aureum-cap-v01-scheduler-dlq" --query 'QueueUrl' --output text)
DLQ_ARN=$(aws sqs get-queue-attributes --region "$REGION" --queue-url "$DLQ_URL" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)
echo "Scheduler DLQ ARN: $DLQ_ARN"
echo "Production image digest: $IMAGE_DIGEST"

echo "=== 2. Registering Acquisition ECS Task Definition ==="
RUNTIME_ARN=$(aws secretsmanager describe-secret --region "$REGION" --secret-id "$RUNTIME_SECRET_NAME" --query ARN --output text)

cat > /tmp/acquisition-task-definition.json <<TASK
{
  "family": "aureum-cap-v01-acquisition",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$EXEC_ROLE",
  "taskRoleArn": "$TASK_ROLE",
  "containerDefinitions": [
    {
      "name": "acquisition",
      "image": "$IMAGE",
      "essential": true,
      "command": ["npm", "run", "acquire"],
      "environment": [
        {"name": "CAP_DAILY_ACQUISITION_TARGET", "value": "1000"},
        {"name": "CAP_DISCOVERY_RAW_LIMIT", "value": "5000"},
        {"name": "CAP_DISCOVERY_PROVIDER", "value": "overpass"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "$RUNTIME_ARN:DATABASE_URL::"},
        {"name": "AWS_REGION", "valueFrom": "$RUNTIME_ARN:AWS_REGION::"},
        {"name": "CAP_S3_BUCKET", "valueFrom": "$RUNTIME_ARN:CAP_S3_BUCKET::"},
        {"name": "CAP_SQS_QUEUE_URL", "valueFrom": "$RUNTIME_ARN:CAP_SQS_QUEUE_URL::"},
        {"name": "SES_FROM_EMAIL", "valueFrom": "$RUNTIME_ARN:SES_FROM_EMAIL::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "$LOG_GROUP",
          "awslogs-region": "$REGION",
          "awslogs-stream-prefix": "acquisition"
        }
      }
    }
  ]
}
TASK

TASK_DEF_ARN=$(aws ecs register-task-definition --region "$REGION" --cli-input-json file:///tmp/acquisition-task-definition.json --query 'taskDefinition.taskDefinitionArn' --output text)
echo "Registered Task Definition ARN: $TASK_DEF_ARN"

echo "=== 3. Creating EventBridge Scheduler Schedule with DLQ & Retry ==="
ROLE_ARN="arn:aws:iam::$ACCOUNT:role/aureum-cap-v01-scheduler-role"

if ! aws iam get-role --role-name aureum-cap-v01-scheduler-role >/dev/null 2>&1; then
  aws iam create-role --role-name aureum-cap-v01-scheduler-role --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name aureum-cap-v01-scheduler-role --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceEventsRole >/dev/null
fi

CLUSTER_ARN=$(aws ecs describe-clusters --region "$REGION" --clusters "$CLUSTER" --query 'clusters[0].clusterArn' --output text)
SUBNET_JSON_ARRAY=$(echo "$SUBNETS" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')

cat > /tmp/scheduler-target.json <<TARGET
{
  "Arn": "$CLUSTER_ARN",
  "RoleArn": "$ROLE_ARN",
  "EcsParameters": {
    "TaskDefinitionArn": "$TASK_DEF_ARN",
    "TaskCount": 1,
    "LaunchType": "FARGATE",
    "NetworkConfiguration": {
      "awsvpcConfiguration": {
        "Subnets": [$SUBNET_JSON_ARRAY],
        "SecurityGroups": ["$TASK_SG"],
        "AssignPublicIp": "ENABLED"
      }
    }
  },
  "RetryPolicy": {
    "MaximumRetryAttempts": 3
  },
  "DeadLetterConfig": {
    "Arn": "$DLQ_ARN"
  }
}
TARGET

aws scheduler create-schedule \
  --region "$REGION" \
  --name "aureum-cap-v01-daily-acquisition" \
  --schedule-expression "rate(1 day)" \
  --flexible-time-window "Mode=OFF" \
  --state "ENABLED" \
  --target file:///tmp/scheduler-target.json \
  --action-after-completion "NONE" 2>/dev/null || \
aws scheduler update-schedule \
  --region "$REGION" \
  --name "aureum-cap-v01-daily-acquisition" \
  --schedule-expression "rate(1 day)" \
  --flexible-time-window "Mode=OFF" \
  --state "ENABLED" \
  --target file:///tmp/scheduler-target.json \
  --action-after-completion "NONE"

SCHEDULE_ARN=$(aws scheduler get-schedule --region "$REGION" --name "aureum-cap-v01-daily-acquisition" --query 'Arn' --output text)
NEXT_TIME=$(aws scheduler get-schedule --region "$REGION" --name "aureum-cap-v01-daily-acquisition" --query 'StartDate' --output text)
echo "Schedule ARN: $SCHEDULE_ARN"

echo "=== 4. Running Acquisition Task Immediately ==="
TASK_RUN_JSON=$(aws ecs run-task \
  --region "$REGION" \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF_ARN" \
  --launch-type "FARGATE" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$TASK_SG],assignPublicIp=ENABLED}" \
  --output json)

TASK_ARN=$(echo "$TASK_RUN_JSON" | jq -r '.tasks[0].taskArn')
echo "Immediate Task ARN: $TASK_ARN"

echo "Waiting for task to stop..."
aws ecs wait tasks-stopped --region "$REGION" --cluster "$CLUSTER" --tasks "$TASK_ARN"

TASK_INFO=$(aws ecs describe-tasks --region "$REGION" --cluster "$CLUSTER" --tasks "$TASK_ARN" --output json)
FINAL_STATUS=$(echo "$TASK_INFO" | jq -r '.tasks[0].lastStatus')
EXIT_CODE=$(echo "$TASK_INFO" | jq -r '.tasks[0].containers[0].exitCode // -1')
STOP_REASON=$(echo "$TASK_INFO" | jq -r '.tasks[0].stoppedReason // ""')
TASK_ID="${TASK_ARN##*/}"
echo "Task Final Status: $FINAL_STATUS"
echo "Task Exit Code: $EXIT_CODE"
echo "Task Stop Reason: $STOP_REASON"
echo "=== Acquisition task logs ==="
aws logs get-log-events --region "$REGION" --log-group-name "$LOG_GROUP" --log-stream-name "acquisition/acquisition/$TASK_ID" --limit 100 --query 'events[].message' --output text || true
if [ "$EXIT_CODE" != "0" ]; then
  echo "ERROR: acquisition task failed"
  exit 1
fi

echo "=== 5. Verification & Metrics ==="
echo "Acquisition task definition ARN/revision: $TASK_DEF_ARN"
echo "EventBridge schedule ARN: $SCHEDULE_ARN"
echo "state = ENABLED"
echo "schedule expression = rate(1 day)"
echo "next execution time = $NEXT_TIME"
echo "immediate ECS task ARN = $TASK_ARN"
echo "immediate task final status = $FINAL_STATUS"
echo "SNS Alert Topic ARN: $SNS_TOPIC_ARN"
echo "Scheduler DLQ ARN: $DLQ_ARN"
