import {
    AmplifyAppSyncSimulator,
    AmplifyAppSyncSimulatorAuthenticationType,
    AmplifyAppSyncSimulatorConfig,
} from 'amplify-appsync-simulator'

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { withInterceptors } from './utils/templateInterceptor'
import { LambdaConfig, LambdaDefinition, ResolverConfig } from './utils/lambdaConfig'
import { createLambdaHandler, LambdaInvoker } from './utils/lambdaInvoker'
import { schema } from "./utils/schema"
import { readVTL } from './utils/readVTL'
import { RESOLVER_KIND } from 'amplify-appsync-simulator'


class AppSyncSimulator {
    httpPort: number
    wssPort: number
    lambdaConfig: LambdaConfig

    constructor(httpPort: number, wssPort: number) {
        this.httpPort = httpPort
        this.wssPort = wssPort
        
        // Load Lambda configuration
        const configPath = resolve(__dirname, 'lambdas-config.json')
        this.lambdaConfig = JSON.parse(readFileSync(configPath, 'utf8'))
    }

    /**
     * Create Lambda handlers based on configuration
     */
    createLambdaHandlers() {
        const handlers: Record<string, any> = {}
        
        for (const lambda of this.lambdaConfig.lambdas) {
            console.log(`📦 Loading ${lambda.name} (${lambda.type})`)
            
            if (lambda.type === 'javascript') {
                const handlerPath = resolve(__dirname, lambda.handler!)
                delete require.cache[require.resolve(handlerPath)]
                const handlerModule = require(handlerPath)
                const originalHandler = handlerModule[lambda.handlerFunction || 'handler']
                
                // Wrap handler to inject environment variables
                const wrappedHandler = async (event: any, context?: any, callback?: any) => {
                    const originalEnv = { ...process.env }
                    
                    // Merge global and lambda-specific environment variables
                    Object.assign(process.env, {
                        ...this.lambdaConfig.environment,
                        ...lambda.environment
                    })
                    
                    try {
                        return await originalHandler(event, context, callback)
                    } finally {
                        // Restore original environment
                        process.env = originalEnv
                    }
                }
                
                // Use AWS SDK if lambdaEndpoint is provided, otherwise direct invocation
                if (lambda.lambdaEndpoint) {
                    console.log(`   → Using AWS SDK invocation at ${lambda.lambdaEndpoint}`)
                    handlers[lambda.name] = createLambdaHandler({
                        functionName: lambda.name,
                        endpoint: lambda.lambdaEndpoint,
                        region: lambda.lambdaRegion
                    }, wrappedHandler)
                } else {
                    console.log(`   → Using direct invocation`)
                    handlers[lambda.name] = wrappedHandler
                }
            } else if (lambda.type === 'dotnet') {
                // .NET handler uses AWS SDK invocation (LocalStack by default)
                const endpoint = lambda.lambdaEndpoint || 'http://localhost:4566';
                console.log(`   → Using AWS SDK invocation at ${endpoint}`);
                
                const invoker = new LambdaInvoker({
                    functionName: lambda.functionName!,
                    endpoint: endpoint,
                    region: lambda.lambdaRegion
                });
                
                handlers[lambda.name] = async (event: any, context?: any) => {
                    return invoker.invoke(event, context);
                };
            }
        }
        
        return handlers
    }

    /**
     * Build resolver configuration from lambdas-config.json
     */
    buildResolversConfig(): ResolverConfig[] {
        return this.lambdaConfig.resolvers.map(resolver => ({
            kind: RESOLVER_KIND.UNIT,
            typeName: resolver.typeName,
            fieldName: resolver.fieldName,
            dataSourceName: resolver.dataSourceName,
            requestMappingTemplateLocation: "lambdaRequestMappingTemplate.vtl",
            responseMappingTemplateLocation: "lambdaResponseMappingTemplate.vtl",
            interceptor: {
                requestTemplate: resolver.requestTemplate,
                responseTemplate: resolver.responseTemplate
            }
        }))
    }

