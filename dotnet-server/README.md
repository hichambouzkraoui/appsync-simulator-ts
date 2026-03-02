# .NET Lambda Server

This Hot Chocolate GraphQL server provides a generic endpoint for invoking .NET Lambda functions using reflection-based auto-discovery.

## Architecture

The server uses a generic `invokeLambda` query that:
- **Auto-discovers** all Lambda functions at startup by scanning assemblies
- **Dynamically invokes** functions using reflection
- Accepts `functionName` and `payload` (JSON string)

**No code changes needed** when adding new Lambda functions - just add the project reference!

## How It Works

1. On startup, the server scans all loaded assemblies
2. Finds classes with a `FunctionHandler` method
3. Registers them by namespace (e.g., "Greeting" from `Greeting.Function`)
4. Uses reflection to deserialize payloads and invoke handlers dynamically

## Adding a New .NET Lambda

### 1. Create the Lambda Function

Create a new folder in `dotnet-lambdas/` with your Lambda function:

```csharp
// dotnet-lambdas/MyFunction/Function.cs
using Amazon.Lambda.Core;
using System.Text.Json;

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
        context.Logger.LogInformation($"Processing: {input.Input}");
        
        return new MyResponse
        {
            Output = $"Processed: {input.Input}"
        };
    }
}
```

### 2. Add Project Reference

Add the Lambda project reference to `dotnet-server/DotNetGraphQL.csproj`:

```xml
<ItemGroup>
  <ProjectReference Include="../dotnet-lambdas/MyFunction/MyFunction.csproj" />
</ItemGroup>
```

### 3. Restart the Server

That's it! The server will auto-discover your Lambda on startup. No changes to `Query.cs` needed!

```bash
# Restart the server
npm run dotnet:serve
```

You'll see in the logs:
```
[.NET Server] ✓ Registered Lambda: MyFunction (MyFunction.Function)
```

### 4. Add to lambdas-config.json

```json
{
  "name": "MyFunctionDataSource",
  "type": "dotnet",
  "endpoint": "http://localhost:5001/graphql",
  "functionName": "myfunction",
  "description": "My custom .NET Lambda function"
}
```

Note: The `functionName` should match the namespace of your Lambda (case-insensitive).

### 5. Add GraphQL Schema

Add the query/mutation to `src/schema.gql`:

```graphql
type Query {
  myQuery(input: String!): String
}
```

### 6. Create Template Interceptor

Create `src/templates/myfunction.js`:

```javascript
import { util } from "@aws-appsync/utils";

export function request(ctx) {
    return {
        operation: 'Invoke',
        payload: {
            Input: ctx.arguments.input
        }
    };
}

export function response(ctx) {
    const { result, error } = ctx;
    
    if (error) {
        util.error(error.message, error.type, result);
    }
    
    return result.Output;
}
```

### 7. Add Resolver Configuration

Add to the `resolvers` array in `src/lambdas-config.json`:

```json
{
  "typeName": "Query",
  "fieldName": "myQuery",
  "dataSourceName": "MyFunctionDataSource",
  "requestTemplate": "myfunction.js",
  "responseTemplate": "myfunction.js"
}
```

That's it! The server automatically discovers and routes to your Lambda function.

## Key Benefits

- **Zero boilerplate**: No need to modify `Query.cs` for each Lambda
- **Auto-discovery**: Lambdas are found automatically via reflection
- **Type-safe**: Uses actual Lambda request/response types
- **Flexible**: Works with any Lambda that has a `FunctionHandler` method

## How Function Names Work

The server registers Lambdas by their namespace:
- `Greeting.Function` → registered as "Greeting"
- `MyFunction.Function` → registered as "MyFunction"
- Function names are case-insensitive

## Testing

Test the generic endpoint directly:

```bash
curl -X POST http://127.0.0.1:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { invokeLambda(functionName: \"myfunction\", payload: \"{\\\"Input\\\":\\\"test\\\"}\") }"}'
```

Or test through the AppSync simulator at http://localhost:4000/graphql:

```graphql
query {
  myQuery(input: "test")
}
```
