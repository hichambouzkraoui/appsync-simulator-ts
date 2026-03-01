# .NET Greeting Lambda (Optional)

A .NET 8 Lambda function that greets a list of names.

## Note

The .NET Lambda integration is currently experiencing issues with the Lambda Test Tool in non-interactive mode. The TypeScript/JavaScript `greet` Lambda provides the same functionality and works reliably.

## Prerequisites

- .NET 8 SDK
- AWS Lambda Test Tool: `dotnet tool install -g Amazon.Lambda.TestTool-8.0`

## Build

```bash
cd dotnet-lambdas/Greeting
dotnet build
```

## Manual Testing

You can test the Lambda function manually using the Lambda Test Tool UI:

```bash
cd dotnet-lambdas/Greeting
dotnet lambda-test-tool-8.0
```

Then open the browser UI and test with:

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
  ]
}
```

## Known Issues

The Lambda Test Tool has issues running in `--no-ui` mode when spawned as a child process. This is a limitation of the tool itself. For production use, consider:

1. Using the JavaScript/TypeScript Lambda functions (fully supported)
2. Running the Lambda Test Tool as a standalone HTTP server
3. Deploying to actual AWS Lambda where this issue doesn't occur
