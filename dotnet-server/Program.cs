using DotNetGraphQL;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to listen on all interfaces
builder.WebHost.UseUrls("http://0.0.0.0:5001");

// Add CORS for AppSync simulator
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Add Hot Chocolate GraphQL server
builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>();

var app = builder.Build();

app.UseCors();
app.MapGraphQL();

Console.WriteLine("🚀 Hot Chocolate GraphQL Server");
Console.WriteLine("📝 Endpoint: http://localhost:5001/graphql");
Console.WriteLine("🔍 Banana Cake Pop UI: http://localhost:5001/graphql");
Console.WriteLine("\nPress Ctrl+C to stop\n");

app.Run();

