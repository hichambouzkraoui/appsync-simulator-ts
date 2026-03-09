import { util } from "@aws-appsync/utils";

/**
 * Custom interceptor for fetching authors with their books
 * This demonstrates how the same data source can have different interceptors
 */
export function request(ctx) {
    console.log('[Authors With Books Template] Processing request...');
    console.log('[Authors With Books Template] Source:', JSON.stringify(ctx.source, null, 2));
    
    // Add a flag to indicate we want books included
    return {
        operation: 'Invoke',
        payload: {
            fieldName: ctx.info.fieldName,
            arguments: ctx.arguments,
            source: ctx.source,
            info: ctx.info,
            includeBooks: true  // Custom flag for this resolver
        }
    };
}

export function response(ctx) {
    console.log('[Authors With Books Template] Processing response...');
    
    const { result, error } = ctx;
    
    if (error) {
        console.error('[Authors With Books Template] Error:', error);
        util.error(error.message, error.type, result);
    }
    
    // Could add additional transformation here
    console.log('[Authors With Books Template] Result:', result);
    return result;
}
