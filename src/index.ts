#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";

import { createSalesforceConnection } from "./utils/connection.js";
import { SEARCH_OBJECTS, handleSearchObjects } from "./tools/search.js";
import { DESCRIBE_OBJECT, handleDescribeObject } from "./tools/describe.js";
import { QUERY_RECORDS, handleQueryRecords, QueryArgs } from "./tools/query.js";
import { AGGREGATE_QUERY, handleAggregateQuery, AggregateQueryArgs } from "./tools/aggregateQuery.js";
import { DML_RECORDS, handleDMLRecords, DMLArgs } from "./tools/dml.js";
import { MANAGE_OBJECT, handleManageObject, ManageObjectArgs } from "./tools/manageObject.js";
import { MANAGE_FIELD, handleManageField, ManageFieldArgs } from "./tools/manageField.js";
import { MANAGE_FIELD_PERMISSIONS, handleManageFieldPermissions, ManageFieldPermissionsArgs } from "./tools/manageFieldPermissions.js";
import { SEARCH_ALL, handleSearchAll, SearchAllArgs, WithClause } from "./tools/searchAll.js";
import { READ_APEX, handleReadApex, ReadApexArgs } from "./tools/readApex.js";
import { WRITE_APEX, handleWriteApex, WriteApexArgs } from "./tools/writeApex.js";
import { READ_APEX_TRIGGER, handleReadApexTrigger, ReadApexTriggerArgs } from "./tools/readApexTrigger.js";
import { WRITE_APEX_TRIGGER, handleWriteApexTrigger, WriteApexTriggerArgs } from "./tools/writeApexTrigger.js";
import { EXECUTE_ANONYMOUS, handleExecuteAnonymous, ExecuteAnonymousArgs } from "./tools/executeAnonymous.js";
import { MANAGE_DEBUG_LOGS, handleManageDebugLogs, ManageDebugLogsArgs } from "./tools/manageDebugLogs.js";

dotenv.config();

