"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedItem = seedItem;
exports.deleteItem = deleteItem;
exports.cleanupByPk = cleanupByPk;
// File: shared/libs/testing/src/localstack/seeder.ts
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
async function seedItem(ddb, tableName, item) {
    await ddb.send(new client_dynamodb_1.PutItemCommand({
        TableName: tableName,
        Item: (0, util_dynamodb_1.marshall)(item, { removeUndefinedValues: true })
    }));
}
async function deleteItem(ddb, tableName, pk, sk) {
    await ddb.send(new client_dynamodb_1.DeleteItemCommand({
        TableName: tableName,
        Key: (0, util_dynamodb_1.marshall)({ PK: pk, SK: sk })
    }));
}
/**
 * Delete all items under a given PK — used for post-test cleanup.
 */
async function cleanupByPk(ddb, tableName, pk) {
    const res = await ddb.send(new client_dynamodb_1.QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({ ":pk": pk })
    }));
    const items = res.Items ?? [];
    if (items.length === 0)
        return;
    for (const chunk of chunkArray(items, 25)) {
        await ddb.send(new client_dynamodb_1.BatchWriteItemCommand({
            RequestItems: {
                [tableName]: chunk.map((item) => {
                    const u = (0, util_dynamodb_1.unmarshall)(item);
                    return { DeleteRequest: { Key: (0, util_dynamodb_1.marshall)({ PK: u.PK, SK: u.SK }) } };
                })
            }
        }));
    }
}
function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
//# sourceMappingURL=seeder.js.map