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
    console.log('[DotNet Lambda] Invoking via Hot Chocolate GraphQL server');
    console.log('[DotNet Lambda] Function:', config.functionName);
    console.log('[DotNet Lambda] Endpoint:', config.endpoint);
    console.log('[DotNet Lambda] Event:', JSON.stringify(event, null, 2));
    
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
      
      console.log('[DotNet Lambda] GraphQL Query:', query);
      
      const req = request(options, (res) => {
        let data = '';
        
        console.log('[DotNet Lambda] Response status:', res.statusCode);
        console.log('[DotNet Lambda] Response headers:', res.headers);
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log('[DotNet Lambda] Response body:', data);
          
          if (res.statusCode !== 200) {
            console.error('[DotNet Lambda] HTTP error:', res.statusCode, data);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          
          try {
            const response = JSON.parse(data);
            console.log('[DotNet Lambda] GraphQL Response:', JSON.stringify(response, null, 2));
            
            if (response.errors) {
              reject(new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`));
              return;
            }
            
            // Parse the Lambda response JSON string
            const lambdaResult = JSON.parse(response.data.invokeLambda);
            
            console.log('[DotNet Lambda] Lambda Result:', JSON.stringify(lambdaResult, null, 2));
            resolve(lambdaResult);
          } catch (error) {
            console.error('[DotNet Lambda] Failed to parse response:', data);
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });
      
      req.on('error', (error: any) => {
        console.error('[DotNet Lambda] Request error:', error.message);
        console.error('[DotNet Lambda] Error code:', error.code);
        
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
      
      req.write(payload);
      req.end();
    });
  };
}
