# .NET Greeting Lambda

A .NET 8 Lambda function that greets a list of names.

## Prerequisites

- .NET 8 SDK
- AWS SAM CLI: `brew install aws-sam-cli` (macOS) or see [installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Docker (required by SAM CLI for local invocation)

## Build

```bash
cd dotnet-lambdas/Greeting
dotnet build
```

## Test Locally with SAM CLI

```bash
cd dotnet-lambdas/Greeting
sam local invoke GreetingFunction --event event.json
```

Example `event.json`:
```json
{
  "Names": ["John", "Jane", "Bob"]
}
```

## Expected Output

```json
{
  "Greetings": [
    "Hello JOHN from .NET!",
    "Hello JANE from .NET!",
    "Hello BOB from .NET!"
  }
}
```

## GraphQL Query

The Lambda is automatically invoked via SAM CLI when you query through AppSync:

```bash
npm run serve
```

Query:
```graphql
query {
  greetDotNet(names: ["John", "Jane", "Bob"])
}
```

## How It Works

The AppSync simulator uses `sam local invoke` to execute the .NET Lambda function. This provides a reliable local testing environment that closely mimics AWS Lambda behavior.
