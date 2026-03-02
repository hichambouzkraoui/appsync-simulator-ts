import { Handler } from 'aws-lambda';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { transformSync } from '@babel/core';

// Utility functions to mimic AWS AppSync utils
const util = {
  error: (message: string, type: string, data?: any) => {
    const error: any = new Error(message);
    error.type = type;
    error.data = data;
    throw error;
  }
};

// Load and compile JS template
function loadTemplate(templatePath: string) {
  console.log('[Interceptor] Loading template from:', templatePath);
  
  const templateCode = readFileSync(templatePath, 'utf8');
  
  // Transform ES6 imports to CommonJS
  const transformed = transformSync(templateCode, {
    presets: [
      ['@babel/preset-env', {
        targets: { node: 'current' },
        modules: 'commonjs'
      }]
    ],
    filename: templatePath
  });

  if (!transformed || !transformed.code) {
    throw new Error('Failed to transform template');
  }

  // Create a module context and execute the code
  const moduleExports: any = {};
  const moduleContext = {
    exports: moduleExports,
    require: (name: string) => {
      if (name === '@aws-appsync/utils') {
        return { util };
      }
      return require(name);
    }
  };

  // Execute the transformed code
  const fn = new Function('exports', 'require', 'module', transformed.code);
  fn(moduleExports, moduleContext.require, { exports: moduleExports });

  console.log('[Interceptor] Template loaded successfully');
  
  return {
    request: moduleExports.request,
    response: moduleExports.response
  };
}

// Cache loaded templates
const templateCache = new Map<string, any>();

function getTemplate(templatePath: string) {
  if (!templateCache.has(templatePath)) {
    templateCache.set(templatePath, loadTemplate(templatePath));
  }
  return templateCache.get(templatePath);
}

// Wrapper to apply template interceptors to any Lambda handler
export function withInterceptors(handler: Handler, templatePath: string = 'default.js'): Handler {
  const fullTemplatePath = resolve(__dirname, '../templates', templatePath);
  
  return async (event: any, context?: any, callback?: any) => {
    const template = getTemplate(fullTemplatePath);
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              Template Interceptor - Request Flow               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('[Interceptor] 📥 Received event from AppSync simulator');
    console.log('[Interceptor] Template:', templatePath);
    console.log('[Interceptor] Event keys:', Object.keys(event).join(', '));
    console.log('[Interceptor] Field:', event.fieldName);
    console.log('[Interceptor] Arguments:', JSON.stringify(event.arguments, null, 2));
    console.log();
    
    // Apply request interceptor from template
    let transformedEvent = event;
    if (template.request) {
      console.log('[Interceptor] 🔄 Applying request template transformation');
      const requestResult = template.request(event);
      console.log('[Interceptor] Template request result:', JSON.stringify(requestResult, null, 2));
      
      // If the template returns a payload, use it directly
      // Otherwise merge with the original event
      if (requestResult.payload) {
        transformedEvent = requestResult.payload;
        console.log('[Interceptor] ✅ Using transformed payload from template');
        console.log('[Interceptor] Transformed payload:', JSON.stringify(transformedEvent, null, 2));
      } else {
        transformedEvent = {
          ...event,
          ...requestResult
        };
        console.log('[Interceptor] ✅ Merged template result with event');
      }
    }
    console.log();
    
    console.log('[Interceptor] 🚀 Invoking handler with transformed event');
    console.log('[Interceptor] Handler will receive:', JSON.stringify(transformedEvent, null, 2));
    console.log();
    
    // Call the actual handler
    let result;
    let error;
    
    try {
      result = await handler(transformedEvent, context, callback);
      console.log('[Interceptor] ✅ Handler completed successfully');
    } catch (err: any) {
      error = {
        message: err.message,
        type: err.name || 'Error'
      };
      console.error('[Interceptor] ❌ Handler error:', error);
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║             Template Interceptor - Response Flow               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('[Interceptor] 📦 Handler returned result');
    console.log('[Interceptor] Result type:', typeof result);
    console.log('[Interceptor] Result:', JSON.stringify(result, null, 2));
    console.log();
    
    // Apply response interceptor from template
    const responseContext = {
      ...event,
      result,
      error
    };
    
    if (template.response) {
      console.log('[Interceptor] 🔄 Applying response template transformation');
      result = template.response(responseContext);
      console.log('[Interceptor] ✅ Template transformed response');
      console.log('[Interceptor] Final result:', JSON.stringify(result, null, 2));
    } else {
      console.log('[Interceptor] ℹ️  No response template, using result as-is');
    }
    
    console.log('[Interceptor] 📤 Returning to AppSync simulator');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    return result;
  };
}

