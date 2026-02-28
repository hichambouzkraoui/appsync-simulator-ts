using Amazon.Lambda.Core;
using System.Text.Json;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace Greeting;

public class Function
{
    public class GreetingRequest
    {
        public List<string>? Names { get; set; }
    }

    public class GreetingResponse
    {
        public List<string> Greetings { get; set; } = new();
    }

    /// <summary>
    /// A Lambda function that greets a list of names
    /// </summary>
    public GreetingResponse FunctionHandler(GreetingRequest input, ILambdaContext context)
    {
        context.Logger.LogInformation($"Greeting Lambda invoked with {input.Names?.Count ?? 0} names");
        
        var response = new GreetingResponse();
        
        if (input.Names != null)
        {
            foreach (var name in input.Names)
            {
                var greeting = $"Hello {name.ToUpper()} from .NET!";
                response.Greetings.Add(greeting);
                context.Logger.LogInformation($"Generated greeting: {greeting}");
            }
        }
        
        return response;
    }
}