    async start() {
        console.log('🔧 Initializing AppSync Simulator...');
        console.log('📝 Using JS template interceptors (VTL replacement)');
        
        // Load Lambda handlers (without interceptors)
        const handlers = this.createLambdaHandlers()
        
        // Build resolvers config from lambdas-config.json
        const resolversConfig = this.buildResolversConfig()
        
        // Create a unique handler for each resolver with its specific interceptor
        // This allows multiple resolvers to use the same data source but with different interceptors
        const resolverHandlers = new Map<string, any>();
        
        resolversConfig.forEach(resolver => {
            const resolverKey = `${resolver.typeName}.${resolver.fieldName}`;
            // Type guard to ensure we're working with unit resolvers
            if (resolver.kind !== 'UNIT') return;
            
            const baseHandler = handlers[resolver.dataSourceName];
            
            if ('interceptor' in resolver && resolver.interceptor?.requestTemplate) {
                console.log(`🔗 Resolver ${resolverKey} → ${resolver.dataSourceName} with interceptor: ${resolver.interceptor.requestTemplate}`);
                resolverHandlers.set(resolverKey, {
                    handler: withInterceptors(baseHandler, resolver.interceptor.requestTemplate),
                    dataSourceName: `${resolver.dataSourceName}_${resolver.typeName}_${resolver.fieldName}`
                });
            } else {
                console.log(`🔗 Resolver ${resolverKey} → ${resolver.dataSourceName} (no interceptor)`);
                resolverHandlers.set(resolverKey, {
                    handler: baseHandler,
                    dataSourceName: resolver.dataSourceName
                });
            }
        });
        
        // Create data sources: base data sources + resolver-specific data sources
        const dataSources: any[] = [];
        const createdDataSources = new Set<string>();
        
        // Add base data sources (without interceptors)
        this.lambdaConfig.lambdas.forEach(lambda => {
            dataSources.push({
                type: 'AWS_LAMBDA' as const,
                name: lambda.name,
                invoke: handlers[lambda.name]
            });
            createdDataSources.add(lambda.name);
        });
        
        // Add resolver-specific data sources (with interceptors)
        resolverHandlers.forEach((handlerInfo, resolverKey) => {
            if (!createdDataSources.has(handlerInfo.dataSourceName)) {
                dataSources.push({
                    type: 'AWS_LAMBDA' as const,
                    name: handlerInfo.dataSourceName,
                    invoke: handlerInfo.handler
                });
                createdDataSources.add(handlerInfo.dataSourceName);
            }
        });
        
        const simulatorConfig: AmplifyAppSyncSimulatorConfig = {
            appSync: {
                defaultAuthenticationType: {
                    authenticationType: AmplifyAppSyncSimulatorAuthenticationType.API_KEY,
                },
                name: 'api-local',
                apiKey: 'da2-fakeApiId123456',
                additionalAuthenticationProviders: [],
            },
            schema: { content: schema },
            mappingTemplates: [
                {
                    path: 'lambdaRequestMappingTemplate.vtl',
                    content: readVTL("lambdaRequestMappingTemplate.vtl"),
                },
                {
                    path: 'lambdaResponseMappingTemplate.vtl',
                    content: readVTL("lambdaResponseMappingTemplate.vtl"),
                }
            ],
            dataSources: dataSources,
            resolvers: resolversConfig.map(resolver => {
                // Only process unit resolvers
                if (resolver.kind !== 'UNIT') return resolver;
                
                const resolverKey = `${resolver.typeName}.${resolver.fieldName}`;
                const handlerInfo = resolverHandlers.get(resolverKey);
                
                // Remove interceptor config and use the correct data source name
                const { interceptor, ...cleanResolver } = resolver as any;
                return {
                    ...cleanResolver,
                    dataSourceName: handlerInfo?.dataSourceName || resolver.dataSourceName
                };
            }),
        }
        
        console.log('📊 Data Sources configured:', simulatorConfig.dataSources?.map(ds => ds.name));
        console.log('🔗 Resolvers configured:', resolversConfig.length);
        
        const amplifySimulator = new AmplifyAppSyncSimulator({
            port: this.httpPort,
            wsPort: this.wssPort,
        })
        
        console.log('⚡ Starting simulator...');
        await amplifySimulator.start()
        
        console.log('🎯 Initializing with config...');
        await amplifySimulator.init(simulatorConfig)
    }
}

const httpPort = 4000
const wsPort = 4001
const simulator = new AppSyncSimulator(httpPort, wsPort)
simulator.start().then(() => {
    console.log(`\n✅ AppSync Simulator ready!`)
    console.log(`🚀 GraphQL endpoint: http://localhost:${httpPort}/graphql`)
    console.log(`🔌 WebSocket endpoint: ws://localhost:${wsPort}`)
    console.log(`\n📝 Available data sources:`)
    simulator.lambdaConfig.lambdas.forEach(lambda => {
        console.log(`   - ${lambda.name} (${lambda.type}): ${lambda.description}`)
    })
    console.log(`\n🔗 Available resolvers:`)
    simulator.lambdaConfig.resolvers.forEach(resolver => {
        console.log(`   - ${resolver.typeName}.${resolver.fieldName} → ${resolver.dataSourceName}`)
    })
    console.log()
}).catch(err => {
    console.error('❌ Failed to start simulator:', err)
    process.exit(1)
})