import { util } from "@aws-appsync/utils";

export function request(ctx) {
    console.log('[Greet DotNet Template] Validating request...');
    console.log('[Greet DotNet Template] Full context:', JSON.stringify(ctx, null, 2));
    
    const names = ctx.arguments?.names;
    
    // Check if names array exists and is not empty
    if (!names || !Array.isArray(names) || names.length === 0) {
        console.error('[Greet DotNet Template] Validation failed: names array is empty or invalid');
        util.error('Names array cannot be empty', 'ValidationError');
    }
    
    // Check each name is not empty or only whitespace
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (!name || typeof name !== 'string' || name.trim() === '') {
            console.error(`[Greet DotNet Template] Validation failed: name at index ${i} is empty`);
            util.error(`Name at index ${i} cannot be empty`, 'ValidationError');
        }
    }
    
    console.log('[Greet DotNet Template] Validation passed for names:', names);
    
    // Transform to .NET Lambda expected format
    const payload = {
        Names: names  // Capitalize for .NET
    };
    
    console.log('[Greet DotNet Template] Transformed payload:', JSON.stringify(payload, null, 2));
    
    return {
        operation: 'Invoke',
        payload: payload
    };
}

export function response(ctx) {
    console.log('[Greet DotNet Template] Processing response...');
    
    const { result, error } = ctx;
    
    if (error) {
        console.error('[Greet DotNet Template] Error in response:', error);
        util.error(error.message, error.type, result);
    }
    
    console.log('[Greet DotNet Template] Raw result:', result);
    
    // Extract Greetings array from .NET response object
    if (result && result.Greetings) {
        console.log('[Greet DotNet Template] Extracted greetings:', result.Greetings);
        return result.Greetings;
    }
    
    console.log('[Greet DotNet Template] Returning result as-is');
    return result;
}
