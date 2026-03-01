import { Handler } from 'aws-lambda';
import { spawn } from 'child_process';
import { resolve as resolvePath } from 'path';

export interface DotNetLambdaConfig {
  projectPath: string;
  functionHandler: string;
  environment?: Record<string, string>;
}

/**
 * Create a .NET Lambda handler that invokes via dotnet lambda-test-tool-8.0 --no-ui
 * This approach spawns a process per invocation but avoids HTTP server permission issues
 */
export function createDotNetHandler(config: DotNetLambdaConfig): Handler {
  return async (event: any) => {
    console.log('[DotNet Lambda] Invoking .NET Lambda');
    console.log('[DotNet Lambda] Project:', config.projectPath);
    console.log('[DotNet Lambda] Event:', JSON.stringify(event, null, 2));
    
    return new Promise((resolve, reject) => {
      const projectPath = resolvePath(config.projectPath);
      const payload = JSON.stringify(event);
      
      const args = [
        'lambda-test-tool-8.0',
        '--no-ui',
        '--payload',
        payload,
        '--function-handler',
        config.functionHandler
      ];
      
      console.log('[DotNet Lambda] Executing: dotnet ' + args.join(' '));
      console.log('[DotNet Lambda] Working directory:', projectPath);
      
      const lambdaProcess = spawn('dotnet', args, {
        cwd: projectPath,
        env: {
          ...process.env,
          ...config.environment,
          // Prevent the tool from trying to read console input
          NO_COLOR: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let resultFound = false;
      
      lambdaProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Filter out expected console input errors from Lambda Test Tool
        if (output.includes('Cannot read keys when either application does not have a console') ||
            output.includes('Unknown error occurred causing process exit')) {
          // This is expected when running in --no-ui mode, ignore it
          return;
        }
        
        console.log(`[DotNet Lambda] ${output.trim()}`);
        
        // Look for the response in the output
        // Lambda Test Tool outputs: Response:\n{json}
        const responseMatch = output.match(/Response:\s*(\{[\s\S]*?\})/);
        if (responseMatch && !resultFound) {
          resultFound = true;
          try {
            const result = JSON.parse(responseMatch[1]);
            console.log('[DotNet Lambda] Parsed result:', JSON.stringify(result, null, 2));
            
            // Kill the process after getting response
            lambdaProcess.kill();
            resolve(result);
          } catch (e) {
            console.log(`[DotNet Lambda] Failed to parse: ${responseMatch[1]}`);
            lambdaProcess.kill();
            resolve(responseMatch[1]);
          }
        }
      });
      
      lambdaProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        // Filter out expected console input errors from Lambda Test Tool
        if (output.includes('Cannot read keys when either application does not have a console')) {
          // This is expected when running in --no-ui mode, ignore it
          return;
        }
        
        console.error(`[DotNet Lambda ERROR] ${output.trim()}`);
      });
      
      lambdaProcess.on('close', (code) => {
        // Exit code 143 is SIGTERM (we killed it after getting response)
        // Exit code 254 is expected from Lambda Test Tool after successful execution
        if (code === 143 || code === 254) {
          console.log(`[DotNet Lambda] Process completed (exit code ${code})`);
        } else {
          console.log(`[DotNet Lambda] Process exited with code: ${code}`);
        }
        
        if (!resultFound) {
          // Try to extract result from stdout
          const responseMatch = stdout.match(/Response:\s*(\{[\s\S]*?\})/);
          if (responseMatch) {
            try {
              const result = JSON.parse(responseMatch[1]);
              resolve(result);
            } catch (e) {
              reject(new Error(`Failed to parse Lambda response: ${responseMatch[1]}`));
            }
          } else if (code === 143 || code === 254) {
            // These exit codes are expected, but we didn't find a response
            reject(new Error(`Lambda executed but no response found in output`));
          } else {
            reject(new Error(
              `No response found in Lambda output. Exit code: ${code}\n` +
              `Stdout: ${stdout}\n` +
              `Stderr: ${stderr}`
            ));
          }
        }
      });
      
      lambdaProcess.on('error', (error) => {
        console.error('[DotNet Lambda] Failed to spawn:', error.message);
        reject(new Error(
          `Failed to spawn Lambda Test Tool: ${error.message}\n` +
          `Make sure dotnet lambda-test-tool-8.0 is installed:\n` +
          `dotnet tool install -g Amazon.Lambda.TestTool-8.0`
        ));
      });
    });
  };
}
