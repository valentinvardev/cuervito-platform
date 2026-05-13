# Cuervito · Photo processor Lambda

S3-triggered AWS Lambda that runs **OCR + Rekognition face indexing** on every
photo uploaded under `cuervito/users/.../events/.../original/...` in the
`mediaseller-photos` bucket.

Coexists with the legacy SINCHI processor — the SINCHI Lambda watches
`uploads/...`, this one watches `cuervito/...`. Both can run on the same bucket
simultaneously.

---

## 1. Prereqs

You need:

- AWS CLI configured locally with credentials that can:
  - `lambda:CreateFunction` / `lambda:UpdateFunctionCode`
  - `iam:CreateRole` / `iam:AttachRolePolicy` (first deploy only)
  - `s3:PutBucketNotificationConfiguration` on `mediaseller-photos`
- Node 20+
- The Cuervito Postgres connection string (the one in `cuervito/.env`)

Set environment variables in your shell:

```bash
export AWS_REGION=us-east-2
export DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=20"
```

> ⚠️ The Lambda runs in `us-east-2` (Ohio) but the DB pooler is in
> `us-west-2`. That cross-region traffic adds ~50–100ms of latency per request
> but works fine. To remove that latency later, move the Supabase project to a
> US-East region or use Supabase Edge.

---

## 2. Install deps + generate Prisma client

```bash
cd cuervito/lambda
npm install
npm run prisma:generate
```

This generates the Prisma client at `lambda/generated/prisma/` with the
`rhel-openssl-3.0.x` binary target (what AWS Lambda Node 20 runs on).

---

## 3. Create the IAM role (first time only)

The Lambda needs a role that can:

- Read from S3 (`s3:GetObject` on `arn:aws:s3:::mediaseller-photos/cuervito/*`)
- Use Rekognition (`rekognition:*` on its own resources)
- Write CloudWatch logs

**Option A — reuse SINCHI's existing role**:

If you trust that role and the SINCHI Lambda already has the right permissions
(it does for S3 + Rekognition + logs), you can reuse it:

```bash
export LAMBDA_ROLE_ARN=$(aws iam get-role --role-name <SINCHI_LAMBDA_ROLE_NAME> --query Role.Arn --output text)
```

**Option B — create a new role** specifically for Cuervito (recommended for
isolation):

```bash
# 1. Trust policy: Lambda service can assume the role
cat > /tmp/trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

# 2. Create the role
aws iam create-role \
  --role-name cuervito-lambda-role \
  --assume-role-policy-document file:///tmp/trust.json

# 3. Attach the basic execution policy (CloudWatch logs)
aws iam attach-role-policy \
  --role-name cuervito-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 4. Inline policy for S3 + Rekognition
cat > /tmp/permissions.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::mediaseller-photos/cuervito/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectText",
        "rekognition:IndexFaces",
        "rekognition:CreateCollection",
        "rekognition:DescribeCollection",
        "rekognition:SearchFacesByImage",
        "rekognition:ListFaces"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name cuervito-lambda-role \
  --policy-name cuervito-s3-rekognition \
  --policy-document file:///tmp/permissions.json

export LAMBDA_ROLE_ARN=$(aws iam get-role --role-name cuervito-lambda-role --query Role.Arn --output text)
echo $LAMBDA_ROLE_ARN
```

---

## 4. Bundle + deploy

### First time (create the function)

```bash
cd cuervito/lambda
npm run deploy:create
```

This:

1. Generates the Prisma client with the Linux engine
2. Compiles TS → `dist/`
3. Stages everything in `build/` (handler + generated Prisma + minimal runtime `node_modules`)
4. Zips `build/` → `function.zip`
5. Creates the `cuervito-photo-processor` Lambda with:

- Runtime: `nodejs20.x`
- Timeout: 60s
- Memory: 1024 MB
- Env: `DATABASE_URL`, `AWS_REGION`

### Subsequent deploys (code-only update)

```bash
cd cuervito/lambda
npm run deploy
```

---

## 5. Wire the S3 trigger

After the Lambda exists, give S3 permission to invoke it and configure the
notification.

```bash
# Grant the bucket permission to invoke the Lambda
aws lambda add-permission \
  --function-name cuervito-photo-processor \
  --statement-id allow-s3-cuervito-prefix \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::mediaseller-photos \
  --source-account $(aws sts get-caller-identity --query Account --output text)
```

Now configure the bucket notification. **⚠️ This call REPLACES all
existing notifications on the bucket** — you must keep SINCHI's trigger if it
exists. Fetch the current config first:

```bash
aws s3api get-bucket-notification-configuration \
  --bucket mediaseller-photos > /tmp/current-notif.json
cat /tmp/current-notif.json
```

Then build a merged config. If SINCHI's existing trigger looks like:

```json
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "sinchi-uploads",
      "LambdaFunctionArn": "arn:aws:lambda:us-east-2:ACCOUNT:function:mediaseller-photo-processor",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": { "Key": { "FilterRules": [{ "Name": "prefix", "Value": "uploads/" }] } }
    }
  ]
}
```

The merged config should be:

```json
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "sinchi-uploads",
      "LambdaFunctionArn": "arn:aws:lambda:us-east-2:ACCOUNT:function:mediaseller-photo-processor",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": { "Key": { "FilterRules": [{ "Name": "prefix", "Value": "uploads/" }] } }
    },
    {
      "Id": "cuervito-photos",
      "LambdaFunctionArn": "arn:aws:lambda:us-east-2:ACCOUNT:function:cuervito-photo-processor",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            { "Name": "prefix", "Value": "cuervito/" },
            { "Name": "suffix", "Value": ".jpg" }
          ]
        }
      }
    }
  ]
}
```

> Replace `ACCOUNT` with your real AWS account ID.
> Add a separate config for each suffix (.jpg, .jpeg, .png, .webp) — S3 doesn't
> support OR'ing suffix rules. Or just match on prefix without a suffix filter.

Save to `/tmp/merged-notif.json` and apply:

```bash
aws s3api put-bucket-notification-configuration \
  --bucket mediaseller-photos \
  --notification-configuration file:///tmp/merged-notif.json
```

---

## 6. Test

Upload a photo through `localhost:3000` (or directly to S3). Within a few
seconds:

- Check CloudWatch logs:
  ```bash
  aws logs tail /aws/lambda/cuervito-photo-processor --follow
  ```
- In Supabase, the `Photo` row should now have:
  - `bibNumbers` populated (if a number was visible)
  - `ocrProcessedAt` and `faceProcessedAt` set
- `FaceRecord` rows should exist for each detected face
- `RecognitionUsage` for the current month should be incremented

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Lambda invokes but logs `photo not found in DB` | The presign endpoint hasn't created the Photo row yet (race condition). The Lambda has automatic retries — it should succeed on retry. |
| `Access denied` on S3 GetObject | IAM role missing `s3:GetObject` on `cuervito/*`. |
| `Access denied` on Rekognition | IAM role missing Rekognition policy. |
| Lambda times out | Bump `--timeout 90` or `--memory-size 1536`. |
| `Can't reach database` | DB connection string wrong, or Supabase free tier paused the project. |
| Cross-region warning | Cuervito DB is in `us-west-2`, Lambda in `us-east-2` — extra latency but works. |
