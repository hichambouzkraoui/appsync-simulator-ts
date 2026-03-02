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
        Console.WriteLine("[.NET Server] Discovering Lambda functions...");
        
        var assemblies = AppDomain.CurrentDomain.GetAssemblies()
            .Where(a => !a.IsDynamic 
                && !string.IsNullOrEmpty(a.Location)
                && !a.GetName().Name!.StartsWith("System")
                && !a.GetName().Name!.StartsWith("Microsoft")
                && !a.GetName().Name!.StartsWith("HotChocolate")
                && !a.GetName().Name!.StartsWith("Amazon.Lambda.Core"));

        foreach (var assembly in assemblies)
        {
            Console.WriteLine($"[.NET Server] Scanning assembly: {assembly.GetName().Name}");
            
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
                            
                            Console.WriteLine($"[.NET Server] ✓ Registered Lambda: {functionName} ({type.FullName})");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                // Skip assemblies that can't be scanned
                Console.WriteLine($"[.NET Server] Skipped assembly {assembly.GetName().Name}: {ex.Message}");
            }
        }
        
        Console.WriteLine($"[.NET Server] Total Lambda functions registered: {_lambdaRegistry.Count}");
    }

    /// <summary>
    /// Generic Lambda invocation endpoint that accepts function name and JSON payload
    /// Uses reflection to dynamically invoke the correct Lambda function
    /// </summary>
    public string InvokeLambda(string functionName, string payload)
    {
        Console.WriteLine($"[.NET Server] Invoking Lambda: {functionName}");
        Console.WriteLine($"[.NET Server] Payload: {payload}");

        if (!_lambdaRegistry.TryGetValue(functionName, out var lambdaInfo))
        {
            var availableFunctions = string.Join(", ", _lambdaRegistry.Keys);
            throw new ArgumentException(
                $"Unknown Lambda function: {functionName}. Available functions: {availableFunctions}"
            );
        }

        var (instance, handlerMethod) = lambdaInfo;
        
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
            
            // Deserialize payload to the correct request type
            var request = JsonSerializer.Deserialize(payload, requestType);
            if (request == null)
            {
                throw new ArgumentException($"Failed to deserialize payload to {requestType.Name}");
            }

            // Invoke the handler
            object?[] args = parameters.Length == 2 
                ? new[] { request, context }
                : new[] { request };
                
            var response = handlerMethod.Invoke(instance, args);
            
            // Serialize response back to JSON
            return JsonSerializer.Serialize(response);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[.NET Server] Error invoking Lambda: {ex.Message}");
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

    // Helper class for backward compatibility
    private class GreetingResponse
    {
        public List<string> Greetings { get; set; } = new();
    }
}
