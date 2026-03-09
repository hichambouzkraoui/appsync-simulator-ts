# CDK Deployment Guide

Quick guide to deploy Lambda functions and DynamoDB to AWS or LocalStack.

## Architecture Overview

**LocalStack Deployment:**
- LocalStack runs in Docker (provides AWS services locally)
- `cdklocal` runs on your host BUT uses Docker for Lambda bundling
- CDK's NodejsFunction construct uses Docker/esbuild to bundle Lambda code
- Your code is bundled in Docker, then deployed to LocalStack via HTTP

**Why Docker is used:**
- `NodejsFunction` construct bundles TypeScript → JavaScript using esbuild
- esbuild runs in a Docker container for consistent builds
- This is CDK's default behavior, not specific to LocalStack

**AWS Deployment:**
- Standard CDK deployment to real AWS
- Also uses Docker for Lambda bundling (same as LocalStack)

## Quick Start - LocalStack

**Important:** LocalStack requires Docker socket access to create Lambda functions.

```bash
# 1. Start LocalStack with Docker socket mounted
docker run -d \
  -p 4566:4566 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --name localstack \
  localstack/localstack

# 2. Install cdklocal (first time only)
npm install -g aws-cdk-local aws-cdk

# 3. Deploy
cd cdk
npm install
cdklocal bootstrap
cdklocal deploy

# 4. Seed DynamoDB
npm run seed

# 5. Update Lambda config for LocalStack
# Edit ../src/lambdas-config.json and add to each Lambda:
#   "lambdaEndpoint": "http://localhost:4566",
#   "lambdaRegion": "us-east-1"

# 6. Start simulator
cd ..
npm run serve
```

**Why Docker socket is needed:**
- LocalStack creates Lambda functions as Docker containers
- CDK bundles TypeScript code using Docker (esbuild)
- Mounting `/var/run/docker.sock` gives LocalStack access to Docker daemon

**Note:** `cdklocal` runs on your host and wraps `cdk` with LocalStack endpoints.

## Quick Start - AWS

```bash
# 1. Configure AWS credentials
aws configure

# 2. Deploy
cd cdk
npm install
npx cdk bootstrap  # First time only
npx cdk deploy

# 3. Seed data
npm run seed

# 4. Start simulator
cd ..
npm run serve
```

## What Gets Deployed

### Lambda Functions (4)
1. **AuthorsDataProvider** - Returns author data
2. **BooksDataProvider** - Returns book data  
3. **GreetDataSource** - Greets names
4. **GetAgeDataSource** - Queries DynamoDB for age by name

### DynamoDB Table (1)
- **People** table with partition key `name`

## Configuration

### Lambda Configuration for AWS SDK Invocation

After deployment, update `src/lambdas-config.json`:

**For LocalStack:**
```json
{
  "name": "AuthorsDataProvider",
  "type": "javascript",
  "handler": "./lambdas/authors-data-provider",
  "handlerFunction": "handler",
  "lambdaEndpoint": "http://localhost:4566",
  "lambdaRegion": "us-east-1"
}
```

**For AWS:**
```json
{
  "name": "AuthorsDataProvider",
  "type": "javascript",
  "handler": "./lambdas/authors-data-provider",
  "handlerFunction": "handler",
  "lambdaEndpoint": "",
  "lambdaRegion": "us-east-1"
}
```

## Alternative: Use CDK Without cdklocal

You don't need `cdklocal` - you can use regular `cdk` with environment variables:

```bash
# Start LocalStack
docker run -d -p 4566:4566 --name localstack localstack/localstack

# Configure environment for LocalStack
export CDK_DEFAULT_ACCOUNT=000000000000
export CDK_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_ENDPOINT_URL=http://localhost:4566

# Deploy with regular CDK
cd cdk
npm install
npx cdk bootstrap
npx cdk deploy

# Seed data
AWS_ENDPOINT=http://localhost:4566 npm run seed
```

