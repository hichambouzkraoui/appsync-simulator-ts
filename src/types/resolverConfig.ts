import { AppSyncSimulatorPipelineResolverConfig, AppSyncSimulatorUnitResolverConfig } from "amplify-appsync-simulator";

export interface InterceptorConfig {
  requestTemplate?: string;
  responseTemplate?: string;
}

export interface ExtendedResolverConfig extends Omit<AppSyncSimulatorUnitResolverConfig, 'kind'> {
  kind: 'UNIT';
  interceptor?: InterceptorConfig;
}

export type ResolverConfig = ExtendedResolverConfig | AppSyncSimulatorPipelineResolverConfig;
