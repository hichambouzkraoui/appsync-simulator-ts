# .NET Server Debugging Guide

This document explains the debugging features built into the .NET Lambda server.

## Auto-Discovery Debugging

When the server starts and receives its first GraphQL request, it displays detailed information about Lambda discovery:

```
╔════════════════════════════════════════════════════════════════╗
║          .NET Lambda Auto-Discovery Process                    ║
╚════════════════════════════════════════════════════════════════╝

📦 Scanning 8 assemblies for Lambda functions...

   🔍 Scanning: Greeting
      ✅ Registered: Greeting
         Class: Greeting.Function
         Request: GreetingRequest
         Response: GreetingResponse

   🔍 Scanning: Calculator
      ✅ Registered: Calculator
         Class: Calculator.Function
         Request: CalculatorRequest
         Response: CalculatorResponse

╔════════════════════════════════════════════════════════════════╗
║  Total Lambda Functions Registered: 2                          ║
╚════════════════════════════════════════════════════════════════╝
```

### What It Shows

- **Assemblies Scanned**: Number of assemblies checked for Lambda functions
- **Function Name**: The namespace used to invoke the Lambda
- **Class**: Full class name of the Lambda function
- **Request Type**: The input parameter type
- **Response Type**: The return type

### Invocation Examples

The server provides ready-to-use curl commands:

```bash
# Greeting Lambda
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { invokeLambda(functionName: \"Greeting\", payload: \"{\\\"Names\\\":[\\\"Alice\\\"]}\") }"}'

# Calculator Lambda
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { invokeLambda(functionName: \"Calculator\", payload: \"{\\\"A\\\":10,\\\"B\\\":5,\\\"Operation\\\":\\\"add\\\"}\") }"}'
```

## Invocation Debugging

When a Lambda is invoked, detailed debugging information is displayed:

```
╔════════════════════════════════════════════════════════════════╗
║                  Lambda Invocation Request                     ║
╚════════════════════════════════════════════════════════════════╝
📞 Function: Calculator
📦 Payload: {"A":15,"B":3,"Operation":"multiply"}

✅ Found Lambda: Calculator
   Instance: Calculator.Function
   Method: FunctionHandler

🔄 Deserializing payload to: CalculatorRequest
✅ Deserialization successful
🚀 Invoking handler...

Calculator Lambda invoked: 15 multiply 3
Result: 15 multiply 3 = 45

✅ Handler execution completed
📤 Response type: CalculatorResponse
📤 Response JSON: {"Result":45,"Operation":"multiply","Expression":"15 multiply 3 = 45"}
```

### Invocation Steps Shown

1. **Request Received**: Function name and payload
2. **Lambda Lookup**: Confirms the Lambda was found in the registry
3. **Deserialization**: Shows the target type and success/failure
4. **Handler Execution**: Indicates when the Lambda code is running
5. **Lambda Output**: Shows any console output from the Lambda itself
6. **Response**: Shows the response type and serialized JSON

### Error Debugging

If something goes wrong, detailed error information is displayed:

```
❌ ERROR: Unknown Lambda function: InvalidName
📋 Available functions: Greeting, Calculator
```

Or for deserialization errors:

```
❌ Failed to deserialize payload to CalculatorRequest
   Inner Exception: The JSON value could not be converted to System.Double
   Stack Trace: ...
```

## ListLambdas Query

Use the `listLambdas` query to get programmatic access to registered Lambdas:

```graphql
query {
  listLambdas {
    functionName
    className
    requestType
    responseType
    invocationUrl
    examplePayload
  }
}
```

### Response Example

```json
{
  "data": {
    "listLambdas": [
      {
        "functionName": "Greeting",
        "className": "Greeting.Function",
        "requestType": "GreetingRequest",
        "responseType": "GreetingResponse",
        "invocationUrl": "http://localhost:5001/graphql",
        "examplePayload": "{\\\"Names\\\":[\\\"Alice\\\",\\\"Bob\\\"]}"
      },
      {
        "functionName": "Calculator",
        "className": "Calculator.Function",
        "requestType": "CalculatorRequest",
        "responseType": "CalculatorResponse",
        "invocationUrl": "http://localhost:5001/graphql",
        "examplePayload": "{\\\"A\\\":10,\\\"B\\\":5,\\\"Operation\\\":\\\"add\\\"}"
      }
    ]
  }
}
```