const toolRegistry = {
  [SEARCH_OBJECTS.name]: {
    definition: SEARCH_OBJECTS,
    handler: (conn: any, args: unknown) => {
      const { searchPattern } = args as { searchPattern: string };
      if (!searchPattern) throw new Error('searchPattern is required');
      return handleSearchObjects(conn, searchPattern);
    },
  },
  [DESCRIBE_OBJECT.name]: {
    definition: DESCRIBE_OBJECT,
    handler: (conn: any, args: unknown) => {
      const { objectName } = args as { objectName: string };
      if (!objectName) throw new Error('objectName is required');
      return handleDescribeObject(conn, objectName);
    },
  },
  [QUERY_RECORDS.name]: {
    definition: QUERY_RECORDS,
    handler: (conn: any, args: unknown) => {
      const queryArgs = args as Record<string, unknown>;
      if (!queryArgs.objectName || !Array.isArray(queryArgs.fields)) {
        throw new Error('objectName and fields array are required for query');
      }
      const validatedArgs: QueryArgs = {
        objectName: queryArgs.objectName as string,
        fields: queryArgs.fields as string[],
        whereClause: queryArgs.whereClause as string | undefined,
        orderBy: queryArgs.orderBy as string | undefined,
        limit: queryArgs.limit as number | undefined
      };
      return handleQueryRecords(conn, validatedArgs);
    },
  },
  [AGGREGATE_QUERY.name]: {
    definition: AGGREGATE_QUERY,
    handler: (conn: any, args: unknown) => {
      const aggregateArgs = args as Record<string, unknown>;
      if (!aggregateArgs.objectName || !Array.isArray(aggregateArgs.selectFields) || !Array.isArray(aggregateArgs.groupByFields)) {
        throw new Error('objectName, selectFields array, and groupByFields array are required for aggregate query');
      }
      const validatedArgs: AggregateQueryArgs = {
        objectName: aggregateArgs.objectName as string,
        selectFields: aggregateArgs.selectFields as string[],
        groupByFields: aggregateArgs.groupByFields as string[],
        whereClause: aggregateArgs.whereClause as string | undefined,
        havingClause: aggregateArgs.havingClause as string | undefined,
        orderBy: aggregateArgs.orderBy as string | undefined,
        limit: aggregateArgs.limit as number | undefined
      };
      return handleAggregateQuery(conn, validatedArgs);
    },
  },
  [DML_RECORDS.name]: {
    definition: DML_RECORDS,
    handler: (conn: any, args: unknown) => {
      const dmlArgs = args as Record<string, unknown>;
      if (!dmlArgs.operation || !dmlArgs.objectName || !Array.isArray(dmlArgs.records)) {
        throw new Error('operation, objectName, and records array are required for DML');
      }
      const validatedArgs: DMLArgs = {
        operation: dmlArgs.operation as 'insert' | 'update' | 'delete' | 'upsert',
        objectName: dmlArgs.objectName as string,
        records: dmlArgs.records as Record<string, any>[],
        externalIdField: dmlArgs.externalIdField as string | undefined
      };
      return handleDMLRecords(conn, validatedArgs);
    },
  },
  [MANAGE_OBJECT.name]: {
    definition: MANAGE_OBJECT,
    handler: (conn: any, args: unknown) => {
      const objectArgs = args as Record<string, unknown>;
      if (!objectArgs.operation || !objectArgs.objectName) {
        throw new Error('operation and objectName are required for object management');
      }
      const validatedArgs: ManageObjectArgs = {
        operation: objectArgs.operation as 'create' | 'update',
        objectName: objectArgs.objectName as string,
        label: objectArgs.label as string | undefined,
        pluralLabel: objectArgs.pluralLabel as string | undefined,
        description: objectArgs.description as string | undefined,
        nameFieldLabel: objectArgs.nameFieldLabel as string | undefined,
        nameFieldType: objectArgs.nameFieldType as 'Text' | 'AutoNumber' | undefined,
        nameFieldFormat: objectArgs.nameFieldFormat as string | undefined,
        sharingModel: objectArgs.sharingModel as 'ReadWrite' | 'Read' | 'Private' | 'ControlledByParent' | undefined
      };
      return handleManageObject(conn, validatedArgs);
    },
  },
  [MANAGE_FIELD.name]: {
    definition: MANAGE_FIELD,
    handler: (conn: any, args: unknown) => {
      const fieldArgs = args as Record<string, unknown>;
      if (!fieldArgs.operation || !fieldArgs.objectName || !fieldArgs.fieldName) {
        throw new Error('operation, objectName, and fieldName are required for field management');
      }
      const validatedArgs: ManageFieldArgs = {
        operation: fieldArgs.operation as 'create' | 'update',
        objectName: fieldArgs.objectName as string,
        fieldName: fieldArgs.fieldName as string,
        label: fieldArgs.label as string | undefined,
        type: fieldArgs.type as string | undefined,
        required: fieldArgs.required as boolean | undefined,
        unique: fieldArgs.unique as boolean | undefined,
        externalId: fieldArgs.externalId as boolean | undefined,
        length: fieldArgs.length as number | undefined,
        precision: fieldArgs.precision as number | undefined,
        scale: fieldArgs.scale as number | undefined,
        referenceTo: fieldArgs.referenceTo as string | undefined,
        relationshipLabel: fieldArgs.relationshipLabel as string | undefined,
        relationshipName: fieldArgs.relationshipName as string | undefined,
        deleteConstraint: fieldArgs.deleteConstraint as 'Cascade' | 'Restrict' | 'SetNull' | undefined,
        picklistValues: fieldArgs.picklistValues as Array<{ label: string; isDefault?: boolean }> | undefined,
        description: fieldArgs.description as string | undefined,
        grantAccessTo: fieldArgs.grantAccessTo as string[] | undefined
      };
      return handleManageField(conn, validatedArgs);
    },
  },
  [MANAGE_FIELD_PERMISSIONS.name]: {
    definition: MANAGE_FIELD_PERMISSIONS,
    handler: (conn: any, args: unknown) => {
      const permArgs = args as Record<string, unknown>;
      if (!permArgs.operation || !permArgs.objectName || !permArgs.fieldName) {
        throw new Error('operation, objectName, and fieldName are required for field permissions management');
      }
      const validatedArgs: ManageFieldPermissionsArgs = {
        operation: permArgs.operation as 'grant' | 'revoke' | 'view',
        objectName: permArgs.objectName as string,
        fieldName: permArgs.fieldName as string,
        profileNames: permArgs.profileNames as string[] | undefined,
        readable: permArgs.readable as boolean | undefined,
        editable: permArgs.editable as boolean | undefined
      };
      return handleManageFieldPermissions(conn, validatedArgs);
    },
  },
  [SEARCH_ALL.name]: {
    definition: SEARCH_ALL,
    handler: (conn: any, args: unknown) => {
      const searchArgs = args as Record<string, unknown>;
      if (!searchArgs.searchTerm || !Array.isArray(searchArgs.objects)) {
        throw new Error('searchTerm and objects array are required for search');
      }
      const objects = searchArgs.objects as Array<Record<string, unknown>>;
      if (!objects.every(obj => obj.name && Array.isArray(obj.fields))) {
        throw new Error('Each object must specify name and fields array');
      }
      const validatedArgs: SearchAllArgs = {
        searchTerm: searchArgs.searchTerm as string,
        searchIn: searchArgs.searchIn as "ALL FIELDS" | "NAME FIELDS" | "EMAIL FIELDS" | "PHONE FIELDS" | "SIDEBAR FIELDS" | undefined,
        objects: objects.map(obj => ({
          name: obj.name as string,
          fields: obj.fields as string[],
          where: obj.where as string | undefined,
          orderBy: obj.orderBy as string | undefined,
          limit: obj.limit as number | undefined
        })),
        withClauses: searchArgs.withClauses as WithClause[] | undefined,
        updateable: searchArgs.updateable as boolean | undefined,
        viewable: searchArgs.viewable as boolean | undefined
      };
      return handleSearchAll(conn, validatedArgs);
    },
  },
  [READ_APEX.name]: {
    definition: READ_APEX,
    handler: (conn: any, args: unknown) => {
      const apexArgs = args as Record<string, unknown>;
      const validatedArgs: ReadApexArgs = {
        className: apexArgs.className as string | undefined,
        namePattern: apexArgs.namePattern as string | undefined,
        includeMetadata: apexArgs.includeMetadata as boolean | undefined
      };
      return handleReadApex(conn, validatedArgs);
    },
  },
  [WRITE_APEX.name]: {
    definition: WRITE_APEX,
    handler: (conn: any, args: unknown) => {
      const apexArgs = args as Record<string, unknown>;
      if (!apexArgs.operation || !apexArgs.className || !apexArgs.body) {
        throw new Error('operation, className, and body are required for writing Apex');
      }
      const validatedArgs: WriteApexArgs = {
        operation: apexArgs.operation as 'create' | 'update',
        className: apexArgs.className as string,
        apiVersion: apexArgs.apiVersion as string | undefined,
        body: apexArgs.body as string
      };
      return handleWriteApex(conn, validatedArgs);
    },
  },
  [READ_APEX_TRIGGER.name]: {
    definition: READ_APEX_TRIGGER,
    handler: (conn: any, args: unknown) => {
      const triggerArgs = args as Record<string, unknown>;
      const validatedArgs: ReadApexTriggerArgs = {
        triggerName: triggerArgs.triggerName as string | undefined,
        namePattern: triggerArgs.namePattern as string | undefined,
        includeMetadata: triggerArgs.includeMetadata as boolean | undefined
      };
      return handleReadApexTrigger(conn, validatedArgs);
    },
  },
  [WRITE_APEX_TRIGGER.name]: {
    definition: WRITE_APEX_TRIGGER,
    handler: (conn: any, args: unknown) => {
      const triggerArgs = args as Record<string, unknown>;
      if (!triggerArgs.operation || !triggerArgs.triggerName || !triggerArgs.body) {
        throw new Error('operation, triggerName, and body are required for writing Apex trigger');
      }
      const validatedArgs: WriteApexTriggerArgs = {
        operation: triggerArgs.operation as 'create' | 'update',
        triggerName: triggerArgs.triggerName as string,
        objectName: triggerArgs.objectName as string | undefined,
        apiVersion: triggerArgs.apiVersion as string | undefined,
        body: triggerArgs.body as string
      };
      return handleWriteApexTrigger(conn, validatedArgs);
    },
  },
  [EXECUTE_ANONYMOUS.name]: {
    definition: EXECUTE_ANONYMOUS,
    handler: (conn: any, args: unknown) => {
      const executeArgs = args as Record<string, unknown>;
      if (!executeArgs.apexCode) {
        throw new Error('apexCode is required for executing anonymous Apex');
      }
      const validatedArgs: ExecuteAnonymousArgs = {
        apexCode: executeArgs.apexCode as string,
        logLevel: executeArgs.logLevel as 'NONE' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'FINE' | 'FINER' | 'FINEST' | undefined
      };
      return handleExecuteAnonymous(conn, validatedArgs);
    },
  },
  [MANAGE_DEBUG_LOGS.name]: {
    definition: MANAGE_DEBUG_LOGS,
    handler: (conn: any, args: unknown) => {
      const debugLogsArgs = args as Record<string, unknown>;
      if (!debugLogsArgs.operation || !debugLogsArgs.username) {
        throw new Error('operation and username are required for managing debug logs');
      }
      const validatedArgs: ManageDebugLogsArgs = {
        operation: debugLogsArgs.operation as 'enable' | 'disable' | 'retrieve',
        username: debugLogsArgs.username as string,
        logLevel: debugLogsArgs.logLevel as 'NONE' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'FINE' | 'FINER' | 'FINEST' | undefined,
        expirationTime: debugLogsArgs.expirationTime as number | undefined,
        limit: debugLogsArgs.limit as number | undefined,
        logId: debugLogsArgs.logId as string | undefined,
        includeBody: debugLogsArgs.includeBody as boolean | undefined
      };
      return handleManageDebugLogs(conn, validatedArgs);
    },
  },
};

const server = new Server(
  {
    name: "salesforce-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.values(toolRegistry).map((tool) => tool.definition),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    if (!args) throw new Error('Arguments are required');

    const tool = toolRegistry[name as keyof typeof toolRegistry];
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const conn = await createSalesforceConnection();
    return await tool.handler(conn, args);
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Salesforce MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});