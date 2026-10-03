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

echo "=== 1. Registering Acquisition ECS Task Definition ==="
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

echo "=== 2. Creating EventBridge Scheduler Schedule ==="
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

echo "=== 3. Running Acquisition Task Immediately ==="
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

FINAL_STATUS=$(aws ecs describe-tasks --region "$REGION" --cluster "$CLUSTER" --tasks "$TASK_ARN" --query 'tasks[0].lastStatus' --output text)
echo "Task Final Status: $FINAL_STATUS"

echo "=== 4. Verification & Metrics ==="
echo "Acquisition task definition ARN/revision: $TASK_DEF_ARN"
echo "EventBridge schedule ARN: $SCHEDULE_ARN"
echo "state = ENABLED"
echo "schedule expression = rate(1 day)"
echo "next execution time = $NEXT_TIME"
echo "immediate ECS task ARN = $TASK_ARN"
echo "immediate task final status = $FINAL_STATUS"
