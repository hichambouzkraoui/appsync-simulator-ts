# AppSync Simulator Starter Kit

![AWS AppSync Simulator](AppSyncSimulator.png)

A starter kit for simulating AWS AppSync locally without Amplify CLI or Serverless framework. Features per-resolver interceptors, flexible Lambda invocation methods, and support for both JavaScript and .NET handlers.

## Features

- **Per-Resolver Interceptors** - Multiple resolvers can share the same Lambda with different request/response transformations
- **Flexible Lambda Invocation** - Direct invocation for JavaScript, AWS SDK v3 for .NET
- **JavaScript/TypeScript Handlers** - Direct in-process invocation or optional AWS SDK v3
- **.NET Lambda Handlers** - AWS SDK v3 invocation to LocalStack or AWS
- **JavaScript Template Interceptors** - VTL replacement using JavaScript
- **Configuration-Based** - All Lambda and resolver configuration in JSON
- **DynamoDB Integration** - Local Docker setup with in-memory fallback

## Quick Start

### Prerequisites

- Node.js v18+
- Docker (for LocalStack or DynamoDB)
- .NET 8.0 SDK (optional, for .NET Lambda development)

### Installation

```bash
npm install
```

### Run the Simulator

```bash
npm run serve
```

Server starts on:
- GraphQL endpoint: http://localhost:4000/graphql
- WebSocket endpoint: ws://localhost:4001

### Test with GraphQL

Open http://localhost:20002/graphql in your browser.

Example queries:
```graphql
# JavaScript Lambda (direct invocation)
query {
  greet(names: ["Alice", "Bob"])
}

# Query with nested resolvers
query {
  authors {
    name
    books {
      title
    }
  }
}

# DynamoDB query (requires DynamoDB running)
query {
  getAge(name: "John")
}
```

## Lambda Handlers

### JavaScript/TypeScript Handlers

**Direct Invocation (Default)**
- In-process function calls
- Fastest execution
- No network overhead

```json
{
  "name": "MyDataSource",
  "type": "javascript",
  "handler": "./lambdas/my-handler",
  "handlerFunction": "handler"
}
```

**AWS SDK Invocation (Optional)**
- Invoke via AWS SDK v3
- Test with LocalStack or AWS

```json
{
  "name": "MyDataSource",
  "type": "javascript",
  "handler": "./lambdas/my-handler",
  "handlerFunction": "handler",
  "lambdaEndpoint": "http://localhost:4566",
  "lambdaRegion": "us-east-1"
}
```

### .NET Lambda Handlers

.NET Lambdas always use AWS SDK v3 invocation (defaults to LocalStack).

**LocalStack (Default)**
```json
{
  "name": "MyDotNetDataSource",
  "type": "dotnet",
  "functionName": "myFunction"
}
```

**Custom Endpoint**
```json
{
  "name": "MyDotNetDataSource",
  "type": "dotnet",
  "functionName": "myFunction",
  "lambdaEndpoint": "https://lambda.us-west-2.amazonaws.com",
  "lambdaRegion": "us-west-2"
}
```

### Invocation Methods Comparison

| Method | Speed | Use Case | Handler Type |
|--------|-------|----------|--------------|
| Direct | Fastest | Local development | JavaScript only |
| AWS SDK | Realistic | LocalStack/AWS testing | JavaScript (optional), .NET (always) |

## Per-Resolver Interceptors

Multiple resolvers can share the same Lambda data source but use different interceptors for request/response transformation.

### Example: Same Lambda, Different Interceptors

```json
{
  "lambdas": [
    {
      "name": "AuthorsDataProvider",
      "type": "javascript",
      "handler": "./lambdas/authors-data-provider"
    }
  ],
  "resolvers": [
    {
      "typeName": "Query",
      "fieldName": "authors",
      "dataSourceName": "AuthorsDataProvider",
      "requestTemplate": "default.js",
      "responseTemplate": "default.js"
    },
    {
      "typeName": "Book",
      "fieldName": "author",
      "dataSourceName": "AuthorsDataProvider",
      "requestTemplate": "books-with-author.js",
      "responseTemplate": "books-with-author.js"
    }
  ]
}
```

### Creating Custom Interceptors

Create a JavaScript file in `src/templates/`:

