import { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

interface GetAgeEvent {
  arguments?: {
    name: string;
  };
}

interface PersonRecord {
  name: string;
  age: number;
}

// Fallback in-memory data
const fallbackData: Record<string, number> = {
  'John': 30,
  'Jane': 25,
  'Bob': 45,
  'Alice': 28,
  'Charlie': 35,
  'Diana': 32,
  'Eve': 29,
  'Frank': 41
};

export const handler: Handler = async (event: GetAgeEvent) => {
  console.log('[GetAge] Received event:', JSON.stringify(event, null, 2));
  
  const name = event.arguments?.name;
  
  if (!name) {
    console.error('[GetAge] Name is required');
    throw new Error('Name is required');
  }
  
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  const useDynamoDB = endpoint && endpoint !== 'disabled';
  
  if (!useDynamoDB) {
    console.log('[GetAge] Using fallback in-memory data');
    const age = fallbackData[name];
    if (age === undefined) {
      console.log(`[GetAge] Person not found in fallback data: ${name}`);
      return null;
    }
    console.log(`[GetAge] Found in fallback data: ${name} -> ${age}`);
    return age;
  }
  
  try {
    const tableName = process.env.TABLE_NAME || 'People';
    const region = process.env.AWS_REGION || 'us-east-1';
    
    console.log('[GetAge] Configuration:', { endpoint, tableName, region });
    console.log(`[GetAge] Creating DynamoDB client...`);
    
    const client = new DynamoDBClient({
      region,
      endpoint,
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy'
      },
      requestHandler: {
        requestTimeout: 3000,
        connectionTimeout: 2000
      }
    });

    const docClient = DynamoDBDocumentClient.from(client);
    
    console.log(`[GetAge] Querying DynamoDB for name: ${name}`);
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { name }
    });
    
    const result = await docClient.send(command);
    console.log('[GetAge] DynamoDB response received');
    
    if (!result.Item) {
      console.log(`[GetAge] Person not found: ${name}`);
      return null;
    }
    
    const person = result.Item as PersonRecord;
    console.log(`[GetAge] Found person:`, person);
    
    return person.age;
  } catch (error: any) {
    console.error('[GetAge] Error querying DynamoDB:', error.message);
    console.log('[GetAge] Falling back to in-memory data');
    
    const age = fallbackData[name];
    if (age === undefined) {
      console.log(`[GetAge] Person not found in fallback data: ${name}`);
      return null;
    }
    console.log(`[GetAge] Found in fallback data: ${name} -> ${age}`);
    return age;
  }
};
