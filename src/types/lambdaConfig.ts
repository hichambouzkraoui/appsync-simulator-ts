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
  
  // JavaScript Lambda properties
  handler?: string;
  handlerFunction?: string;
  
  // .NET Lambda properties (Hot Chocolate GraphQL endpoint)
  endpoint?: string;
  functionName?: string;
}

export interface ResolverDefinition {
  typeName: string;
  fieldName: string;
  dataSourceName: string;
  requestTemplate?: string;
  responseTemplate?: string;
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
