import { util } from "@aws-appsync/utils";

/**
 * Custom interceptor for fetching books with author details
 * This demonstrates how the same data source can have different interceptors
 */
export function request(ctx) {
    console.log('[Books With Author Template] Processing request...');
    console.log('[Books With Author Template] Source:', JSON.stringify(ctx.source, null, 2));
    
    // Add a flag to indicate we want author details included
    return {
        operation: 'Invoke',
        payload: {
            fieldName: ctx.info.fieldName,
            arguments: ctx.arguments,
            source: ctx.source,
            info: ctx.info,
            includeAuthor: true  // Custom flag for this resolver
        }
    };
}

export function response(ctx) {
    console.log('[Books With Author Template] Processing response...');
    
    const { result, error } = ctx;
    
    if (error) {
        console.error('[Books With Author Template] Error:', error);
        util.error(error.message, error.type, result);
    }
    
    // Could add additional transformation here
    console.log('[Books With Author Template] Result:', result);
    return result;
}
