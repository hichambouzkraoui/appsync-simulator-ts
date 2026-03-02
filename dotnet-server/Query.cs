using System.Reflection;
using System.Text.Json;
using Amazon.Lambda.Core;
using Amazon.Lambda.TestUtilities;

namespace DotNetGraphQL;

public class Query
{
    private readonly Dictionary<string, (object instance, MethodInfo handler)> _lambdaRegistry;

    public Query()
    {
        _lambdaRegistry = new Dictionary<string, (object, MethodInfo)>(StringComparer.OrdinalIgnoreCase);
        
        // Force load referenced assemblies
        LoadReferencedAssemblies();
        
        // Auto-discover all Lambda functions in referenced assemblies
        DiscoverLambdaFunctions();
    }

    /// <summary>
    /// Force load all referenced assemblies to ensure Lambda functions are discoverable
    /// </summary>
    private void LoadReferencedAssemblies()
    {
        var loadedAssemblies = AppDomain.CurrentDomain.GetAssemblies().ToList();
        var loadedPaths = loadedAssemblies.Select(a => a.Location).ToArray();

        var referencedPaths = Directory.GetFiles(AppDomain.CurrentDomain.BaseDirectory, "*.dll");
        var toLoad = referencedPaths.Where(r => !loadedPaths.Contains(r, StringComparer.InvariantCultureIgnoreCase)).ToList();
        
        toLoad.ForEach(path => {
            try
            {
                loadedAssemblies.Add(AppDomain.CurrentDomain.Load(AssemblyName.GetAssemblyName(path)));
            }
            catch
            {
                // Skip assemblies that can't be loaded
            }
        });
    }

