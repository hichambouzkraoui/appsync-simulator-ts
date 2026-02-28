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
    
    console.log('[Interceptor] === Request Phase ===');
    console.log('[Interceptor] Original event:', JSON.stringify(event, null, 2));
    
    // Apply request interceptor from template
    let transformedEvent = event;
    if (template.request) {
      const requestResult = template.request(event);
      console.log('[Interceptor] Template request result:', JSON.stringify(requestResult, null, 2));
      
      // If the template returns a payload, use it directly
      // Otherwise merge with the original event
      if (requestResult.payload) {
        transformedEvent = requestResult.payload;
        console.log('[Interceptor] Using payload from template:', JSON.stringify(transformedEvent, null, 2));
      } else {
        transformedEvent = {
          ...event,
          ...requestResult
        };
      }
    }
    
    console.log('[Interceptor] === Invoking Handler ===');
    
    // Call the actual handler
    let result;
    let error;
    
    try {
      result = await handler(transformedEvent, context, callback);
    } catch (err: any) {
      error = {
        message: err.message,
        type: err.name || 'Error'
      };
      console.error('[Interceptor] Handler error:', error);
    }
    
    console.log('[Interceptor] === Response Phase ===');
    console.log('[Interceptor] Handler result:', JSON.stringify(result, null, 2));
    
    // Apply response interceptor from template
    const responseContext = {
      ...event,
      result,
      error
    };
    
    if (template.response) {
      result = template.response(responseContext);
      console.log('[Interceptor] Template response result:', JSON.stringify(result, null, 2));
    }
    
    return result;
  };
}

