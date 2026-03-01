import {
    AmplifyAppSyncSimulator,
    AmplifyAppSyncSimulatorAuthenticationType,
    AmplifyAppSyncSimulatorConfig,
} from 'amplify-appsync-simulator'

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { withInterceptors } from './interceptors/templateInterceptor'
import { ResolverConfig } from './types/resolverConfig'
import { LambdaConfig, LambdaDefinition } from './types/lambdaConfig'
import { createDotNetHandler } from './utils/dotnetHandler'
import { schema } from "./schema"
import { readVTL } from './vtl/readVTL'
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
                handlers[lambda.name] = async (event: any, context?: any, callback?: any) => {
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
            } else if (lambda.type === 'dotnet') {
                handlers[lambda.name] = createDotNetHandler({
                    projectPath: lambda.projectPath!,
                    functionHandler: lambda.functionHandler!,
                    environment: {
                        ...this.lambdaConfig.environment,
                        ...lambda.environment
                    }
                })
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
        
        // Load Lambda handlers
        const handlers = this.createLambdaHandlers()
        
        // Build resolvers config from lambdas-config.json
        const resolversConfig = this.buildResolversConfig()
        
        // Build a map of data sources with their interceptors based on resolver config
        const dataSourceInterceptors = new Map<string, string>();
        
        resolversConfig.forEach(resolver => {
            if ('interceptor' in resolver && resolver.interceptor?.requestTemplate) {
                dataSourceInterceptors.set(resolver.dataSourceName, resolver.interceptor.requestTemplate);
            }
        });
        
        console.log('🔗 Data source interceptors:', Array.from(dataSourceInterceptors.entries()));
        
        const simulatorConfig: AmplifyAppSyncSimulatorConfig = {
            appSync: {
                defaultAuthenticationType: {
                    authenticationType: AmplifyAppSyncSimulatorAuthenticationType.AMAZON_COGNITO_USER_POOLS,
                    cognitoUserPoolConfig: {},
                },
                name: 'api-local',
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
            dataSources: this.lambdaConfig.lambdas.map(lambda => ({
                type: 'AWS_LAMBDA' as const,
                name: lambda.name,
                invoke: dataSourceInterceptors.has(lambda.name)
                    ? withInterceptors(handlers[lambda.name], dataSourceInterceptors.get(lambda.name)!)
                    : handlers[lambda.name]
            })),
            resolvers: resolversConfig.map(resolver => {
                // Remove interceptor config as AppSync simulator doesn't understand it
                const { interceptor, ...cleanResolver } = resolver as any;
                return cleanResolver;
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