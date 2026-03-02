import { Handler } from 'aws-lambda';
import { request } from 'http';

export interface DotNetLambdaConfig {
  endpoint: string;
  functionName: string;
  environment?: Record<string, string>;
}

/**
 * Create a .NET Lambda handler that calls Hot Chocolate GraphQL server
 * Uses a generic invokeLambda endpoint that accepts function name and payload
 */
export function createDotNetHandler(config: DotNetLambdaConfig): Handler {
  return async (event: any) => {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║           .NET Lambda Handler - Request Flow                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('[DotNet Handler] 📥 Received event from interceptor');
    console.log('[DotNet Handler] Function:', config.functionName);
    console.log('[DotNet Handler] Endpoint:', config.endpoint);
    console.log('[DotNet Handler] Event payload:', JSON.stringify(event, null, 2));
    console.log();
    
    return new Promise((resolve, reject) => {
      // Build GraphQL mutation to invoke Lambda generically
      const query = {
        query: `query InvokeLambda($functionName: String!, $payload: String!) {
          invokeLambda(functionName: $functionName, payload: $payload)
        }`,
        variables: {
          functionName: config.functionName,
          payload: JSON.stringify(event)
        }
      };
      
      const payload = JSON.stringify(query);
      const url = new URL(config.endpoint);
      
      // Use 127.0.0.1 instead of localhost to avoid IPv6 issues
      const hostname = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;
      
      const options = {
        hostname: hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      
      console.log('[DotNet Handler] 🔄 Building GraphQL request');
      console.log('[DotNet Handler] Target:', `${hostname}:${url.port}${url.pathname}`);
      console.log('[DotNet Handler] GraphQL Query:', JSON.stringify(query, null, 2));
      console.log('[DotNet Handler] Payload size:', Buffer.byteLength(payload), 'bytes');
      console.log();
      
      const req = request(options, (res) => {
        let data = '';
        
        console.log('[DotNet Handler] 📡 Response received from .NET server');
        console.log('[DotNet Handler] Status:', res.statusCode);
        console.log('[DotNet Handler] Headers:', JSON.stringify(res.headers, null, 2));
        console.log();
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log('[DotNet Handler] 📦 Complete response body:', data);
          console.log();
          
          if (res.statusCode !== 200) {
            console.error('[DotNet Handler] ❌ HTTP error:', res.statusCode);
            console.error('[DotNet Handler] Response:', data);
            console.log('╚════════════════════════════════════════════════════════════════╝\n');
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          
          try {
            const response = JSON.parse(data);
            console.log('[DotNet Handler] ✅ Parsed GraphQL response:', JSON.stringify(response, null, 2));
            
            if (response.errors) {
              console.error('[DotNet Handler] ❌ GraphQL errors:', JSON.stringify(response.errors, null, 2));
              console.log('╚════════════════════════════════════════════════════════════════╝\n');
              reject(new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`));
              return;
            }
            
            // Parse the Lambda response JSON string
            const lambdaResult = JSON.parse(response.data.invokeLambda);
            
            console.log('[DotNet Handler] 🎯 Lambda result (parsed):', JSON.stringify(lambdaResult, null, 2));
            console.log('[DotNet Handler] ✅ Request completed successfully');
            console.log('╚════════════════════════════════════════════════════════════════╝\n');
            resolve(lambdaResult);
          } catch (error) {
            console.error('[DotNet Handler] ❌ Failed to parse response:', data);
            console.error('[DotNet Handler] Error:', error);
            console.log('╚════════════════════════════════════════════════════════════════╝\n');
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });
      
      req.on('error', (error: any) => {
        console.error('[DotNet Handler] ❌ Request error:', error.message);
        console.error('[DotNet Handler] Error code:', error.code);
        console.log('╚════════════════════════════════════════════════════════════════╝\n');
        
        if (error.code === 'ECONNREFUSED') {
          reject(new Error(
            `Cannot connect to Hot Chocolate server at ${config.endpoint}.\n` +
            `Make sure the .NET server is running:\n` +
            `  Terminal 1: npm run dotnet:serve\n` +
            `  Terminal 2: npm run serve\n` +
            `Or manually: cd dotnet-server && dotnet run`
          ));
        } else {
          reject(error);
        }
      });
      
      console.log('[DotNet Handler] 📤 Sending HTTP request to .NET server...');
      req.write(payload);
      req.end();
    });
  };
}
