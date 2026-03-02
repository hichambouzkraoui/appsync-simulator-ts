# Calculator Lambda

A simple .NET Lambda function that performs basic arithmetic operations.

## Integration Steps Taken

This Lambda demonstrates how easy it is to add new .NET functions:

1. ✅ Created `Calculator/Function.cs` with `FunctionHandler` method
2. ✅ Created `Calculator/Calculator.csproj` 
3. ✅ Added project reference to `dotnet-server/DotNetGraphQL.csproj`
4. ✅ Restarted the .NET server
5. ✅ **That's it!** The server auto-discovered the Lambda

**No changes needed to:**
- ❌ Query.cs (no switch statement updates)
- ❌ Program.cs (no registration code)
- ❌ dotnetHandler.ts (no TypeScript changes)

## Operations Supported

- `add` or `+` - Addition
- `subtract` or `-` - Subtraction
- `multiply` or `*` - Multiplication
- `divide` or `/` - Division

## Example Usage

### Direct GraphQL Query (to .NET server)

```bash
curl -X POST http://127.0.0.1:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { invokeLambda(functionName: \"Calculator\", payload: \"{\\\"A\\\":10,\\\"B\\\":5,\\\"Operation\\\":\\\"add\\\"}\") }"}'
```

Response:
```json
{
  "data": {
    "invokeLambda": "{\"Result\":15,\"Operation\":\"add\",\"Expression\":\"10 add 5 = 15\"}"
  }
}
```

### Through AppSync Simulator

Once you add the GraphQL schema and resolver config, you can query:

```graphql
query {
  calculate(a: 10, b: 5, operation: "add") {
    result
    operation
    expression
  }
}
```

Response:
```json
{
  "data": {
    "calculate": {
      "result": 15,
      "operation": "add",
      "expression": "10 add 5 = 15"
    }
  }
}
```

## Server Logs

When the server starts, you'll see:

```
[.NET Server] Discovering Lambda functions...
[.NET Server] Scanning assembly: Calculator
[.NET Server] ✓ Registered Lambda: Calculator (Calculator.Function)
[.NET Server] Total Lambda functions registered: 2
```

When invoked:
```
[.NET Server] Invoking Lambda: Calculator
[.NET Server] Payload: {"A":10,"B":5,"Operation":"add"}
Calculator Lambda invoked: 10 add 5
Result: 10 add 5 = 15
```
