# .NET Lambda Integration Guide

This project demonstrates a truly generic approach to integrating .NET Lambda functions with an AppSync simulator using Hot Chocolate GraphQL server.

## Architecture Overview

```
AppSync Simulator (TypeScript)
  ↓
dotnetHandler.ts (HTTP GraphQL client)
  ↓
Hot Chocolate Server (port 5001)
  ↓
Query.cs (Auto-discovery + Reflection)
  ↓
Your .NET Lambda Functions
```

## Key Features

### 1. Auto-Discovery
The server automatically discovers Lambda functions at startup by:
- Scanning all loaded assemblies
- Finding classes with `FunctionHandler` methods
- Registering them by namespace

### 2. Dynamic Invocation
Uses reflection to:
- Deserialize JSON payloads to the correct request types
- Invoke the appropriate Lambda function
- Serialize responses back to JSON

### 3. Zero Boilerplate
Adding a new Lambda requires:
- ✅ Create the Lambda function
- ✅ Add project reference
- ✅ Restart server
- ❌ No code changes to Query.cs
- ❌ No code changes to handlers

## Current Lambda Functions

### 1. Greeting Lambda
- **Namespace**: `Greeting`
- **Function**: Greets a list of names
- **Location**: `dotnet-lambdas/Greeting/`

Example:
```graphql
query {
  greetDotNet(names: ["Alice", "Bob"])
}
```

### 2. Calculator Lambda
- **Namespace**: `Calculator`
- **Function**: Performs arithmetic operations
- **Location**: `dotnet-lambdas/Calculator/`

Example:
```graphql
query {
  calculate(a: 10, b: 5, operation: "add") {
    result
    operation
    expression
  }
}
```

## Adding a New Lambda

### Step 1: Create Lambda Function

```csharp
// dotnet-lambdas/MyFunction/Function.cs
using Amazon.Lambda.Core;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace MyFunction;

public class Function
{
    public class MyRequest
    {
        public string? Input { get; set; }
    }

    public class MyResponse
    {
        public string? Output { get; set; }
    }

    public MyResponse FunctionHandler(MyRequest input, ILambdaContext context)
    {
        return new MyResponse { Output = $"Processed: {input.Input}" };
    }
}
```

### Step 2: Add Project Reference

Edit `dotnet-server/DotNetGraphQL.csproj`:

```xml
<ItemGroup>
  <ProjectReference Include="../dotnet-lambdas/MyFunction/MyFunction.csproj" />
</ItemGroup>
```

### Step 3: Restart Server

```bash
# Terminal 1
npm run dotnet:serve

# You'll see:
# [.NET Server] ✓ Registered Lambda: MyFunction (MyFunction.Function)
```

### Step 4: Configure AppSync Integration

Add to `src/lambdas-config.json`:

```json
{
  "name": "MyFunctionDataSource",
  "type": "dotnet",
  "endpoint": "http://localhost:5001/graphql",
  "functionName": "myfunction",
  "description": "My custom Lambda"
}
```

Add GraphQL schema to `src/schema.gql`:

```graphql
type Query {
  myQuery(input: String!): String
}
```

Create template `src/templates/myfunction.js`:

```javascript
import { util } from "@aws-appsync/utils";

export function request(ctx) {
    return {
        operation: 'Invoke',
        payload: { Input: ctx.arguments.input }
    };
}

export function response(ctx) {
    const { result, error } = ctx;
    if (error) util.error(error.message, error.type, result);
    return result.Output;
}
```

Add resolver to `src/lambdas-config.json`:

```json
{
  "typeName": "Query",
  "fieldName": "myQuery",
  "dataSourceName": "MyFunctionDataSource",
  "requestTemplate": "myfunction.js",
  "responseTemplate": "myfunction.js"
}
```

## Running the System

### Start Both Servers

```bash
# Terminal 1 - .NET GraphQL Server
npm run dotnet:serve

# Terminal 2 - AppSync Simulator
npm run serve
```

### Test Endpoints

- AppSync Simulator: http://localhost:4000/graphql
- .NET GraphQL Server: http://localhost:5001/graphql
- Banana Cake Pop UI: http://localhost:5001/graphql

## How It Works

### Auto-Discovery Process

1. Server starts and calls `LoadReferencedAssemblies()`
2. Scans all assemblies in the application domain
3. For each assembly, looks for classes with `FunctionHandler` method
4. Creates instance and stores in registry with namespace as key

### Invocation Process

1. GraphQL query arrives: `invokeLambda(functionName: "Calculator", payload: "...")`
2. Looks up function in registry by name (case-insensitive)
3. Uses reflection to get request parameter type
4. Deserializes JSON payload to that type
5. Invokes `FunctionHandler` with deserialized request
6. Serializes response back to JSON
7. Returns to caller

## Benefits

- **Scalable**: Add unlimited Lambdas without code changes
- **Type-Safe**: Uses actual Lambda types via reflection
- **Maintainable**: No switch statements or manual routing
- **Discoverable**: Server logs show all registered functions
- **Flexible**: Works with any Lambda signature

## Troubleshooting

### Lambda Not Discovered

Check server logs for:
```
[.NET Server] Scanning assembly: YourLambda
[.NET Server] ✓ Registered Lambda: YourLambda (YourLambda.Function)
```

If not found:
1. Verify project reference in `DotNetGraphQL.csproj`
2. Ensure Lambda has `FunctionHandler` method
3. Restart the .NET server

### Connection Refused

If you see `ECONNREFUSED`:
1. Ensure .NET server is running on port 5001
2. Check for port conflicts: `lsof -i :5001`
3. Verify endpoint in config uses `http://localhost:5001/graphql`

### IPv6 Issues

The handler automatically converts `localhost` to `127.0.0.1` to avoid IPv6 resolution issues.

## Performance Considerations

- Lambda instances are created once at startup and reused
- Reflection overhead is minimal (method info cached)
- JSON serialization uses System.Text.Json (fast)
- Hot Chocolate provides efficient GraphQL execution

## Future Enhancements

Possible improvements:
- Plugin system for Lambda discovery
- Support for async Lambda handlers
- Lambda lifecycle management (warm/cold starts)
- Metrics and monitoring integration
- Support for Lambda layers/dependencies
