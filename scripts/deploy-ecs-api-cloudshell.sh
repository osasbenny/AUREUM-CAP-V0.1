#!/usr/bin/env bash
set -euo pipefail

REGION=eu-north-1
ACCOUNT=795804715712
REPO=aureum-cap-v01-api
CLUSTER=aureum-cap-v01-api
SERVICE=aureum-cap-v01-api
IMAGE="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:production"
TG_ARN=arn:aws:elasticloadbalancing:eu-north-1:795804715712:targetgroup/aureum-cap-v01-api-tg/226dbd8390037824
TASK_SG=sg-0653bfae5521b3400
EXEC_ROLE=arn:aws:iam::$ACCOUNT:role/aureum-cap-v01-ecs-execution-role
TASK_ROLE=arn:aws:iam::$ACCOUNT:role/aureum-cap-v01-api-task-role
RUNTIME_SECRET_NAME=aureum-cap-v01-api-runtime
WORKDIR="${PWD}"

: "${CAP_ADMIN_EMAIL:?Set CAP_ADMIN_EMAIL before running}"
if [[ -z "${CAP_ADMIN_PASSWORD:-}" ]]; then
  read -r -s -p 'CAP_ADMIN_PASSWORD (do not paste into chat): ' CAP_ADMIN_PASSWORD
  echo
fi
[[ ${#CAP_ADMIN_PASSWORD} -ge 16 ]] || { echo 'Admin password must be at least 16 characters.' >&2; exit 1; }

RDS_SECRET_NAME=$(aws secretsmanager list-secrets --region "$REGION" --query 'SecretList[?starts_with(Name, `rds!`)].Name | [0]' --output text)
[[ "$RDS_SECRET_NAME" != "None" && -n "$RDS_SECRET_NAME" ]] || { echo 'RDS managed secret not found.' >&2; exit 1; }
RDS_JSON=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$RDS_SECRET_NAME" --query SecretString --output text)
DB_USER=$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier aureum-cap-v01-db --query 'DBInstances[0].MasterUsername' --output text)
DB_HOST=$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier aureum-cap-v01-db --query 'DBInstances[0].Endpoint.Address' --output text)
DB_PORT=$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier aureum-cap-v01-db --query 'DBInstances[0].Endpoint.Port' --output text)
DB_NAME=postgres
if jq -e . >/dev/null 2>&1 <<<"$RDS_JSON"; then
  DB_PASS=$(jq -r 'to_entries[] | select(.key | ascii_downcase | test("pass")) | .value' <<<"$RDS_JSON" | head -n 1)
else
  DB_PASS="$RDS_JSON"
fi
[[ -n "$DB_PASS" && "$DB_PASS" != "null" && -n "$DB_HOST" && "$DB_HOST" != "None" ]] || { echo 'RDS managed secret or instance metadata did not provide a usable password/endpoint.' >&2; exit 1; }
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

EXISTING_RUNTIME_JSON='{}'
if aws secretsmanager describe-secret --region "$REGION" --secret-id "$RUNTIME_SECRET_NAME" >/dev/null 2>&1; then
  EXISTING_RUNTIME_JSON=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$RUNTIME_SECRET_NAME" --query SecretString --output text)
  jq -e . >/dev/null 2>&1 <<<"$EXISTING_RUNTIME_JSON" || EXISTING_RUNTIME_JSON='{}'