```javascript
// src/templates/my-interceptor.js
module.exports = {
  request: (ctx) => {
    // Transform request before Lambda invocation
    console.log('Request:', ctx);
    return {
      ...ctx.arguments,
      source: ctx.source,
      identity: ctx.identity
    };
  },
  
  response: (ctx) => {
    // Transform response after Lambda invocation
    console.log('Response:', ctx);
    return ctx.result;
  }
};
```

### Template Path Options

Template paths in resolver configuration support multiple formats:

**Relative filename (default):**
```json
{
  "requestTemplate": "my-interceptor.js",
  "responseTemplate": "my-interceptor.js"
}
```
Resolves to `src/templates/my-interceptor.js`

**Relative path:**
```json
{
  "requestTemplate": "./custom-templates/my-interceptor.js",
  "responseTemplate": "./custom-templates/my-interceptor.js"
}
```
Resolves relative to project root

**Absolute path:**
```json
{
  "requestTemplate": "/absolute/path/to/my-interceptor.js",
  "responseTemplate": "/absolute/path/to/my-interceptor.js"
}
```
Uses the exact path specified

This allows organizing templates in custom directories outside of `src/templates/`.

### Use Cases

- **Validation**: Different validation rules per resolver
- **Transformation**: Custom data transformations per field
- **Nested Resolvers**: Context-aware parent data handling
- **Authorization**: Field-level access control

## Configuration

All configuration is in `src/lambdas-config.json`:

```json
{
  "environment": {
    "AWS_REGION": "us-east-1",
    "ENVIRONMENT": "development"
  },
  "lambdas": [
    {
      "name": "MyDataSource",
      "type": "javascript",
      "handler": "./lambdas/my-handler",
      "handlerFunction": "handler",
      "description": "My Lambda handler",
      "environment": {
        "CUSTOM_VAR": "value"
      }
    }
  ],
  "resolvers": [
    {
      "typeName": "Query",
      "fieldName": "myField",
      "dataSourceName": "MyDataSource",
      "requestTemplate": "default.js",
      "responseTemplate": "default.js"
    }
  ]
}
```

### Configuration Fields

**Lambda Definition:**
- `name` - Data source name
- `type` - "javascript" or "dotnet"
- `handler` - Path to handler file (JavaScript only)
- `handlerFunction` - Function name (JavaScript only)
- `functionName` - Lambda function name (.NET only)
- `lambdaEndpoint` - AWS Lambda endpoint (optional)
- `lambdaRegion` - AWS region (optional)
- `environment` - Environment variables
- `description` - Human-readable description

**Resolver Definition:**
- `typeName` - GraphQL type (e.g., "Query", "Mutation")
- `fieldName` - GraphQL field name
- `dataSourceName` - Lambda data source to use
- `requestTemplate` - Request interceptor file
- `responseTemplate` - Response interceptor file

## Advanced Setup

### Deploy to AWS with CDK

Deploy Lambda functions and DynamoDB to AWS:

```bash
cd cdk
npm install
npx cdk bootstrap  # First time only
npx cdk deploy
npm run seed       # Seed DynamoDB data
```

See [cdk/README.md](cdk/README.md) for detailed deployment instructions.

### Deploy to LocalStack with CDK

Deploy to LocalStack for local testing:

```bash
# Terminal 1 - Start LocalStack with Docker socket mounted
docker run -d \
  -p 4566:4566 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --name localstack \
  localstack/localstack

# Terminal 2 - Deploy with cdklocal (runs on host, NOT in Docker)
cd cdk
npm install
npm install -g aws-cdk-local  # Installs Node.js CLI on host
cdklocal bootstrap            # Runs on host
cdklocal deploy               # Runs on host
AWS_ENDPOINT=http://localhost:4566 npm run seed

# Terminal 3 - Start simulator
cd ..
npm run serve
```

**Important:** LocalStack needs Docker socket mounted (`-v /var/run/docker.sock:/var/run/docker.sock`) to create Lambda functions in Docker containers.

**Note:** `cdklocal` is a Node.js CLI tool that runs on your host machine. It's just a wrapper around `cdk` that sets LocalStack endpoints. Only LocalStack itself runs in Docker.

### With LocalStack (.NET Lambdas)

Terminal 1 - Start LocalStack:
```bash
docker run -p 4566:4566 localstack/localstack
```

Terminal 2 - Deploy .NET Lambdas:
```bash
cd dotnet-lambdas/Calculator
dotnet lambda deploy-function --function-name calculator --region us-east-1
```

Terminal 3 - Start simulator:
```bash
npm run serve
```

