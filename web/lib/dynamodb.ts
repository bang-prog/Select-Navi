import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

export const ddbDocClient = DynamoDBDocumentClient.from(client);
export const REPORTS_TABLE_NAME = process.env.REPORTS_TABLE_NAME ?? "";
export const ROUTE_CHOICES_TABLE_NAME = process.env.ROUTE_CHOICES_TABLE_NAME ?? "";
