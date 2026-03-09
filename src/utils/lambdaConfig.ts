import { AppSyncSimulatorPipelineResolverConfig, AppSyncSimulatorUnitResolverConfig } from "amplify-appsync-simulator";

export interface LambdaConfig {
  environment?: Record<string, string>;
  lambdas: LambdaDefinition[];
  resolvers: ResolverDefinition[];
}

export interface LambdaDefinition {
  name: string;
  type: 'javascript' | 'dotnet';
  description?: string;
  environment?: Record<string, string>;
  
  // JavaScript/TypeScript Lambda properties (direct invocation)
  handler?: string;
  handlerFunction?: string;
  
  // .NET Lambda properties
  functionName?: string;
  
  // AWS Lambda invocation (optional)
  // - For JavaScript: If lambdaEndpoint is provided, uses AWS SDK; otherwise direct invocation
  // - For .NET: Uses AWS SDK with lambdaEndpoint (defaults to LocalStack at http://localhost:4566)
  lambdaEndpoint?: string;
  lambdaRegion?: string;
}

export interface ResolverDefinition {
  typeName: string;
  fieldName: string;
  dataSourceName: string;
  requestTemplate?: string;
  responseTemplate?: string;
  description?: string;
}

// Extended resolver config with interceptor support
export interface InterceptorConfig {
  requestTemplate?: string;
  responseTemplate?: string;
}

export interface ExtendedResolverConfig extends Omit<AppSyncSimulatorUnitResolverConfig, 'kind'> {
  kind: 'UNIT';
  interceptor?: InterceptorConfig;
}

export type ResolverConfig = ExtendedResolverConfig | AppSyncSimulatorPipelineResolverConfig;