### With DynamoDB

Terminal 1 - Start DynamoDB:
```bash
npm run dynamodb:start
npm run dynamodb:seed
```

Terminal 2 - Start simulator:
```bash
npm run serve
```

## Project Structure

```
.
├── src/
│   ├── lambdas/              # Lambda handler implementations
│   ├── templates/            # Interceptor templates
│   ├── interceptors/         # Interceptor framework
│   ├── utils/                # Utility functions
│   ├── types/                # TypeScript type definitions
│   ├── vtl/                  # VTL templates (fallback)
│   ├── lambdas-config.json   # Lambda and resolver configuration
│   ├── schema.gql            # GraphQL schema
│   └── main.ts               # Simulator entry point
├── dotnet-lambdas/           # .NET Lambda examples
├── scripts/                  # Utility scripts
└── package.json
```

## Architecture

### Request Flow

```
GraphQL Query
    ↓
AppSync Simulator
    ↓
Resolver Configuration
    ↓
Request Interceptor (JavaScript template)
    ↓
Lambda Handler (JavaScript direct OR AWS SDK)
    ↓
Response Interceptor (JavaScript template)
    ↓
GraphQL Response
```

### Data Source Creation

The simulator creates two types of data sources:

1. **Base Data Sources** - One per Lambda (without interceptors)
2. **Resolver-Specific Data Sources** - One per resolver (with interceptors)

Naming pattern: `{LambdaName}_{TypeName}_{FieldName}`

Example:
- Base: `AuthorsDataProvider`
- Resolver-specific: `AuthorsDataProvider_Query_authors`

## Development

### Adding a New Lambda Handler

1. Create handler file in `src/lambdas/`:
```typescript
// src/lambdas/my-handler.ts
export const handler = async (event: any) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello' })
  };
};
```

2. Add to `src/lambdas-config.json`:
```json
{
  "name": "MyDataSource",
  "type": "javascript",
  "handler": "./lambdas/my-handler",
  "handlerFunction": "handler"
}
```

3. Add resolver:
```json
{
  "typeName": "Query",
  "fieldName": "myField",
  "dataSourceName": "MyDataSource",
  "requestTemplate": "default.js",
  "responseTemplate": "default.js"
}
```

4. Update GraphQL schema in `src/schema.gql`

### Creating Custom Interceptors

1. Create template file in `src/templates/`:
```javascript
module.exports = {
  request: (ctx) => {
    // Transform request
    return ctx.arguments;
  },
  response: (ctx) => {
    // Transform response
    return ctx.result;
  }
};
```

2. Reference in resolver configuration:
```json
{
  "requestTemplate": "my-interceptor.js",
  "responseTemplate": "my-interceptor.js"
}
```

## Troubleshooting

### Port Already in Use

Kill processes on ports 4000 and 4001:
```bash
lsof -ti:4000 | xargs kill -9
lsof -ti:4001 | xargs kill -9
```

### .NET Lambda Not Found

Ensure Lambda is deployed to LocalStack:
```bash
aws --endpoint-url=http://localhost:4566 lambda list-functions
```

### DynamoDB Connection Error

Check DynamoDB is running:
```bash
docker ps | grep dynamodb
```

Start if not running:
```bash
npm run dynamodb:start
```

## Examples

### Example 1: Simple Query

```graphql
query {
  greet(names: ["Alice", "Bob"])
}
```

### Example 2: Nested Query with Interceptors

```graphql
query {
  authors {
    name
    books {
      title
      author {
        name
      }
    }
  }
}
```

### Example 3: DynamoDB Query

```graphql
query {
  getAge(name: "John")
}
```

## Scripts

- `npm run serve` - Start the simulator
- `npm run dynamodb:start` - Start DynamoDB in Docker
- `npm run dynamodb:stop` - Stop DynamoDB
- `npm run dynamodb:seed` - Seed DynamoDB with test data
- `npm run dotnet:serve` - Start .NET GraphQL server (legacy)
- `npm run dev` - Start both .NET server and simulator (legacy)

## License

ISC

## Contributing

Contributions welcome! Please open an issue or PR.

## Resources

- [AWS AppSync](https://aws.amazon.com/appsync/)
- [amplify-appsync-simulator](https://github.com/aws-amplify/amplify-cli/tree/master/packages/amplify-appsync-simulator)
- [LocalStack](https://localstack.cloud/)
- [GraphQL](https://graphql.org/)