This approach uses standard CDK without any additional tools.

## Verification

### Check Lambda Functions

**LocalStack:**
```bash
aws --endpoint-url=http://localhost:4566 lambda list-functions
```

**AWS:**
```bash
aws lambda list-functions
```

### Check DynamoDB Table

**LocalStack:**
```bash
aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name People
```

**AWS:**
```bash
aws dynamodb scan --table-name People
```

### Test Lambda Invocation

**LocalStack:**
```bash
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name AuthorsDataProvider \
  --payload '{}' \
  response.json
cat response.json
```

**AWS:**
```bash
aws lambda invoke \
  --function-name AuthorsDataProvider \
  --payload '{}' \
  response.json
cat response.json
```

## Troubleshooting

### What is cdklocal?

`cdklocal` is a thin Node.js wrapper around the AWS CDK CLI that:
- Sets environment variables to point to LocalStack
- Runs on your host machine
- Uses Docker for Lambda bundling (via CDK's NodejsFunction)

**What cdklocal does:**
```bash
# cdklocal bootstrap
# Is equivalent to:
AWS_ENDPOINT_URL=http://localhost:4566 \
AWS_ACCESS_KEY_ID=test \
AWS_SECRET_ACCESS_KEY=test \
npx cdk bootstrap
```

**Why you see Docker:**
- CDK's `NodejsFunction` construct uses Docker to bundle TypeScript code
- This happens with both `cdk` and `cdklocal`
- Docker is used for esbuild bundling, not for running cdklocal itself
- You'll see messages like "writing image sha256:..." - this is normal

### CDK Bootstrap Failed

**LocalStack:**
```bash
# Make sure LocalStack is running
curl http://localhost:4566/_localstack/health

# Try with force flag
cdklocal bootstrap --force

# Or use regular cdk with env vars
AWS_ENDPOINT_URL=http://localhost:4566 npx cdk bootstrap --force
```

**AWS:**
```bash
npx cdk bootstrap --force
```

### Lambda Deployment Failed

- Check that Lambda handler files exist in `../src/lambdas/`
- Verify TypeScript compiles: `npm run build`
- Check CDK logs: `npx cdk deploy --verbose`
- For LocalStack, verify it's running: `docker ps | grep localstack`

### DynamoDB Seed Failed

**LocalStack:**
```bash
# Verify table exists
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# Check LocalStack logs
docker logs localstack

# Try seed with explicit endpoint
AWS_ENDPOINT=http://localhost:4566 npm run seed
```

**AWS:**
```bash
# Verify table exists
aws dynamodb list-tables

# Check AWS credentials
aws sts get-caller-identity

# Try seed
npm run seed
```

### Simulator Can't Connect to Lambda

**LocalStack:**
```bash
# Verify Lambda is deployed
aws --endpoint-url=http://localhost:4566 lambda list-functions

# Check LocalStack health
curl http://localhost:4566/_localstack/health

# Verify config has correct endpoint
grep lambdaEndpoint ../src/lambdas-config.json
```

**AWS:**
```bash
# Verify Lambda is deployed
aws lambda list-functions

# Check AWS credentials
aws sts get-caller-identity

# Verify config
grep lambdaEndpoint ../src/lambdas-config.json
```

## Cleanup

### Remove All Resources

**LocalStack:**
```bash
# Option 1: Destroy stack
cdklocal destroy

# Option 2: Just stop/remove container
docker stop localstack
docker rm localstack
```

**AWS:**
```bash
npx cdk destroy
```

## Cost Estimate (AWS)

Development usage (100 requests/day):
- Lambda: ~$0.00 (within free tier)
- DynamoDB: ~$0.25/month (on-demand)
- Total: < $1/month

Production usage will vary based on traffic.

## Next Steps

1. Deploy to LocalStack for local testing
2. Test with AppSync Simulator
3. Deploy to AWS for production
4. Set up CI/CD pipeline
5. Add monitoring and logging
