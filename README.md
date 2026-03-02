# AppSync Simulator starter kit
![AWS AppSync Simulator](AppSyncSimulator.png)

This repository is a starter kit which shows how to simulate AppSync locally when you are not using Amplify CLI or Serverless framework.

## Description
This example shows how to setup the simulator with Lambda data sources. Of course, you can use it with DynamoDB and OpenSearch datasources.
I'm as well using only "unit" resolvers but you can use "pipeline" resolvers.

## Features
- JavaScript/TypeScript Lambda data sources
- .NET Lambda support via Hot Chocolate GraphQL server
- JavaScript template interceptors (VTL replacement)
- Configuration-based Lambda loading
- DynamoDB integration with local Docker setup
- In-memory fallback for DynamoDB

## Getting Started

### Prerequisites
- Node.js v18+
- .NET 8.0 SDK (for .NET Lambda support)
- Docker (for local DynamoDB)

### Installation
```bash
npm install
```

### Running the Simulator

#### Option 1: JavaScript/TypeScript Lambdas Only
```bash
npm run serve
```

#### Option 2: With .NET Lambda Support
You need to run two processes:

Terminal 1 - Start the .NET GraphQL server:
```bash
npm run dotnet:serve
```

Terminal 2 - Start the AppSync simulator:
```bash
npm run serve
```

The .NET server runs on port 5001 and provides a Hot Chocolate GraphQL endpoint.

#### Option 3: With DynamoDB
Terminal 1 - Start DynamoDB:
```bash
npm run dynamodb:start
npm run dynamodb:seed
```

Terminal 2 - Start the simulator:
```bash
npm run serve
```

### Testing
Open http://localhost:20002/graphql in your browser to access the GraphQL playground.

Example queries:
```graphql
# JavaScript Lambda
query {
  greet(names: ["Alice", "Bob"])
}

# .NET Lambda (requires dotnet:serve to be running)
query {
  greetDotNet(names: ["Alice", "Bob"])
}

# DynamoDB query
query {
  getAge(name: "John")
}
```