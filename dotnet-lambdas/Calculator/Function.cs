using Amazon.Lambda.Core;
using System.Text.Json;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace Calculator;

public class Function
{
    public class CalculatorRequest
    {
        public double A { get; set; }
        public double B { get; set; }
        public string? Operation { get; set; }
    }

    public class CalculatorResponse
    {
        public double Result { get; set; }
        public string? Operation { get; set; }
        public string? Expression { get; set; }
    }

    /// <summary>
    /// A Lambda function that performs basic arithmetic operations
    /// </summary>
    public CalculatorResponse FunctionHandler(CalculatorRequest input, ILambdaContext context)
    {
        context.Logger.LogInformation($"Calculator Lambda invoked: {input.A} {input.Operation} {input.B}");
        
        double result = input.Operation?.ToLower() switch
        {
            "add" or "+" => input.A + input.B,
            "subtract" or "-" => input.A - input.B,
            "multiply" or "*" => input.A * input.B,
            "divide" or "/" => input.B != 0 ? input.A / input.B : throw new DivideByZeroException("Cannot divide by zero"),
            _ => throw new ArgumentException($"Unknown operation: {input.Operation}")
        };

        var response = new CalculatorResponse
        {
            Result = result,
            Operation = input.Operation,
            Expression = $"{input.A} {input.Operation} {input.B} = {result}"
        };

        context.Logger.LogInformation($"Result: {response.Expression}");
        
        return response;
    }
}