### Use Cases

- **API Documentation**: Generate docs from registered Lambdas
- **Testing**: Get example payloads for automated tests
- **Monitoring**: Check which Lambdas are available
- **Debugging**: Verify Lambda registration

## Testing with curl

### List All Lambdas

```bash
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { listLambdas { functionName className requestType responseType examplePayload } }"}'
```

### Invoke Greeting Lambda

```bash
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { invokeLambda(functionName: \"Greeting\", payload: \"{\\\"Names\\\":[\\\"Alice\\\",\\\"Bob\\\"]}\") }"}'
```

### Invoke Calculator Lambda

```bash
# Addition
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { invokeLambda(functionName: \"Calculator\", payload: \"{\\\"A\\\":10,\\\"B\\\":5,\\\"Operation\\\":\\\"add\\\"}\") }"}'

# Multiplication
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { invokeLambda(functionName: \"Calculator\", payload: \"{\\\"A\\\":15,\\\"B\\\":3,\\\"Operation\\\":\\\"multiply\\\"}\") }"}'

# Division
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { invokeLambda(functionName: \"Calculator\", payload: \"{\\\"A\\\":20,\\\"B\\\":4,\\\"Operation\\\":\\\"divide\\\"}\") }"}'
```

## Banana Cake Pop UI

For interactive testing, open http://localhost:5001/graphql in your browser to access the Banana Cake Pop GraphQL IDE.

### Features

- **Schema Explorer**: Browse available queries and types
- **Auto-completion**: IntelliSense for GraphQL queries
- **Query History**: Keep track of previous queries
- **Variables**: Test with different inputs easily

### Example Queries in UI

```graphql
# List all Lambdas
query ListLambdas {
  listLambdas {
    functionName
    className
    requestType
    responseType
    examplePayload
  }
}

# Invoke Calculator
query CalculateSum {
  invokeLambda(
    functionName: "Calculator"
    payload: "{\"A\":10,\"B\":5,\"Operation\":\"add\"}"
  )
}

# Invoke Greeting
query GreetPeople {
  invokeLambda(
    functionName: "Greeting"
    payload: "{\"Names\":[\"Alice\",\"Bob\",\"Charlie\"]}"
  )
}
```

## Troubleshooting

### Lambda Not Found

If you see:
```
❌ ERROR: Unknown Lambda function: MyFunction
📋 Available functions: Greeting, Calculator
```

**Check:**
1. Is the project referenced in `DotNetGraphQL.csproj`?
2. Does the class have a `FunctionHandler` method?
3. Did you restart the server after adding the Lambda?
4. Is the namespace correct? (case-insensitive)

### Deserialization Failed

If you see:
```
❌ Failed to deserialize payload to CalculatorRequest
```

**Check:**
1. Is the JSON payload valid?
2. Do property names match (case-sensitive)?
3. Are data types correct (string vs number)?
4. Are required properties included?

### Port Already in Use

If the server fails to start:
```
Failed to bind to address http://0.0.0.0:5001: address already in use
```

**Solution:**
```bash
# Kill the process using port 5001
lsof -ti :5001 | xargs kill -9

# Or use a different port in Program.cs
builder.WebHost.UseUrls("http://0.0.0.0:5002");
```

## Performance Monitoring

The debugging output helps identify performance issues:

- **Slow Deserialization**: Large payloads or complex types
- **Long Handler Execution**: Check Lambda implementation
- **Serialization Issues**: Large response objects

Watch the timestamps in the logs to identify bottlenecks.

## Production Considerations

The current debugging is verbose and suitable for development. For production:

1. **Reduce Logging**: Remove or minimize console output
2. **Use Structured Logging**: Replace Console.WriteLine with ILogger
3. **Add Metrics**: Track invocation counts, durations, errors
4. **Error Handling**: Return user-friendly error messages
5. **Security**: Validate and sanitize all inputs

## Next Steps

- Add request/response logging to files
- Implement performance metrics
- Add health check endpoints
- Create monitoring dashboards
- Set up distributed tracing