fi
RUNTIME_JSON=$(jq -n --argjson existing "$EXISTING_RUNTIME_JSON" --arg db "$DATABASE_URL" --arg email "$CAP_ADMIN_EMAIL" --arg pass "$CAP_ADMIN_PASSWORD" '
  ($existing // {})
  | .DATABASE_URL=$db
  | .CAP_ADMIN_EMAIL=$email
  | .CAP_ADMIN_PASSWORD=$pass
  | .CAP_SEND_ENABLED="false"
  | .CAP_SMS_SEND_ENABLED="false"
  | .CAP_ALLOWED_ORIGIN="https://aureum-cap-v0-1.vercel.app"
  | .FRONTEND_ORIGIN="https://aureum-cap-v0-1.vercel.app"
  | .AWS_REGION="eu-north-1"
  | .CAP_S3_BUCKET="aureum-cap-v01-assets-795804715712"
  | .CAP_SQS_QUEUE_URL="https://sqs.eu-north-1.amazonaws.com/795804715712/aureum-cap-v01-lead-processing"
  | .SES_FROM_EMAIL="aureum.cap@cactusdigitalmedia.ng"
  | .SMS_STATUS_CALLBACK_URL="https://api.cactusdigitalmedia.ng/api/v1/webhooks/sms/status"
  | .NODE_ENV="production"
')
if aws secretsmanager describe-secret --region "$REGION" --secret-id "$RUNTIME_SECRET_NAME" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --region "$REGION" --secret-id "$RUNTIME_SECRET_NAME" --secret-string "$RUNTIME_JSON" >/dev/null
else
  aws secretsmanager create-secret --region "$REGION" --name "$RUNTIME_SECRET_NAME" --description 'AUREUM CAP API runtime values; outbound sending remains disabled' --secret-string "$RUNTIME_JSON" >/dev/null
fi
RUNTIME_ARN=$(aws secretsmanager describe-secret --region "$REGION" --secret-id "$RUNTIME_SECRET_NAME" --query ARN --output text)

cat > /tmp/cap-runtime-policy.json <<POLICY
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":"$RUNTIME_ARN"}]}
POLICY
aws iam put-role-policy --role-name aureum-cap-v01-ecs-execution-role --policy-name aureum-cap-v01-runtime-secret-read --policy-document file:///tmp/cap-runtime-policy.json

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
# CloudShell builds on x86_64; use the default x86_64 Fargate runtime to avoid
# requiring QEMU emulation. The task definition intentionally omits a runtime
# platform override, so ECS selects the matching x86_64 platform.
docker build -t "$IMAGE" "$WORKDIR"
docker push "$IMAGE"

cat > /tmp/cap-task-definition.json <<TASK
{"family":"aureum-cap-v01-api","networkMode":"awsvpc","requiresCompatibilities":["FARGATE"],"cpu":"256","memory":"512","executionRoleArn":"$EXEC_ROLE","taskRoleArn":"$TASK_ROLE","containerDefinitions":[{"name":"api","image":"$IMAGE","essential":true,"portMappings":[{"containerPort":8787,"protocol":"tcp"}],"secrets":[{"name":"DATABASE_URL","valueFrom":"$RUNTIME_ARN:DATABASE_URL::"},{"name":"CAP_ADMIN_EMAIL","valueFrom":"$RUNTIME_ARN:CAP_ADMIN_EMAIL::"},{"name":"CAP_ADMIN_PASSWORD","valueFrom":"$RUNTIME_ARN:CAP_ADMIN_PASSWORD::"},{"name":"CAP_SEND_ENABLED","valueFrom":"$RUNTIME_ARN:CAP_SEND_ENABLED::"},{"name":"CAP_SMS_SEND_ENABLED","valueFrom":"$RUNTIME_ARN:CAP_SMS_SEND_ENABLED::"},{"name":"CAP_ALLOWED_ORIGIN","valueFrom":"$RUNTIME_ARN:CAP_ALLOWED_ORIGIN::"},{"name":"FRONTEND_ORIGIN","valueFrom":"$RUNTIME_ARN:FRONTEND_ORIGIN::"},{"name":"AWS_REGION","valueFrom":"$RUNTIME_ARN:AWS_REGION::"},{"name":"CAP_S3_BUCKET","valueFrom":"$RUNTIME_ARN:CAP_S3_BUCKET::"},{"name":"CAP_SQS_QUEUE_URL","valueFrom":"$RUNTIME_ARN:CAP_SQS_QUEUE_URL::"},{"name":"SES_FROM_EMAIL","valueFrom":"$RUNTIME_ARN:SES_FROM_EMAIL::"},{"name":"SMS_STATUS_CALLBACK_URL","valueFrom":"$RUNTIME_ARN:SMS_STATUS_CALLBACK_URL::"},{"name":"TWILIO_ACCOUNT_SID","valueFrom":"$RUNTIME_ARN:TWILIO_ACCOUNT_SID::"},{"name":"TWILIO_AUTH_TOKEN","valueFrom":"$RUNTIME_ARN:TWILIO_AUTH_TOKEN::"},{"name":"TWILIO_FROM_NUMBER","valueFrom":"$RUNTIME_ARN:TWILIO_FROM_NUMBER::"},{"name":"TWILIO_MESSAGING_SERVICE_SID","valueFrom":"$RUNTIME_ARN:TWILIO_MESSAGING_SERVICE_SID::"},{"name":"NODE_ENV","valueFrom":"$RUNTIME_ARN:NODE_ENV::"}],"healthCheck":{"command":["CMD-SHELL","node -e \"fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""],"interval":30,"timeout":5,"retries":3,"startPeriod":20},"logConfiguration":{"logDriver":"awslogs","options":{"awslogs-group":"/ecs/aureum-cap-v01-api","awslogs-region":"eu-north-1","awslogs-stream-prefix":"api"}}}]}
TASK
aws logs create-log-group --region "$REGION" --log-group-name /ecs/aureum-cap-v01-api 2>/dev/null || true
TASK_ARN=$(aws ecs register-task-definition --region "$REGION" --cli-input-json file:///tmp/cap-task-definition.json --query 'taskDefinition.taskDefinitionArn' --output text)
SUBNETS=$(aws ec2 describe-subnets --region "$REGION" --filters Name=vpc-id,Values=vpc-02f0b750c4f333666 --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' --output text | tr '\t' ',')
if aws ecs describe-services --region "$REGION" --cluster "$CLUSTER" --services "$SERVICE" --query 'services[0].serviceName' --output text 2>/dev/null | grep -qx "$SERVICE"; then
  aws ecs update-service --region "$REGION" --cluster "$CLUSTER" --service "$SERVICE" --task-definition "$TASK_ARN" --desired-count 1 --force-new-deployment >/dev/null
else
  aws ecs create-service --region "$REGION" --cluster "$CLUSTER" --service-name "$SERVICE" --task-definition "$TASK_ARN" --desired-count 1 --launch-type FARGATE --platform-version LATEST --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$TASK_SG],assignPublicIp=ENABLED}" --load-balancers "targetGroupArn=$TG_ARN,containerName=api,containerPort=8787" --health-check-grace-period-seconds 60 >/dev/null
fi
aws ecs wait services-stable --region "$REGION" --cluster "$CLUSTER" --services "$SERVICE"
aws ecs describe-services --region "$REGION" --cluster "$CLUSTER" --services "$SERVICE" --query 'services[0].{status:status,running:runningCount,desired:desiredCount,events:events[0:3].message}' --output json
curl -fsS --max-time 20 https://api.cactusdigitalmedia.ng/health
