# .NET Lambda Auto-Discovery Mechanism

This document explains how the .NET server automatically discovers and registers Lambda functions without requiring code changes.

## Overview

The discovery happens in the `Query` class constructor when the Hot Chocolate server starts. It uses .NET reflection to scan assemblies and find Lambda functions.

## Discovery Process (Step by Step)

### Step 1: Constructor Initialization

```csharp
public Query()
{
    _lambdaRegistry = new Dictionary<string, (object, MethodInfo)>(StringComparer.OrdinalIgnoreCase);
    
    // Force load referenced assemblies
    LoadReferencedAssemblies();
    
    // Auto-discover all Lambda functions
    DiscoverLambdaFunctions();
}
```

When Hot Chocolate creates the `Query` instance, it:
1. Creates an empty registry (dictionary) to store Lambda functions
2. Loads all referenced assemblies into memory
3. Scans assemblies to find Lambda functions

### Step 2: Load Referenced Assemblies

```csharp
private void LoadReferencedAssemblies()
{
    // Get assemblies already loaded in memory
    var loadedAssemblies = AppDomain.CurrentDomain.GetAssemblies().ToList();
    var loadedPaths = loadedAssemblies.Select(a => a.Location).ToArray();

    // Find all DLL files in the application directory
    var referencedPaths = Directory.GetFiles(AppDomain.CurrentDomain.BaseDirectory, "*.dll");
    
    // Find DLLs that aren't loaded yet
    var toLoad = referencedPaths.Where(r => !loadedPaths.Contains(r, StringComparer.InvariantCultureIgnoreCase)).ToList();
    
    // Load each unloaded assembly
    toLoad.ForEach(path => {
        try
        {
            loadedAssemblies.Add(AppDomain.CurrentDomain.Load(AssemblyName.GetAssemblyName(path)));
        }
        catch
        {
            // Skip assemblies that can't be loaded (native DLLs, etc.)
        }
    });
}
```

**Why this is needed:**
- .NET doesn't automatically load all referenced assemblies
- Assemblies are loaded "on-demand" when first used
- We need to force-load them so we can scan them for Lambda functions

