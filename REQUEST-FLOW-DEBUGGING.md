# Complete Request Flow Debugging

This document shows the complete debugging output when a request flows through the system from AppSync simulator to the .NET Lambda server.

## Request Flow Overview

```
GraphQL Playground
    ↓
AppSync Simulator
    ↓
Template Interceptor (Request Phase)
    ↓
.NET Handler
    ↓
Hot Chocolate GraphQL Server
    ↓
.NET Lambda Function
    ↓
Hot Chocolate GraphQL Server
    ↓
.NET Handler
    ↓
Template Interceptor (Response Phase)
    ↓
AppSync Simulator
    ↓
GraphQL Playground
```

## Example: Calculator Lambda Invocation

### Query
```graphql
query {
  calculate(a: 25, b: 5, operation: "divide") {
    result
    operation
    expression
  }
}
```

### Complete Debug Output

#### 1. Template Interceptor - Request Phase

```
╔════════════════════════════════════════════════════════════════╗
║              Template Interceptor - Request Flow               ║
╚════════════════════════════════════════════════════════════════╝
[Interceptor] 📥 Received event from AppSync simulator
[Interceptor] Template: calculator.js
[Interceptor] Event keys: fieldName, arguments, source, info, identity, request, prev, stash
[Interceptor] Field: calculate
[Interceptor] Arguments: {
  "a": 25,
  "b": 5,
  "operation": "divide"
}

[Interceptor] 🔄 Applying request template transformation
[Interceptor] Template request result: {
  "operation": "Invoke",
  "payload": {
    "A": 25,
    "B": 5,
    "Operation": "divide"
  }
}
[Interceptor] ✅ Using transformed payload from template
[Interceptor] Transformed payload: {
  "A": 25,
  "B": 5,
  "Operation": "divide"
}

[Interceptor] 🚀 Invoking handler with transformed event
[Interceptor] Handler will receive: {
  "A": 25,
  "B": 5,
  "Operation": "divide"
}
```

**What's happening:**
- AppSync simulator sends the GraphQL query arguments
- Template interceptor loads `calculator.js`
- Template transforms lowercase properties to PascalCase for .NET
- Transformed payload is passed to the handler

#### 2. .NET Handler - HTTP Request

```
╔════════════════════════════════════════════════════════════════╗
║           .NET Lambda Handler - Request Flow                   ║
╚════════════════════════════════════════════════════════════════╝
[DotNet Handler] 📥 Received event from interceptor
[DotNet Handler] Function: calculator
[DotNet Handler] Endpoint: http://localhost:5001/graphql
[DotNet Handler] Event payload: {
  "A": 25,
  "B": 5,
  "Operation": "divide"
}

[DotNet Handler] 🔄 Building GraphQL request
[DotNet Handler] Target: 127.0.0.1:5001/graphql
[DotNet Handler] GraphQL Query: {
  "query": "query InvokeLambda($functionName: String!, $payload: String!) {\n          invokeLambda(functionName: $functionName, payload: $payload)\n        }",
  "variables": {
    "functionName": "calculator",
    "payload": "{\"A\":25,\"B\":5,\"Operation\":\"divide\"}"
  }
}
[DotNet Handler] Payload size: 234 bytes

[DotNet Handler] 📤 Sending HTTP request to .NET server...
```

**What's happening:**
- Handler receives the transformed payload
- Builds a GraphQL query to invoke the Lambda
- Serializes the payload as a JSON string
- Sends HTTP POST to Hot Chocolate server

#### 3. Hot Chocolate Server - Lambda Discovery

```
╔════════════════════════════════════════════════════════════════╗
║                  Lambda Invocation Request                     ║
╚════════════════════════════════════════════════════════════════╝
📞 Function: Calculator
📦 Payload: {"A":25,"B":5,"Operation":"divide"}

✅ Found Lambda: Calculator
   Instance: Calculator.Function
   Method: FunctionHandler

🔄 Deserializing payload to: CalculatorRequest
✅ Deserialization successful
🚀 Invoking handler...
```

**What's happening:**
- Hot Chocolate receives the GraphQL query
- Looks up "Calculator" in the Lambda registry
- Uses reflection to get the request type
- Deserializes JSON to `CalculatorRequest` object
- Prepares to invoke the Lambda

#### 4. .NET Lambda Execution

```
Calculator Lambda invoked: 25 divide 5
Result: 25 divide 5 = 5
```

**What's happening:**
- The actual Lambda function code executes
- Performs the division operation
- Logs the calculation
- Returns `CalculatorResponse` object

#### 5. Hot Chocolate Server - Response

```
✅ Handler execution completed
📤 Response type: CalculatorResponse
📤 Response JSON: {"Result":5,"Operation":"divide","Expression":"25 divide 5 = 5"}
```

**What's happening:**
- Lambda execution completes successfully
- Response is serialized to JSON
- JSON string is returned to the GraphQL query

#### 6. .NET Handler - HTTP Response

