# CDK Deployment for AppSync Simulator

This CDK project deploys the Lambda functions and DynamoDB table to AWS or LocalStack.

## Prerequisites

- AWS CDK CLI installed: `npm install -g aws-cdk`
- AWS credentials configured
- Node.js 18+

## What Gets Deployed

### Lambda Functions
- **AuthorsDataProvider** - Provides author data
- **BooksDataProvider** - Provides book data
- **GreetDataSource** - Greets a list of names
- **GetAgeDataSource** - Gets age from DynamoDB by name

### DynamoDB Table
- **People** - Table with partition key `name` (String)

## Deployment

### Deploy to AWS

```bash
cd cdk
npm install
npx cdk bootstrap  # First time only
npx cdk deploy
```

### Deploy to LocalStack

```bash
# Start LocalStack
docker run -p 4566:4566 localstack/localstack

# Deploy to LocalStack
cd cdk
npm install
cdklocal bootstrap  # First time only
cdklocal deploy
```

Note: Install `cdklocal` with: `npm install -g aws-cdk-local`

## Useful Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm run test` - Run unit tests
- `npx cdk deploy` - Deploy stack to AWS
- `npx cdk diff` - Compare deployed stack with current state
- `npx cdk synth` - Emit synthesized CloudFormation template
- `npx cdk destroy` - Remove all deployed resources

## Stack Outputs

After deployment, you'll see outputs including:
- Lambda Function ARNs
- DynamoDB Table Name and ARN

## Seed DynamoDB Data

After deployment, seed the DynamoDB table:

```bash
# For AWS
cd ..
npm run dynamodb:seed

# For LocalStack
AWS_ENDPOINT=http://localhost:4566 npm run dynamodb:seed
```

## Using with AppSync Simulator

After deploying to LocalStack, update `src/lambdas-config.json` to use AWS SDK invocation:

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

Then start the simulator:

```bash
npm run serve
```

## Cost Considerations

When deploying to AWS:
- Lambda: Pay per invocation (free tier: 1M requests/month)
- DynamoDB: On-demand billing (pay per request)
- Estimated cost for development: < $1/month

## Cleanup

To remove all deployed resources:

```bash
cd cdk
npx cdk destroy
```

Or for LocalStack:

```bash
cdklocal destroy
```