**What it does:**
1. Gets list of currently loaded assemblies
2. Finds all `.dll` files in the application directory
3. Loads any DLLs that aren't already in memory
4. Ignores failures (some DLLs can't be loaded, like native libraries)

### Step 3: Discover Lambda Functions

```csharp
private void DiscoverLambdaFunctions()
{
    Console.WriteLine("[.NET Server] Discovering Lambda functions...");
    
    // Get all loaded assemblies, excluding system/framework assemblies
    var assemblies = AppDomain.CurrentDomain.GetAssemblies()
        .Where(a => !a.IsDynamic 
            && !string.IsNullOrEmpty(a.Location)
            && !a.GetName().Name!.StartsWith("System")
            && !a.GetName().Name!.StartsWith("Microsoft")
            && !a.GetName().Name!.StartsWith("HotChocolate")
            && !a.GetName().Name!.StartsWith("Amazon.Lambda.Core"));
```

**Filtering logic:**
- `!a.IsDynamic` - Skip dynamically generated assemblies
- `!string.IsNullOrEmpty(a.Location)` - Skip in-memory assemblies
- Exclude system assemblies (System.*, Microsoft.*, etc.)
- Exclude framework assemblies (HotChocolate, Amazon.Lambda.Core)

This focuses the scan on your Lambda assemblies only.

### Step 4: Scan Each Assembly

```csharp
    foreach (var assembly in assemblies)
    {
        Console.WriteLine($"[.NET Server] Scanning assembly: {assembly.GetName().Name}");
        
        try
        {
            // Get all concrete classes (not abstract, not interfaces)
            var types = assembly.GetTypes()
                .Where(t => t.IsClass && !t.IsAbstract);

            foreach (var type in types)
            {
                // Look for FunctionHandler method
                var handlerMethod = type.GetMethod("FunctionHandler");
                
                if (handlerMethod != null)
                {
                    // Found a Lambda! Create an instance
                    var instance = Activator.CreateInstance(type);
                    if (instance != null)
                    {
                        // Register by namespace
                        var functionName = type.Namespace ?? type.Name;
                        _lambdaRegistry[functionName] = (instance, handlerMethod);
                        
                        Console.WriteLine($"[.NET Server] ✓ Registered Lambda: {functionName} ({type.FullName})");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[.NET Server] Skipped assembly {assembly.GetName().Name}: {ex.Message}");
        }
    }
```

**For each assembly:**
1. Get all types (classes) in the assembly
2. Filter to concrete classes (not abstract, not interfaces)
3. Check if the class has a method named `FunctionHandler`
4. If found:
   - Create an instance of the class using `Activator.CreateInstance()`
   - Store the instance and method info in the registry
   - Use the namespace as the key (e.g., "Greeting", "Calculator")

### Step 5: Registry Storage

The registry is a dictionary that stores:

```csharp
Dictionary<string, (object instance, MethodInfo handler)>
```

**Key:** Function name (namespace, case-insensitive)
- "Greeting" → Greeting.Function
- "Calculator" → Calculator.Function

**Value:** Tuple containing:
- `instance` - The Lambda class instance (created once, reused)
- `handler` - MethodInfo for the FunctionHandler method

## Invocation Process

When a request comes in:

```csharp
public string InvokeLambda(string functionName, string payload)
{
    // 1. Look up the Lambda in the registry
    if (!_lambdaRegistry.TryGetValue(functionName, out var lambdaInfo))
    {
        throw new ArgumentException($"Unknown Lambda function: {functionName}");
    }

    var (instance, handlerMethod) = lambdaInfo;
    
    // 2. Get the request parameter type using reflection
    var parameters = handlerMethod.GetParameters();
    var requestType = parameters[0].ParameterType;
    
    // 3. Deserialize JSON payload to the correct type
    var request = JsonSerializer.Deserialize(payload, requestType);
    
    // 4. Invoke the handler method
    var response = handlerMethod.Invoke(instance, new[] { request, context });
    
    // 5. Serialize response back to JSON
    return JsonSerializer.Serialize(response);
}
```

**Key points:**
1. **Type-safe deserialization** - Uses the actual request type from the Lambda
2. **Dynamic invocation** - Calls the method using reflection
3. **No casting needed** - Reflection handles all type conversions
4. **Reuses instances** - Lambda instances are created once and reused

## Example: Adding Calculator Lambda

Let's trace what happens when you add the Calculator Lambda:

### 1. You Create the Lambda

```csharp
namespace Calculator;

public class Function
{
    public CalculatorResponse FunctionHandler(CalculatorRequest input, ILambdaContext context)
    {
        // Implementation
    }
}
```

### 2. You Add Project Reference

```xml
<ProjectReference Include="../dotnet-lambdas/Calculator/Calculator.csproj" />
```

This tells the build system to:
- Compile Calculator.dll
- Copy it to the output directory
- Include it in the application

### 3. You Restart the Server

When the server starts:

```
[.NET Server] Discovering Lambda functions...
[.NET Server] Scanning assembly: Calculator          ← Found the assembly
[.NET Server] ✓ Registered Lambda: Calculator (Calculator.Function)  ← Found FunctionHandler
[.NET Server] Total Lambda functions registered: 2
```

**What happened:**
1. `LoadReferencedAssemblies()` loaded Calculator.dll into memory
2. `DiscoverLambdaFunctions()` scanned the Calculator assembly
3. Found `Calculator.Function` class with `FunctionHandler` method
4. Created instance: `new Calculator.Function()`
5. Stored in registry: `_lambdaRegistry["Calculator"] = (instance, methodInfo)`

### 4. First Request Arrives

```json
{
  "functionName": "Calculator",
  "payload": "{\"A\":10,\"B\":5,\"Operation\":\"add\"}"
}
```

**Invocation process:**
1. Look up "Calculator" in registry → Found!
2. Get `CalculatorRequest` type from method signature
3. Deserialize payload to `CalculatorRequest` object
4. Call `instance.FunctionHandler(request, context)` using reflection
5. Get `CalculatorResponse` back
6. Serialize to JSON: `{"Result":15,"Operation":"add","Expression":"10 add 5 = 15"}`

## Benefits of This Approach

### 1. Zero Boilerplate
- No switch statements
- No manual registration
- No routing code

### 2. Type Safety
- Uses actual Lambda types
- Compiler checks at build time
- No casting or type conversions needed

### 3. Scalability
- Add unlimited Lambdas
- No performance degradation
- Registry lookup is O(1)

### 4. Maintainability
- Single place for discovery logic
- Easy to debug (logs show what's registered)
- Clear separation of concerns

### 5. Flexibility
- Works with any Lambda signature
- Supports different request/response types
- No constraints on Lambda implementation

## Performance Considerations

### Startup Time
- Discovery happens once at startup
- Typical time: < 100ms for 10 Lambdas
- Acceptable for development/testing

### Runtime Performance
- Instance creation: Once per Lambda (startup)
- Registry lookup: O(1) dictionary lookup
- Reflection overhead: Minimal (MethodInfo cached)
- JSON serialization: Fast (System.Text.Json)

### Memory Usage
- One instance per Lambda function
- MethodInfo objects are lightweight
- Dictionary overhead is negligible

## Limitations

### 1. Method Name Must Be "FunctionHandler"
The discovery looks specifically for methods named `FunctionHandler`. If you use a different name, it won't be found.

**Solution:** Use the standard Lambda naming convention.

### 2. Namespace-Based Registration
Lambdas are registered by namespace, so:
- `Greeting.Function` → "Greeting"
- `Calculator.Function` → "Calculator"

If two Lambdas have the same namespace, the second one overwrites the first.

**Solution:** Use unique namespaces for each Lambda.

### 3. Requires Project Reference
The Lambda assembly must be referenced in `DotNetGraphQL.csproj` so it's copied to the output directory.

**Solution:** Add `<ProjectReference>` for each Lambda.

### 4. No Hot Reload
Changes to Lambda code require restarting the server.

**Solution:** Use `dotnet watch run` for auto-restart on file changes.

## Debugging Tips

### See What's Registered

Check server logs on startup:
```
[.NET Server] Discovering Lambda functions...
[.NET Server] Scanning assembly: Greeting
[.NET Server] ✓ Registered Lambda: Greeting (Greeting.Function)
[.NET Server] Scanning assembly: Calculator
[.NET Server] ✓ Registered Lambda: Calculator (Calculator.Function)
[.NET Server] Total Lambda functions registered: 2
```

### Lambda Not Found

If you see:
```
Unknown Lambda function: MyFunction. Available functions: Greeting, Calculator
```

Check:
1. Is the project referenced in `DotNetGraphQL.csproj`?
2. Does the class have a `FunctionHandler` method?
3. Is the namespace correct?
4. Did you restart the server?

### Assembly Not Scanned

If an assembly is skipped:
```
[.NET Server] Skipped assembly MyLambda: Could not load file or assembly...
```

Check:
1. Is the .csproj file valid?
2. Are all dependencies available?
3. Is the target framework compatible (net8.0)?

## Advanced: Custom Discovery

You could extend the discovery to support:

### 1. Attribute-Based Discovery
```csharp
[LambdaFunction("MyCustomName")]
public class Function { }
```

### 2. Multiple Handler Methods
```csharp
[LambdaHandler]
public Response Handler1(Request1 input) { }

[LambdaHandler]
public Response Handler2(Request2 input) { }
```

### 3. Async Handlers
```csharp
public async Task<Response> FunctionHandler(Request input, ILambdaContext context)
```

### 4. Plugin System
Load Lambdas from external DLLs at runtime without recompilation.

## Conclusion

The auto-discovery mechanism uses .NET reflection to:
1. Load all referenced assemblies
2. Scan for classes with `FunctionHandler` methods
3. Create instances and cache them
4. Dynamically invoke them based on function name

This provides a truly generic, zero-boilerplate approach to integrating .NET Lambdas with the GraphQL server.
