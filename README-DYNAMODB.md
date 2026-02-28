# DynamoDB Local Setup

This project includes a local DynamoDB setup for development and testing.

## Default Behavior

By default, the `getAge` Lambda uses **in-memory fallback data** to avoid DynamoDB connection issues. This allows you to test the Lambda immediately without setting up DynamoDB.

## Using DynamoDB Local (Optional)

If you want to use actual DynamoDB Local instead of the in-memory fallback:

1. Install dependencies:
```bash
npm install
```

2. Start DynamoDB Local:
```bash
npm run dynamodb:start
```

3. Seed the database with test data:
```bash
npm run dynamodb:seed
```

4. Update `src/lambdas-config.json` to enable DynamoDB:
```json
{
  "environment": {
    "DYNAMODB_ENDPOINT": "http://127.0.0.1:8000",
    "TABLE_NAME": "People"
  }
}
```

5. Restart the AppSync simulator:
```bash
npm run serve
```

## Services

- **DynamoDB Local**: http://localhost:8000
- **DynamoDB Admin UI**: http://localhost:8001
- **AppSync GraphQL**: http://localhost:4000/graphql

## Test Data

The seed script creates a `People` table with the following records:

| Name    | Age |
|---------|-----|
| John    | 30  |
| Jane    | 25  |
| Bob     | 45  |
| Alice   | 28  |
| Charlie | 35  |
| Diana   | 32  |
| Eve     | 29  |
| Frank   | 41  |

## GraphQL Query Example

```graphql
query {
  getAge(name: "John")
}
```

Returns: `30`

## Stopping DynamoDB

```bash
npm run dynamodb:stop
```

## Environment Variables

The Lambda function uses these environment variables (configured in `lambdas-config.json`):

- `DYNAMODB_ENDPOINT`: http://localhost:8000
- `TABLE_NAME`: People
- `AWS_REGION`: us-east-1

## Troubleshooting

If the seed script fails, make sure:
1. Docker is running
2. DynamoDB Local is started (`npm run dynamodb:start`)
3. Wait a few seconds after starting DynamoDB before seeding
