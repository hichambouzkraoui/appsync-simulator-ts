# .NET Greeting Lambda

A .NET 8 Lambda function that greets a list of names.

## Prerequisites

- .NET 8 SDK
- AWS Lambda Test Tool: `dotnet tool install -g Amazon.Lambda.TestTool-8.0`

## Build

```bash
cd dotnet-lambdas/Greeting
dotnet build
```

## Test Locally

The Lambda is automatically invoked by the AppSync simulator through the dotnet-lambda-test-tool-8.0.

## Input Format

```json
{
  "Names": ["John", "Jane", "Bob"]
}
```

## Output Format

```json
{
  "Greetings": [
    "Hello JOHN from .NET!",
    "Hello JANE from .NET!",
    "Hello BOB from .NET!"
  ]
}
```

## GraphQL Query

```graphql
query {
  greetDotNet(names: ["John", "Jane", "Bob"])
}
```
