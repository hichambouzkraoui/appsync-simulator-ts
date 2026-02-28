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
  
  // .NET Lambda properties
  projectPath?: string;
  functionHandler?: string;
}

export interface ResolverDefinition {
  typeName: string;
  fieldName: string;
  dataSourceName: string;
  requestTemplate?: string;
  responseTemplate?: string;
}
