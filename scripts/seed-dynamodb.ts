import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://127.0.0.1:8000',
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy'
  },
  requestHandler: {
    requestTimeout: 5000,
    connectionTimeout: 3000
  }
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'People';

const seedData = [
  { name: 'John', age: 30 },
  { name: 'Jane', age: 25 },
  { name: 'Bob', age: 45 },
  { name: 'Alice', age: 28 },
  { name: 'Charlie', age: 35 },
  { name: 'Diana', age: 32 },
  { name: 'Eve', age: 29 },
  { name: 'Frank', age: 41 }
];

async function testConnection() {
  console.log('🔍 Testing DynamoDB connection...');
  try {
    await client.send(new DescribeTableCommand({ TableName: 'test' }));
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      console.log('✅ DynamoDB connection successful');
      return true;
    }
    throw err;
  }
  return true;
}

async function createTable() {
  try {
    // Check if table exists
    try {
      await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
      console.log(`✅ Table ${TABLE_NAME} already exists`);
      return;
    } catch (err: any) {
      if (err.name !== 'ResourceNotFoundException') {
        throw err;
      }
    }

    // Create table
    console.log(`📦 Creating table ${TABLE_NAME}...`);
    await client.send(new CreateTableCommand({
      TableName: TABLE_NAME,
      KeySchema: [
        { AttributeName: 'name', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'name', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }));

    console.log(`✅ Table ${TABLE_NAME} created successfully`);
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

async function seedTable() {
  try {
    console.log(`🌱 Seeding table ${TABLE_NAME} with ${seedData.length} records...`);

    for (const item of seedData) {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }));
      console.log(`   ✓ Added: ${item.name} (age: ${item.age})`);
    }

    console.log(`✅ Successfully seeded ${seedData.length} records`);
  } catch (error) {
    console.error('❌ Error seeding table:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting DynamoDB seed process...\n');
  
  try {
    // Wait a bit for DynamoDB to be ready
    console.log('⏳ Waiting for DynamoDB to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testConnection();
    await createTable();
    await seedTable();
    
    console.log('\n✅ Seed process completed successfully!');
    console.log('🌐 DynamoDB Admin UI: http://localhost:8001');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Seed process failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Docker is running');
    console.error('2. Start DynamoDB: npm run dynamodb:start');
    console.error('3. Check if DynamoDB is accessible: curl http://localhost:8000');
    process.exit(1);
  }
}

main();
