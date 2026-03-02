import { util } from "@aws-appsync/utils";

export function request(ctx) {
    console.log('[Calculator Template] Validating request...');
    console.log('[Calculator Template] Arguments:', JSON.stringify(ctx.arguments, null, 2));
    
    const { a, b, operation } = ctx.arguments;
    
    // Validate inputs
    if (typeof a !== 'number' || typeof b !== 'number') {
        console.error('[Calculator Template] Invalid numbers');
        util.error('Both a and b must be numbers', 'ValidationError');
    }
    
    if (!operation || typeof operation !== 'string') {
        console.error('[Calculator Template] Invalid operation');
        util.error('Operation must be a string', 'ValidationError');
    }
    
    const validOps = ['add', 'subtract', 'multiply', 'divide', '+', '-', '*', '/'];
    if (!validOps.includes(operation.toLowerCase())) {
        console.error('[Calculator Template] Unknown operation:', operation);
        util.error(`Operation must be one of: ${validOps.join(', ')}`, 'ValidationError');
    }
    
    console.log('[Calculator Template] Validation passed');
    
    // Transform to .NET Lambda expected format
    const payload = {
        A: a,
        B: b,
        Operation: operation
    };
    
    console.log('[Calculator Template] Transformed payload:', JSON.stringify(payload, null, 2));
    
    return {
        operation: 'Invoke',
        payload: payload
    };
}

export function response(ctx) {
    console.log('[Calculator Template] Processing response...');
    
    const { result, error } = ctx;
    
    if (error) {
        console.error('[Calculator Template] Error in response:', error);
        util.error(error.message, error.type, result);
    }
    
    console.log('[Calculator Template] Raw result:', result);
    
    // Transform .NET response (PascalCase) to GraphQL schema (camelCase)
    if (result) {
        const transformed = {
            result: result.Result,
            operation: result.Operation,
            expression: result.Expression
        };
        console.log('[Calculator Template] Transformed result:', transformed);
        return transformed;
    }
    
    console.log('[Calculator Template] No result found');
    return null;
}
