import { resolve } from 'path';
import { createDotNetHandler } from '../utils/dotnetHandler';

// Export the handler configured for the greeting Lambda
export const handler = createDotNetHandler({
  projectPath: resolve(__dirname, '../../dotnet-lambdas/Greeting'),
  functionHandler: 'Greeting::Greeting.Function::FunctionHandler',
  environment: {
    // Add any environment variables needed by the .NET Lambda
  }
});
