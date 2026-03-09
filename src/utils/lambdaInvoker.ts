import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda';

export interface LambdaInvokerConfig {
  functionName: string;
  endpoint?: string;
  region?: string;
}

// Custom handler type that works with both callback and promise styles
type LambdaHandler = (event: any, context?: any, callback?: any) => Promise<any> | any;

/**
 * AWS Lambda client for invoking Lambda functions
 * Supports both local (LocalStack) and direct invocation modes
 */
export class LambdaInvoker {
  private client: LambdaClient | null = null;
  private config: LambdaInvokerConfig;
  private directHandler?: LambdaHandler;

  constructor(config: LambdaInvokerConfig, directHandler?: LambdaHandler) {
    this.config = config;
    this.directHandler = directHandler;

    // Only create Lambda client if endpoint is provided (for LocalStack/AWS)
    if (config.endpoint) {
      this.client = new LambdaClient({
        region: config.region || process.env.AWS_REGION || 'us-east-1',
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
      });
      console.log(`[Lambda Invoker] Using AWS SDK for ${config.functionName} at ${config.endpoint}`);
    } else if (directHandler) {
      console.log(`[Lambda Invoker] Using direct invocation for ${config.functionName}`);
    } else {
      throw new Error(`Lambda ${config.functionName}: Must provide either endpoint or directHandler`);
    }
  }

  /**
   * Invoke Lambda function using AWS SDK or direct invocation
   */
  async invoke(event: any, context?: any): Promise<any> {
    // Use AWS SDK if client is configured
    if (this.client) {
      return this.invokeWithSDK(event);
    }
    
    // Otherwise use direct invocation
    if (this.directHandler) {
      return this.invokeDirect(event, context);
    }

    throw new Error(`No invocation method available for ${this.config.functionName}`);
  }

  /**
   * Invoke using AWS SDK v3
   */
  private async invokeWithSDK(event: any): Promise<any> {
    console.log(`[Lambda Invoker] Invoking ${this.config.functionName} via AWS SDK`);
    console.log(`[Lambda Invoker] Payload:`, JSON.stringify(event, null, 2));

    try {
      const command = new InvokeCommand({
        FunctionName: this.config.functionName,
        InvocationType: InvocationType.RequestResponse,
        Payload: JSON.stringify(event),
      });

      const response = await this.client!.send(command);

      if (response.FunctionError) {
        console.error(`[Lambda Invoker] Function error:`, response.FunctionError);
        const errorPayload = response.Payload 
          ? JSON.parse(Buffer.from(response.Payload).toString())
          : { error: response.FunctionError };
        throw new Error(`Lambda function error: ${JSON.stringify(errorPayload)}`);
      }

      const result = response.Payload 
        ? JSON.parse(Buffer.from(response.Payload).toString())
        : null;

      console.log(`[Lambda Invoker] Response:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error(`[Lambda Invoker] Error invoking ${this.config.functionName}:`, error);
      throw error;
    }
  }

  /**
   * Invoke directly (in-process)
   */
  private async invokeDirect(event: any, context?: any): Promise<any> {
    console.log(`[Lambda Invoker] Invoking ${this.config.functionName} directly`);
    
    try {
      // Call handler - it may return a promise or value
      const result = await Promise.resolve(this.directHandler!(event, context));
      return result;
    } catch (error) {
      console.error(`[Lambda Invoker] Error in direct invocation:`, error);
      throw error;
    }
  }

  /**
   * Get the Lambda client instance (if using AWS SDK)
   */
  getClient(): LambdaClient | null {
    return this.client;
  }
}

/**
 * Create a Lambda handler that uses AWS SDK v3 for invocation
 */
export function createLambdaHandler(config: LambdaInvokerConfig, directHandler?: LambdaHandler): LambdaHandler {
  const invoker = new LambdaInvoker(config, directHandler);
  
  return async (event: any, context?: any) => {
    return invoker.invoke(event, context);
  };
}
