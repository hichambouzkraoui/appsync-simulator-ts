import { Handler } from 'aws-lambda';
import { spawn } from 'child_process';

export interface DotNetLambdaConfig {
  projectPath: string;
  functionHandler?: string;
  environment?: Record<string, string>;
}

/**
 * Create a .NET Lambda handler that spawns dotnet-lambda-test-tool-8.0
 * This follows the same pattern as index.js for invoking .NET Lambdas
 */
export function createDotNetHandler(config: DotNetLambdaConfig): Handler {
  return async (event: any) => {
    return new Promise((resolve, reject) => {
      console.log('[DotNet Lambda] Invoking .NET Lambda');
      console.log('[DotNet Lambda] Event:', JSON.stringify(event, null, 2));
      
      const projectPath = config.projectPath;
      const payload = JSON.stringify(event);
      
      // Merge environment variables
      const mergedEnv = {
        ...process.env,
        ...config.environment
      };
      
      // Invoke Lambda Test Tool with --no-ui and --payload for one-time execution
      const args = [
        '--no-ui',
        '--payload', payload
      ];
      
      // Add function handler if specified
      if (config.functionHandler) {
        args.push('--function-handler', config.functionHandler);
      }
      
      console.log(`[DotNet Lambda] Executing: dotnet-lambda-test-tool-8.0 ${args.join(' ')}`);
      console.log(`[DotNet Lambda] Working directory: ${projectPath}`);
      
      const lambdaTest = spawn('dotnet-lambda-test-tool-8.0', args, {
        cwd: projectPath,
        env: mergedEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let resultFound = false;
      
      lambdaTest.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[DotNet Lambda] ${output}`);
        
        // Look for the response in the output
        // Lambda Test Tool outputs: Response:\n{json}
        const responseMatch = output.match(/Response:\s*(\{[\s\S]*\})/);
        if (responseMatch && !resultFound) {
          resultFound = true;
          try {
            const result = JSON.parse(responseMatch[1]);
            console.log('[DotNet Lambda] Result:', result);
            
            // Kill the process immediately after getting the response
            lambdaTest.kill();
            
            resolve(result);
          } catch (e) {
            console.log(`[DotNet Lambda] Failed to parse response: ${responseMatch[1]}`);
            lambdaTest.kill();
            resolve(responseMatch[1]);
          }
        }
      });
      
      lambdaTest.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`[DotNet Lambda ERROR] ${data.toString()}`);
      });
      
      lambdaTest.on('close', (code) => {
        console.log(`[DotNet Lambda] Process exited with code: ${code}`);
        
        if (!resultFound) {
          // Try to extract result from stdout
          const responseMatch = stdout.match(/Response:\s*(\{[\s\S]*\})/);
          if (responseMatch) {
            try {
              const result = JSON.parse(responseMatch[1]);
              resolve(result);
            } catch (e) {
              reject(new Error(`Failed to parse Lambda response: ${responseMatch[1]}`));
            }
          } else if (code === 0) {
            reject(new Error(`No response found in Lambda output. Exit code: ${code}`));
          } else {
            reject(new Error(`Lambda execution failed with exit code ${code}. stderr: ${stderr}`));
          }
        }
      });
      
      lambdaTest.on('error', (error) => {
        reject(new Error(`Failed to spawn Lambda Test Tool: ${error.message}`));
      });
    });
  };
}