```
[DotNet Handler] 📡 Response received from .NET server
[DotNet Handler] Status: 200
[DotNet Handler] Headers: {
  "connection": "close",
  "content-type": "application/graphql-response+json; charset=utf-8",
  "date": "Sun, 01 Mar 2026 22:45:00 GMT",
  "server": "Kestrel",
  "transfer-encoding": "chunked"
}

[DotNet Handler] 📦 Complete response body: {"data":{"invokeLambda":"{\"Result\":5,\"Operation\":\"divide\",\"Expression\":\"25 divide 5 = 5\"}"}}

[DotNet Handler] ✅ Parsed GraphQL response: {
  "data": {
    "invokeLambda": "{\"Result\":5,\"Operation\":\"divide\",\"Expression\":\"25 divide 5 = 5\"}"
  }
}
[DotNet Handler] 🎯 Lambda result (parsed): {
  "Result": 5,
  "Operation": "divide",
  "Expression": "25 divide 5 = 5"
}
[DotNet Handler] ✅ Request completed successfully
╚════════════════════════════════════════════════════════════════╝
```

**What's happening:**
- HTTP response received from Hot Chocolate
- Response body is parsed as JSON
- Inner JSON string (Lambda result) is parsed
- Result object is extracted

#### 7. Template Interceptor - Response Phase

```
[Interceptor] ✅ Handler completed successfully

╔════════════════════════════════════════════════════════════════╗
║             Template Interceptor - Response Flow               ║
╚════════════════════════════════════════════════════════════════╝
[Interceptor] 📦 Handler returned result
[Interceptor] Result type: object
[Interceptor] Result: {
  "Result": 5,
  "Operation": "divide",
  "Expression": "25 divide 5 = 5"
}

[Interceptor] 🔄 Applying response template transformation
[Interceptor] ✅ Template transformed response
[Interceptor] Final result: {
  "result": 5,
  "operation": "divide",
  "expression": "25 divide 5 = 5"
}
[Interceptor] 📤 Returning to AppSync simulator
╚════════════════════════════════════════════════════════════════╝
```

**What's happening:**
- Handler returns the Lambda result
- Template transforms PascalCase to camelCase
- Matches GraphQL schema field names
- Returns to AppSync simulator

#### 8. Final GraphQL Response

```json
{
  "data": {
    "calculate": {
      "result": 5,
      "operation": "divide",
      "expression": "25 divide 5 = 5"
    }
  }
}
```

## Debugging Benefits

### 1. Complete Visibility
- See every step of the request/response flow
- Understand data transformations
- Track payload changes

### 2. Easy Troubleshooting
- Identify where errors occur
- See exact payloads at each step
- Verify transformations are correct

### 3. Performance Monitoring
- Track request/response sizes
- Identify slow steps
- Monitor serialization overhead

### 4. Development Aid
- Understand the system architecture
- Learn how components interact
- Debug integration issues

## Common Issues and Solutions

### Issue: Payload Not Transformed

**Symptoms:**
```
[Interceptor] ℹ️  No response template, using result as-is
```

**Solution:**
- Check that the correct template is specified in `lambdas-config.json`
- Verify the template file exists in `src/templates/`
- Ensure template exports `request` and `response` functions

### Issue: Deserialization Failed

**Symptoms:**
```
❌ Failed to deserialize payload to CalculatorRequest
```

**Solution:**
- Check property names match (case-sensitive)
- Verify data types are correct
- Ensure required properties are included
- Check the template transformation

### Issue: Lambda Not Found

**Symptoms:**
```
❌ ERROR: Unknown Lambda function: MyFunction
📋 Available functions: Greeting, Calculator
```

**Solution:**
- Verify function name matches namespace
- Check project reference in `DotNetGraphQL.csproj`
- Restart the .NET server
- Check Lambda has `FunctionHandler` method

### Issue: Connection Refused

**Symptoms:**
```
❌ Request error: connect ECONNREFUSED
```

**Solution:**
- Start the .NET server: `npm run dotnet:serve`
- Check port 5001 is not in use
- Verify endpoint in config is correct

## Testing the Flow

### Using GraphQL Playground

1. Open http://localhost:4000/graphql
2. Run a query
3. Watch the console logs in both terminals
4. See the complete flow

### Using curl

```bash
# Test Calculator
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { calculate(a: 10, b: 2, operation: \"multiply\") { result operation expression } }"}'
```

### Monitoring Logs

**Terminal 1 (.NET Server):**
- Lambda discovery on startup
- Lambda invocation details
- Deserialization/serialization

**Terminal 2 (AppSync Simulator):**
- Interceptor request/response
- Handler HTTP communication
- Template transformations

## Production Considerations

For production, you may want to:

1. **Reduce Verbosity**: Remove detailed logging
2. **Use Log Levels**: INFO, DEBUG, ERROR
3. **Structured Logging**: JSON format for parsing
4. **Performance Metrics**: Track timing, not full payloads
5. **Security**: Don't log sensitive data

## Next Steps

- Add request/response timing
- Implement log levels (DEBUG, INFO, ERROR)
- Add correlation IDs for request tracking
- Create monitoring dashboards
- Set up distributed tracing
