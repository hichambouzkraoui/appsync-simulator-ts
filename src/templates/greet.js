import { util } from "@aws-appsync/utils";

export function request(ctx) {
    console.log('[Greet Template] Validating request...');
    
    const names = ctx.arguments?.names;
    
    // Check if names array exists and is not empty
    if (!names || !Array.isArray(names) || names.length === 0) {
        console.error('[Greet Template] Validation failed: names array is empty or invalid');
        util.error('Names array cannot be empty', 'ValidationError');
    }
    
    // Check each name is not empty or only whitespace
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (!name || typeof name !== 'string' || name.trim() === '') {
            console.error(`[Greet Template] Validation failed: name at index ${i} is empty`);
            util.error(`Name at index ${i} cannot be empty`, 'ValidationError');
        }
    }
    
    console.log('[Greet Template] Validation passed for names:', names);
    
    return {
        operation: 'Invoke',
        payload: {
            fieldName: ctx.info.fieldName,
            arguments: ctx.arguments
        }
    };
}

export function response(ctx) {
    console.log('[Greet Template] Processing response...');
    
    const { result, error } = ctx;
    
    if (error) {
        console.error('[Greet Template] Error in response:', error);
        util.error(error.message, error.type, result);
    }
    
    console.log('[Greet Template] Response:', result);
    return result;
}
