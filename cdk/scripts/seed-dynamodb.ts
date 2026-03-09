import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const endpoint = process.env.AWS_ENDPOINT || undefined;
const region = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({
  region,
  ...(endpoint && { endpoint }),
});

const docClient = DynamoDBDocumentClient.from(client);

const people = [
  { name: 'John', age: 30 },
  { name: 'Jane', age: 25 },
  { name: 'Bob', age: 35 },
  { name: 'Alice', age: 28 },
];

async function seedData() {
  console.log('Seeding DynamoDB People table...');
  console.log(`Endpoint: ${endpoint || 'AWS'}`);
  console.log(`Region: ${region}`);

  for (const person of people) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: 'People',
          Item: person,
        })
      );
      console.log(`✓ Added ${person.name}, age ${person.age}`);
    } catch (error) {
      console.error(`✗ Failed to add ${person.name}:`, error);
    }
  }

  console.log('Seeding complete!');
}

seedData().catch(console.error);
