import { Handler } from 'aws-lambda';

export const handler: Handler = async (event) => {
  console.log('[Greet] Received event:', JSON.stringify(event, null, 2));
  
  const { arguments: args } = event;
  const names = args?.names || [];
  
  const greetings = names.map((name: string) => `Hello ${name.toUpperCase()}`);
  
  console.log('[Greet] Generated greetings:', greetings);
  
  return greetings;
};