    /// <summary>
    /// Automatically discover Lambda functions by scanning assemblies for classes with FunctionHandler methods
    /// </summary>
    private void DiscoverLambdaFunctions()
    {
        Console.WriteLine("╔════════════════════════════════════════════════════════════════╗");
        Console.WriteLine("║          .NET Lambda Auto-Discovery Process                    ║");
        Console.WriteLine("╚════════════════════════════════════════════════════════════════╝");
        Console.WriteLine();
        
        var assemblies = AppDomain.CurrentDomain.GetAssemblies()
            .Where(a => !a.IsDynamic 
                && !string.IsNullOrEmpty(a.Location)
                && !a.GetName().Name!.StartsWith("System")
                && !a.GetName().Name!.StartsWith("Microsoft")
                && !a.GetName().Name!.StartsWith("HotChocolate")
                && !a.GetName().Name!.StartsWith("Amazon.Lambda.Core"));

        Console.WriteLine($"📦 Scanning {assemblies.Count()} assemblies for Lambda functions...");
        Console.WriteLine();

        foreach (var assembly in assemblies)
        {
            Console.WriteLine($"   🔍 Scanning: {assembly.GetName().Name}");
            
            try
            {
                var types = assembly.GetTypes()
                    .Where(t => t.IsClass && !t.IsAbstract);

                foreach (var type in types)
                {
                    // Look for FunctionHandler method
                    var handlerMethod = type.GetMethod("FunctionHandler");
                    
                    if (handlerMethod != null)
                    {
                        var instance = Activator.CreateInstance(type);
                        if (instance != null)
                        {
                            // Register by namespace (e.g., "Greeting" from "Greeting.Function")
                            var functionName = type.Namespace ?? type.Name;
                            _lambdaRegistry[functionName] = (instance, handlerMethod);
                            
                            // Get method signature details
                            var parameters = handlerMethod.GetParameters();
                            var requestType = parameters.Length > 0 ? parameters[0].ParameterType.Name : "Unknown";
                            var responseType = handlerMethod.ReturnType.Name;
                            
                            Console.WriteLine($"      ✅ Registered: {functionName}");
                            Console.WriteLine($"         Class: {type.FullName}");
                            Console.WriteLine($"         Request: {requestType}");
                            Console.WriteLine($"         Response: {responseType}");
                            Console.WriteLine();
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"      ⚠️  Skipped: {ex.Message}");
            }
        }
        
        Console.WriteLine("╔════════════════════════════════════════════════════════════════╗");
        Console.WriteLine($"║  Total Lambda Functions Registered: {_lambdaRegistry.Count,-27}║");
        Console.WriteLine("╚════════════════════════════════════════════════════════════════╝");
        Console.WriteLine();
        
        if (_lambdaRegistry.Count > 0)
        {
            Console.WriteLine("📋 Registered Lambda Functions:");
            Console.WriteLine();
            foreach (var lambda in _lambdaRegistry)
            {
                Console.WriteLine($"   • {lambda.Key}");
            }
            Console.WriteLine();
            Console.WriteLine("🔗 How to Invoke:");
            Console.WriteLine();
            Console.WriteLine("   GraphQL Query:");
            Console.WriteLine("   ──────────────");
            Console.WriteLine("   query {");
            Console.WriteLine("     invokeLambda(");
            Console.WriteLine("       functionName: \"<FunctionName>\",");
            Console.WriteLine("       payload: \"{...}\"");
            Console.WriteLine("     )");
            Console.WriteLine("   }");
            Console.WriteLine();
            Console.WriteLine("   Example (Greeting):");
            Console.WriteLine("   ──────────────────");
            Console.WriteLine("   curl -X POST http://localhost:5001/graphql \\");
            Console.WriteLine("     -H \"Content-Type: application/json\" \\");
            Console.WriteLine("     -d '{\"query\":\"query { invokeLambda(functionName: \\\"Greeting\\\", payload: \\\"{\\\\\\\"Names\\\\\\\":[\\\\\\\"Alice\\\\\\\"]}\\\") }\"}'");
            Console.WriteLine();
            Console.WriteLine("   Example (Calculator):");
            Console.WriteLine("   ────────────────────");
            Console.WriteLine("   curl -X POST http://localhost:5001/graphql \\");
            Console.WriteLine("     -H \"Content-Type: application/json\" \\");
            Console.WriteLine("     -d '{\"query\":\"query { invokeLambda(functionName: \\\"Calculator\\\", payload: \\\"{\\\\\\\"A\\\\\\\":10,\\\\\\\"B\\\\\\\":5,\\\\\\\"Operation\\\\\\\":\\\\\\\"add\\\\\\\"}\\\") }\"}'");
            Console.WriteLine();
        }
        else
        {
            Console.WriteLine("⚠️  No Lambda functions found!");
            Console.WriteLine("   Make sure Lambda projects are referenced in DotNetGraphQL.csproj");
            Console.WriteLine();
        }
    }

    /// <summary>
    /// Generic Lambda invocation endpoint that accepts function name and JSON payload
    /// Uses reflection to dynamically invoke the correct Lambda function
    /// </summary>
    public string InvokeLambda(string functionName, string payload)
    {
        Console.WriteLine();
        Console.WriteLine("╔════════════════════════════════════════════════════════════════╗");
        Console.WriteLine("║                  Lambda Invocation Request                     ║");
        Console.WriteLine("╚════════════════════════════════════════════════════════════════╝");
        Console.WriteLine($"📞 Function: {functionName}");
        Console.WriteLine($"📦 Payload: {payload}");
        Console.WriteLine();

        if (!_lambdaRegistry.TryGetValue(functionName, out var lambdaInfo))
        {
            var availableFunctions = string.Join(", ", _lambdaRegistry.Keys);
            Console.WriteLine($"❌ ERROR: Unknown Lambda function: {functionName}");
            Console.WriteLine($"📋 Available functions: {availableFunctions}");
            Console.WriteLine();
            throw new ArgumentException(
                $"Unknown Lambda function: {functionName}. Available functions: {availableFunctions}"
            );
        }

        var (instance, handlerMethod) = lambdaInfo;
        
        Console.WriteLine($"✅ Found Lambda: {functionName}");
        Console.WriteLine($"   Instance: {instance.GetType().FullName}");
        Console.WriteLine($"   Method: {handlerMethod.Name}");
        Console.WriteLine();
        
        // Create Lambda context
        var context = new TestLambdaContext
        {
            FunctionName = functionName,
            FunctionVersion = "1.0"
        };

        try
        {
            // Get the request parameter type
            var parameters = handlerMethod.GetParameters();
            if (parameters.Length < 1)
            {
                throw new InvalidOperationException($"FunctionHandler must have at least one parameter");
            }

            var requestType = parameters[0].ParameterType;
            Console.WriteLine($"🔄 Deserializing payload to: {requestType.Name}");
            
            // Deserialize payload to the correct request type
            var request = JsonSerializer.Deserialize(payload, requestType);
            if (request == null)
            {
                Console.WriteLine($"❌ Failed to deserialize payload to {requestType.Name}");
                throw new ArgumentException($"Failed to deserialize payload to {requestType.Name}");
            }

            Console.WriteLine($"✅ Deserialization successful");
            Console.WriteLine($"🚀 Invoking handler...");
            Console.WriteLine();

            // Invoke the handler
            object?[] args = parameters.Length == 2 
                ? new[] { request, context }
                : new[] { request };
                
            var response = handlerMethod.Invoke(instance, args);
            
            Console.WriteLine($"✅ Handler execution completed");
            Console.WriteLine($"📤 Response type: {response?.GetType().Name ?? "null"}");
            
            // Serialize response back to JSON
            var jsonResponse = JsonSerializer.Serialize(response);
            Console.WriteLine($"📤 Response JSON: {jsonResponse}");
            Console.WriteLine();
            
            return jsonResponse;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ ERROR: {ex.Message}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"   Inner Exception: {ex.InnerException.Message}");
            }
            Console.WriteLine($"   Stack Trace: {ex.StackTrace}");
            Console.WriteLine();
            throw new InvalidOperationException($"Failed to invoke Lambda {functionName}: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Convenience method for GraphQL - keeps backward compatibility
    /// </summary>
    public List<string> GreetDotNet(List<string> names)
    {
        var payload = JsonSerializer.Serialize(new { Names = names });
        var result = InvokeLambda("Greeting", payload);
        
        var response = JsonSerializer.Deserialize<GreetingResponse>(result);
        return response?.Greetings ?? new List<string>();
    }

    /// <summary>
    /// Debug endpoint to list all registered Lambda functions
    /// </summary>
    public List<LambdaInfo> ListLambdas()
    {
        Console.WriteLine("📋 Listing all registered Lambda functions...");
        
        var lambdas = new List<LambdaInfo>();
        
        foreach (var entry in _lambdaRegistry)
        {
            var (instance, method) = entry.Value;
            var parameters = method.GetParameters();
            
            var info = new LambdaInfo
            {
                FunctionName = entry.Key,
                ClassName = instance.GetType().FullName ?? "Unknown",
                RequestType = parameters.Length > 0 ? parameters[0].ParameterType.Name : "None",
                ResponseType = method.ReturnType.Name,
                InvocationUrl = "http://localhost:5001/graphql",
                ExamplePayload = GetExamplePayload(entry.Key)
            };
            
            lambdas.Add(info);
        }
        
        return lambdas;
    }

    private string GetExamplePayload(string functionName)
    {
        return functionName.ToLower() switch
        {
            "greeting" => "{\\\"Names\\\":[\\\"Alice\\\",\\\"Bob\\\"]}",
            "calculator" => "{\\\"A\\\":10,\\\"B\\\":5,\\\"Operation\\\":\\\"add\\\"}",
            _ => "{}"
        };
    }

    // Helper classes
    public class LambdaInfo
    {
        public string FunctionName { get; set; } = "";
        public string ClassName { get; set; } = "";
        public string RequestType { get; set; } = "";
        public string ResponseType { get; set; } = "";
        public string InvocationUrl { get; set; } = "";
        public string ExamplePayload { get; set; } = "";
    }

    private class GreetingResponse
    {
        public List<string> Greetings { get; set; } = new();
    }
}
