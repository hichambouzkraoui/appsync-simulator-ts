import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const peopleTable = new dynamodb.Table(this, 'PeopleTable', {
      tableName: 'People',
      partitionKey: {
        name: 'name',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test only
    });

    // Lambda layer with shared dependencies (optional)
    const lambdaLayer = new lambda.LayerVersion(this, 'LambdaLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-layer')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Shared dependencies for Lambda functions',
    });

    // Authors Data Provider Lambda
    const authorsLambda = new nodejs.NodejsFunction(this, 'AuthorsDataProvider', {
      functionName: 'AuthorsDataProvider',
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/lambdas/authors-data-provider.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ENVIRONMENT: 'production',
      },
      bundling: {
        minify: false,
        sourceMap: true,
        nodeModules: [], // Bundle all dependencies
      },
      projectRoot: path.join(__dirname, '../..'), // Set project root for proper resolution
    });

    // Books Data Provider Lambda
    const booksLambda = new nodejs.NodejsFunction(this, 'BooksDataProvider', {
      functionName: 'BooksDataProvider',
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/lambdas/books-data-provider.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ENVIRONMENT: 'production',
      },
      bundling: {
        minify: false,
        sourceMap: true,
        nodeModules: [],
      },
      projectRoot: path.join(__dirname, '../..'),
    });

    // Greet Lambda
    const greetLambda = new nodejs.NodejsFunction(this, 'GreetDataSource', {
      functionName: 'GreetDataSource',
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/lambdas/greet.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ENVIRONMENT: 'production',
      },
      bundling: {
        minify: false,
        sourceMap: true,
        nodeModules: [],
      },
      projectRoot: path.join(__dirname, '../..'),
    });

    // Get Age Lambda (with DynamoDB access)
    // Note: AWS SDK v3 is included in Node.js 18 Lambda runtime
    const getAgeLambda = new nodejs.NodejsFunction(this, 'GetAgeDataSource', {
      functionName: 'GetAgeDataSource',
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/lambdas/get-age.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ENVIRONMENT: 'production',
        TABLE_NAME: peopleTable.tableName,
      },
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'], // AWS SDK v3 is included in Lambda runtime
        nodeModules: [],
      },
      projectRoot: path.join(__dirname, '../..'),
    });

    // Grant DynamoDB read access to GetAge Lambda
    peopleTable.grantReadData(getAgeLambda);

    // Outputs
    new cdk.CfnOutput(this, 'AuthorsLambdaArn', {
      value: authorsLambda.functionArn,
      description: 'Authors Lambda Function ARN',
    });

    new cdk.CfnOutput(this, 'BooksLambdaArn', {
      value: booksLambda.functionArn,
      description: 'Books Lambda Function ARN',
    });

    new cdk.CfnOutput(this, 'GreetLambdaArn', {
      value: greetLambda.functionArn,
      description: 'Greet Lambda Function ARN',
    });

    new cdk.CfnOutput(this, 'GetAgeLambdaArn', {
      value: getAgeLambda.functionArn,
      description: 'GetAge Lambda Function ARN',
    });

    new cdk.CfnOutput(this, 'PeopleTableName', {
      value: peopleTable.tableName,
      description: 'DynamoDB People Table Name',
    });

    new cdk.CfnOutput(this, 'PeopleTableArn', {
      value: peopleTable.tableArn,
      description: 'DynamoDB People Table ARN',
    });
  }
}
