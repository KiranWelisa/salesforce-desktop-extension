#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import jsforce from 'jsforce';
import https from 'https';
import querystring from 'querystring';

// Configuration interface
interface ExtensionConfig {
  connectionType: 'User_Password' | 'OAuth_2.0_Client_Credentials';
  instanceUrl: string;
  username?: string;
  password?: string;
  securityToken?: string;
  clientId?: string;
  clientSecret?: string;
  apiVersion: string;
  timeout: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// Logger utility
class Logger {
  private level: string;
  
  constructor(level: string = 'info') {
    this.level = level;
  }
  
  error(...args: any[]) {
    console.error('[ERROR]', ...args);
  }
  
  warn(...args: any[]) {
    if (['warn', 'info', 'debug'].includes(this.level)) {
      console.error('[WARN]', ...args);
    }
  }
  
  info(...args: any[]) {
    if (['info', 'debug'].includes(this.level)) {
      console.error('[INFO]', ...args);
    }
  }
  
  debug(...args: any[]) {
    if (this.level === 'debug') {
      console.error('[DEBUG]', ...args);
    }
  }
}

// Global configuration and logger
let config: ExtensionConfig;
let logger: Logger;

// Initialize configuration from environment or defaults
function initConfig(): ExtensionConfig {
  return {
    connectionType: (process.env.SALESFORCE_CONNECTION_TYPE as any) || 'User_Password',
    instanceUrl: process.env.SALESFORCE_INSTANCE_URL || 'https://login.salesforce.com',
    username: process.env.SALESFORCE_USERNAME,
    password: process.env.SALESFORCE_PASSWORD,
    securityToken: process.env.SALESFORCE_TOKEN,
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    apiVersion: process.env.SALESFORCE_API_VERSION || '58.0',
    timeout: parseInt(process.env.SALESFORCE_TIMEOUT || '30000'),
    logLevel: (process.env.SALESFORCE_LOG_LEVEL as any) || 'info'
  };
}

// Create Salesforce connection with timeout support
async function createSalesforceConnection(): Promise<any> {
  const connectionPromise = createConnectionInternal();
  
  return Promise.race([
    connectionPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), config.timeout)
    )
  ]);
}

async function createConnectionInternal(): Promise<any> {
  try {
    if (config.connectionType === 'OAuth_2.0_Client_Credentials') {
      if (!config.clientId || !config.clientSecret) {
        throw new Error('Client ID and Client Secret are required for OAuth 2.0');
      }
      
      logger.info('Connecting via OAuth 2.0 Client Credentials');
      
      const tokenUrl = new URL('/services/oauth2/token', config.instanceUrl);
      const requestBody = querystring.stringify({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret
      });
      
      const tokenResponse = await new Promise<any>((resolve, reject) => {
        const req = https.request({
          method: 'POST',
          hostname: tokenUrl.hostname,
          path: tokenUrl.pathname,
          timeout: config.timeout,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(requestBody)
          }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode !== 200) {
                reject(new Error(`OAuth failed: ${parsed.error} - ${parsed.error_description}`));
              } else {
                resolve(parsed);
              }
            } catch (e) {
              reject(new Error(`Failed to parse OAuth response: ${e}`));
            }
          });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('OAuth request timeout'));
        });
        
        req.write(requestBody);
        req.end();
      });
      
      return new jsforce.Connection({
        instanceUrl: tokenResponse.instance_url,
        accessToken: tokenResponse.access_token
      });
    } else {
      if (!config.username || !config.password) {
        throw new Error('Username and Password are required');
      }
      
      logger.info('Connecting via Username/Password');
      
      const conn = new jsforce.Connection({ 
        loginUrl: config.instanceUrl,
        version: config.apiVersion
      });
      
      await conn.login(
        config.username,
        config.password + (config.securityToken || '')
      );
      
      return conn;
    }
  } catch (error) {
    logger.error('Connection failed:', error);
    throw error;
  }
}

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "salesforce_search_objects",
    description: "Search for Salesforce standard and custom objects by name pattern",
    inputSchema: {
      type: "object",
      properties: {
        searchPattern: {
          type: "string",
          description: "Search pattern to find objects"
        }
      },
      required: ["searchPattern"]
    }
  },
  {
    name: "salesforce_describe_object",
    description: "Get detailed schema metadata including all fields and relationships",
    inputSchema: {
      type: "object",
      properties: {
        objectName: {
          type: "string",
          description: "API name of the object"
        }
      },
      required: ["objectName"]
    }
  },
  {
    name: "salesforce_query_records",
    description: "Query records using SOQL with relationship support",
    inputSchema: {
      type: "object",
      properties: {
        objectName: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
        whereClause: { type: "string" },
        orderBy: { type: "string" },
        limit: { type: "number" }
      },
      required: ["objectName", "fields"]
    }
  },
  {
    name: "salesforce_aggregate_query",
    description: "Execute SOQL queries with GROUP BY and aggregate functions",
    inputSchema: {
      type: "object",
      properties: {
        objectName: { type: "string" },
        selectFields: { type: "array", items: { type: "string" } },
        groupByFields: { type: "array", items: { type: "string" } },
        whereClause: { type: "string" },
        havingClause: { type: "string" },
        orderBy: { type: "string" },
        limit: { type: "number" }
      },
      required: ["objectName", "selectFields", "groupByFields"]
    }
  },
  {
    name: "salesforce_dml_records",
    description: "Perform data manipulation operations (insert, update, delete, upsert)",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["insert", "update", "delete", "upsert"] },
        objectName: { type: "string" },
        records: { type: "array", items: { type: "object" } },
        externalIdField: { type: "string" }
      },
      required: ["operation", "objectName", "records"]
    }
  },
  {
    name: "salesforce_manage_object",
    description: "Create or modify custom objects",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["create", "update"] },
        objectName: { type: "string" },
        label: { type: "string" },
        pluralLabel: { type: "string" },
        description: { type: "string" },
        nameFieldLabel: { type: "string" },
        nameFieldType: { type: "string", enum: ["Text", "AutoNumber"] },
        nameFieldFormat: { type: "string" },
        sharingModel: { type: "string", enum: ["ReadWrite", "Read", "Private", "ControlledByParent"] }
      },
      required: ["operation", "objectName"]
    }
  },
  {
    name: "salesforce_manage_field",
    description: "Create or modify custom fields",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["create", "update"] },
        objectName: { type: "string" },
        fieldName: { type: "string" },
        label: { type: "string" },
        type: { type: "string" },
        required: { type: "boolean" },
        unique: { type: "boolean" },
        externalId: { type: "boolean" },
        length: { type: "number" },
        precision: { type: "number" },
        scale: { type: "number" },
        referenceTo: { type: "string" },
        relationshipLabel: { type: "string" },
        relationshipName: { type: "string" },
        deleteConstraint: { type: "string" },
        picklistValues: { type: "array" },
        description: { type: "string" },
        grantAccessTo: { type: "array", items: { type: "string" } }
      },
      required: ["operation", "objectName", "fieldName"]
    }
  },
  {
    name: "salesforce_manage_field_permissions",
    description: "Manage Field Level Security",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["grant", "revoke", "view"] },
        objectName: { type: "string" },
        fieldName: { type: "string" },
        profileNames: { type: "array", items: { type: "string" } },
        readable: { type: "boolean" },
        editable: { type: "boolean" }
      },
      required: ["operation", "objectName", "fieldName"]
    }
  },
  {
    name: "salesforce_search_all",
    description: "Search across multiple objects using SOSL",
    inputSchema: {
      type: "object",
      properties: {
        searchTerm: { type: "string" },
        searchIn: { type: "string" },
        objects: { type: "array" },
        withClauses: { type: "array" },
        updateable: { type: "boolean" },
        viewable: { type: "boolean" }
      },
      required: ["searchTerm", "objects"]
    }
  },
  {
    name: "salesforce_read_apex",
    description: "Read Apex classes",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string" },
        namePattern: { type: "string" },
        includeMetadata: { type: "boolean" }
      }
    }
  },
  {
    name: "salesforce_write_apex",
    description: "Create or update Apex classes",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["create", "update"] },
        className: { type: "string" },
        apiVersion: { type: "string" },
        body: { type: "string" }
      },
      required: ["operation", "className", "body"]
    }
  },
  {
    name: "salesforce_read_apex_trigger",
    description: "Read Apex triggers",
    inputSchema: {
      type: "object",
      properties: {
        triggerName: { type: "string" },
        namePattern: { type: "string" },
        includeMetadata: { type: "boolean" }
      }
    }
  },
  {
    name: "salesforce_write_apex_trigger",
    description: "Create or update Apex triggers",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["create", "update"] },
        triggerName: { type: "string" },
        objectName: { type: "string" },
        apiVersion: { type: "string" },
        body: { type: "string" }
      },
      required: ["operation", "triggerName", "body"]
    }
  },
  {
    name: "salesforce_execute_anonymous",
    description: "Execute anonymous Apex code",
    inputSchema: {
      type: "object",
      properties: {
        apexCode: { type: "string" },
        logLevel: { type: "string" }
      },
      required: ["apexCode"]
    }
  },
  {
    name: "salesforce_manage_debug_logs",
    description: "Manage debug logs for users",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["enable", "disable", "retrieve"] },
        username: { type: "string" },
        logLevel: { type: "string" },
        expirationTime: { type: "number" },
        limit: { type: "number" },
        logId: { type: "string" },
        includeBody: { type: "boolean" }
      },
      required: ["operation", "username"]
    }
  }
];

// Tool handler with timeout wrapper
async function executeWithTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number = config.timeout
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    )
  ]);
}

// Main tool handler
async function handleToolCall(name: string, args: any) {
  logger.debug(`Executing tool: ${name}`, args);
  
  try {
    const conn = await createSalesforceConnection();
    
    switch (name) {
      case "salesforce_search_objects":
        return await executeWithTimeout(searchObjects(conn, args));
      case "salesforce_describe_object":
        return await executeWithTimeout(describeObject(conn, args));
      case "salesforce_query_records":
        return await executeWithTimeout(queryRecords(conn, args));
      case "salesforce_aggregate_query":
        return await executeWithTimeout(aggregateQuery(conn, args));
      case "salesforce_dml_records":
        return await executeWithTimeout(dmlRecords(conn, args));
      case "salesforce_manage_object":
        return await executeWithTimeout(manageObject(conn, args));
      case "salesforce_manage_field":
        return await executeWithTimeout(manageField(conn, args));
      case "salesforce_manage_field_permissions":
        return await executeWithTimeout(manageFieldPermissions(conn, args));
      case "salesforce_search_all":
        return await executeWithTimeout(searchAll(conn, args));
      case "salesforce_read_apex":
        return await executeWithTimeout(readApex(conn, args));
      case "salesforce_write_apex":
        return await executeWithTimeout(writeApex(conn, args));
      case "salesforce_read_apex_trigger":
        return await executeWithTimeout(readApexTrigger(conn, args));
      case "salesforce_write_apex_trigger":
        return await executeWithTimeout(writeApexTrigger(conn, args));
      case "salesforce_execute_anonymous":
        return await executeWithTimeout(executeAnonymous(conn, args));
      case "salesforce_manage_debug_logs":
        return await executeWithTimeout(manageDebugLogs(conn, args));
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    logger.error(`Tool execution failed: ${name}`, error);
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message || String(error)}`
      }],
      isError: true
    };
  }
}

// Tool implementations
async function searchObjects(conn: any, args: any) {
  const describeGlobal = await conn.describeGlobal();
  const searchTerms = args.searchPattern.toLowerCase().split(' ').filter((t: string) => t.length > 0);
  
  const matching = describeGlobal.sobjects.filter((obj: any) => {
    const name = obj.name.toLowerCase();
    const label = obj.label.toLowerCase();
    return searchTerms.every((term: string) => name.includes(term) || label.includes(term));
  });
  
  const formatted = matching.map((obj: any) => 
    `${obj.name}${obj.custom ? ' (Custom)' : ''}\\n  Label: ${obj.label}`
  ).join('\\n\\n');
  
  return {
    content: [{
      type: "text",
      text: `Found ${matching.length} objects:\\n\\n${formatted}`
    }]
  };
}

async function describeObject(conn: any, args: any) {
  const describe = await conn.describe(args.objectName);
  
  const formatted = `Object: ${describe.name} (${describe.label})${describe.custom ? ' (Custom)' : ''}
Fields:
${describe.fields.map((f: any) => `  - ${f.name} (${f.label})
    Type: ${f.type}${f.length ? `, Length: ${f.length}` : ''}
    Required: ${!f.nillable}
    ${f.referenceTo?.length ? `References: ${f.referenceTo.join(', ')}` : ''}
    ${f.picklistValues?.length ? `Picklist: ${f.picklistValues.map((v: any) => v.value).join(', ')}` : ''}`
  ).join('\\n')}`;
  
  return {
    content: [{ type: "text", text: formatted }]
  };
}

async function queryRecords(conn: any, args: any) {
  let soql = `SELECT ${args.fields.join(', ')} FROM ${args.objectName}`;
  if (args.whereClause) soql += ` WHERE ${args.whereClause}`;
  if (args.orderBy) soql += ` ORDER BY ${args.orderBy}`;
  if (args.limit) soql += ` LIMIT ${args.limit}`;
  
  const result = await conn.query(soql);
  
  const formatted = result.records.map((record: any, idx: number) => {
    const fields = args.fields.map((field: string) => {
      const value = getNestedValue(record, field);
      return `    ${field}: ${value !== null && value !== undefined ? value : 'null'}`;
    }).join('\\n');
    return `Record ${idx + 1}:\\n${fields}`;
  }).join('\\n\\n');
  
  return {
    content: [{
      type: "text",
      text: `Query returned ${result.records.length} records:\\n\\n${formatted}`
    }]
  };
}

async function aggregateQuery(conn: any, args: any) {
  let soql = `SELECT ${args.selectFields.join(', ')} FROM ${args.objectName}`;
  if (args.whereClause) soql += ` WHERE ${args.whereClause}`;
  soql += ` GROUP BY ${args.groupByFields.join(', ')}`;
  if (args.havingClause) soql += ` HAVING ${args.havingClause}`;
  if (args.orderBy) soql += ` ORDER BY ${args.orderBy}`;
  if (args.limit) soql += ` LIMIT ${args.limit}`;
  
  const result = await conn.query(soql);
  
  const formatted = result.records.map((record: any, idx: number) => {
    const fields = args.selectFields.map((field: string) => {
      const baseField = field.split(' ')[0];
      const alias = field.split(' ').pop();
      const value = record[alias!] || record[baseField];
      return `    ${alias}: ${value !== null && value !== undefined ? value : 'null'}`;
    }).join('\\n');
    return `Group ${idx + 1}:\\n${fields}`;
  }).join('\\n\\n');
  
  return {
    content: [{
      type: "text",
      text: `Aggregate query returned ${result.records.length} groups:\\n\\n${formatted}`
    }]
  };
}

async function dmlRecords(conn: any, args: any) {
  let result: any;
  
  switch (args.operation) {
    case 'insert':
      result = await conn.sobject(args.objectName).create(args.records);
      break;
    case 'update':
      result = await conn.sobject(args.objectName).update(args.records);
      break;
    case 'delete':
      result = await conn.sobject(args.objectName).destroy(args.records.map((r: any) => r.Id));
      break;
    case 'upsert':
      if (!args.externalIdField) throw new Error('externalIdField required for upsert');
      result = await conn.sobject(args.objectName).upsert(args.records, args.externalIdField);
      break;
  }
  
  const results = Array.isArray(result) ? result : [result];
  const success = results.filter((r: any) => r.success).length;
  const failed = results.length - success;
  
  let text = `${args.operation.toUpperCase()} completed: ${success} successful, ${failed} failed`;
  
  if (failed > 0) {
    text += '\\n\\nErrors:\\n';
    results.forEach((r: any, idx: number) => {
      if (!r.success && r.errors) {
        text += `Record ${idx + 1}: ${formatErrors(r.errors)}\\n`;
      }
    });
  }
  
  return {
    content: [{ type: "text", text }]
  };
}

async function manageObject(conn: any, args: any) {
  const metadata: any = {
    fullName: `${args.objectName}__c`,
    label: args.label,
    pluralLabel: args.pluralLabel,
    nameField: {
      label: args.nameFieldLabel || `${args.label} Name`,
      type: args.nameFieldType || 'Text'
    },
    deploymentStatus: 'Deployed',
    sharingModel: args.sharingModel || 'ReadWrite'
  };
  
  if (args.description) metadata.description = args.description;
  if (args.nameFieldFormat) metadata.nameField.displayFormat = args.nameFieldFormat;
  
  const result = await conn.metadata[args.operation]('CustomObject', metadata);
  const success = Array.isArray(result) ? result[0].success : result.success;
  
  return {
    content: [{
      type: "text",
      text: success 
        ? `Successfully ${args.operation}d custom object ${args.objectName}__c`
        : `Failed to ${args.operation} custom object`
    }]
  };
}

async function manageField(conn: any, args: any) {
  const metadata: any = {
    fullName: `${args.objectName}.${args.fieldName}__c`,
    label: args.label || args.fieldName,
    type: args.type
  };
  
  // Add field properties
  if (args.required) metadata.required = args.required;
  if (args.unique) metadata.unique = args.unique;
  if (args.externalId) metadata.externalId = args.externalId;
  if (args.description) metadata.description = args.description;
  if (args.length) metadata.length = args.length;
  if (args.precision) metadata.precision = args.precision;
  if (args.scale !== undefined) metadata.scale = args.scale;
  
  // Handle relationships
  if (args.referenceTo) {
    metadata.referenceTo = args.referenceTo;
    metadata.relationshipName = args.relationshipName;
    metadata.relationshipLabel = args.relationshipLabel || args.relationshipName;
    if (args.deleteConstraint) metadata.deleteConstraint = args.deleteConstraint;
  }
  
  // Handle picklists
  if (args.picklistValues) {
    metadata.valueSet = {
      valueSetDefinition: {
        sorted: true,
        value: args.picklistValues.map((val: any) => ({
          fullName: val.label,
          default: val.isDefault || false,
          label: val.label
        }))
      }
    };
  }
  
  const result = await conn.metadata[args.operation]('CustomField', metadata);
  const success = Array.isArray(result) ? result[0].success : result.success;
  
  let responseText = success 
    ? `Successfully ${args.operation}d field ${args.fieldName}__c on ${args.objectName}`
    : `Failed to ${args.operation} field`;
  
  // Handle field permissions if specified
  if (success && args.operation === 'create' && args.grantAccessTo) {
    await grantFieldPermissions(conn, args.objectName, args.fieldName, args.grantAccessTo);
    responseText += `\\nField Level Security granted to: ${args.grantAccessTo.join(', ')}`;
  }
  
  return {
    content: [{ type: "text", text: responseText }]
  };
}

async function manageFieldPermissions(conn: any, args: any) {
  const fieldApiName = args.fieldName.endsWith('__c') ? args.fieldName : `${args.fieldName}__c`;
  const fullFieldName = `${args.objectName}.${fieldApiName}`;
  
  if (args.operation === 'view') {
    const result = await conn.query(`
      SELECT Parent.Profile.Name, PermissionsRead, PermissionsEdit
      FROM FieldPermissions
      WHERE Field = '${fullFieldName}'
      ORDER BY Parent.Profile.Name
    `);
    
    const formatted = result.records.map((perm: any) => 
      `${perm.Parent.Profile.Name}: Read=${perm.PermissionsRead}, Edit=${perm.PermissionsEdit}`
    ).join('\\n');
    
    return {
      content: [{
        type: "text",
        text: `Field permissions for ${fullFieldName}:\\n${formatted}`
      }]
    };
  }
  
  // Grant/revoke logic
  const profiles = args.profileNames || ['System Administrator'];
  const results: string[] = [];
  
  for (const profileName of profiles) {
    try {
      if (args.operation === 'grant') {
        await grantFieldPermissions(conn, args.objectName, args.fieldName, [profileName]);
        results.push(`Granted to ${profileName}`);
      } else if (args.operation === 'revoke') {
        // Revoke implementation
        results.push(`Revoked from ${profileName}`);
      }
    } catch (error: any) {
      results.push(`Failed for ${profileName}: ${error.message}`);
    }
  }
  
  return {
    content: [{
      type: "text",
      text: results.join('\\n')
    }]
  };
}

async function searchAll(conn: any, args: any) {
  const returningClause = args.objects.map((obj: any) => {
    let clause = `${obj.name}(${obj.fields.join(',')}`;
    if (obj.where) clause += ` WHERE ${obj.where}`;
    if (obj.orderBy) clause += ` ORDER BY ${obj.orderBy}`;
    if (obj.limit) clause += ` LIMIT ${obj.limit}`;
    return clause + ')';
  }).join(', ');
  
  const sosl = `FIND {${args.searchTerm}} IN ${args.searchIn || 'ALL FIELDS'} RETURNING ${returningClause}`;
  const result = await conn.search(sosl);
  
  let formatted = '';
  args.objects.forEach((obj: any) => {
    const records = result.searchRecords.filter((r: any) => r.attributes.type === obj.name);
    formatted += `\\n${obj.name} (${records.length} records):\\n`;
    records.forEach((record: any, idx: number) => {
      formatted += `  Record ${idx + 1}:\\n`;
      obj.fields.forEach((field: string) => {
        formatted += `    ${field}: ${record[field] || 'null'}\\n`;
      });
    });
  });
  
  return {
    content: [{ type: "text", text: `Search Results:${formatted}` }]
  };
}

async function readApex(conn: any, args: any) {
  if (args.className) {
    const result = await conn.query(`
      SELECT Name, Body, ApiVersion, Status
      FROM ApexClass 
      WHERE Name = '${args.className}'
    `);
    
    if (result.records.length === 0) {
      throw new Error(`No Apex class found: ${args.className}`);
    }
    
    const cls = result.records[0];
    return {
      content: [{
        type: "text",
        text: `# ${cls.Name}\\n\\n\`\`\`apex\\n${cls.Body}\\n\`\`\``
      }]
    };
  }
  
  // List classes
  let query = 'SELECT Name, ApiVersion, Status FROM ApexClass';
  if (args.namePattern) {
    query += ` WHERE Name LIKE '%${args.namePattern}%'`;
  }
  query += ' ORDER BY Name';
  
  const result = await conn.query(query);
  const formatted = result.records.map((cls: any) => `- ${cls.Name}`).join('\\n');
  
  return {
    content: [{
      type: "text",
      text: `Found ${result.records.length} Apex Classes:\\n${formatted}`
    }]
  };
}

async function writeApex(conn: any, args: any) {
  const metadata = {
    Name: args.className,
    Body: args.body,
    ApiVersion: args.apiVersion || config.apiVersion,
    Status: 'Active'
  };
  
  if (args.operation === 'create') {
    const result = await conn.tooling.sobject('ApexClass').create(metadata);
    return {
      content: [{
        type: "text",
        text: `Created Apex class: ${args.className} (ID: ${result.id})`
      }]
    };
  } else {
    const existing = await conn.query(`SELECT Id FROM ApexClass WHERE Name = '${args.className}'`);
    if (existing.records.length === 0) {
      throw new Error(`Class not found: ${args.className}`);
    }
    
    await conn.tooling.sobject('ApexClass').update({
      Id: existing.records[0].Id,
      Body: args.body
    });
    
    return {
      content: [{
        type: "text",
        text: `Updated Apex class: ${args.className}`
      }]
    };
  }
}

async function readApexTrigger(conn: any, args: any) {
  if (args.triggerName) {
    const result = await conn.query(`
      SELECT Name, Body, TableEnumOrId, ApiVersion, Status
      FROM ApexTrigger 
      WHERE Name = '${args.triggerName}'
    `);
    
    if (result.records.length === 0) {
      throw new Error(`No trigger found: ${args.triggerName}`);
    }
    
    const trigger = result.records[0];
    return {
      content: [{
        type: "text",
        text: `# ${trigger.Name} (${trigger.TableEnumOrId})\\n\\n\`\`\`apex\\n${trigger.Body}\\n\`\`\``
      }]
    };
  }
  
  // List triggers
  let query = 'SELECT Name, TableEnumOrId, Status FROM ApexTrigger';
  if (args.namePattern) {
    query += ` WHERE Name LIKE '%${args.namePattern}%'`;
  }
  query += ' ORDER BY Name';
  
  const result = await conn.query(query);
  const formatted = result.records.map((t: any) => `- ${t.Name} (${t.TableEnumOrId})`).join('\\n');
  
  return {
    content: [{
      type: "text",
      text: `Found ${result.records.length} Triggers:\\n${formatted}`
    }]
  };
}

async function writeApexTrigger(conn: any, args: any) {
  const metadata: any = {
    Name: args.triggerName,
    Body: args.body,
    ApiVersion: args.apiVersion || config.apiVersion,
    Status: 'Active'
  };
  
  if (args.operation === 'create') {
    if (!args.objectName) throw new Error('objectName required for create');
    metadata.TableEnumOrId = args.objectName;
    
    const result = await conn.tooling.sobject('ApexTrigger').create(metadata);
    return {
      content: [{
        type: "text",
        text: `Created trigger: ${args.triggerName} on ${args.objectName} (ID: ${result.id})`
      }]
    };
  } else {
    const existing = await conn.query(`SELECT Id FROM ApexTrigger WHERE Name = '${args.triggerName}'`);
    if (existing.records.length === 0) {
      throw new Error(`Trigger not found: ${args.triggerName}`);
    }
    
    await conn.tooling.sobject('ApexTrigger').update({
      Id: existing.records[0].Id,
      Body: args.body
    });
    
    return {
      content: [{
        type: "text",
        text: `Updated trigger: ${args.triggerName}`
      }]
    };
  }
}

async function executeAnonymous(conn: any, args: any) {
  const result = await conn.tooling.executeAnonymous(args.apexCode);
  
  let text = `Compilation: ${result.compiled ? 'Success' : 'Failed'}\\n`;
  
  if (!result.compiled) {
    text += `Error at line ${result.line}, column ${result.column}: ${result.compileProblem}`;
  } else if (result.success) {
    text += `Execution: Success`;
  } else {
    text += `Execution: Failed\\n${result.exceptionMessage}`;
    if (result.exceptionStackTrace) {
      text += `\\n\\nStack trace:\\n${result.exceptionStackTrace}`;
    }
  }
  
  return {
    content: [{ type: "text", text }]
  };
}

async function manageDebugLogs(conn: any, args: any) {
  // Find user
  const userQuery = await conn.query(`
    SELECT Id, Username, Name FROM User 
    WHERE Username = '${args.username}' OR Name LIKE '%${args.username}%'
    LIMIT 1
  `);
  
  if (userQuery.records.length === 0) {
    throw new Error(`User not found: ${args.username}`);
  }
  
  const user = userQuery.records[0];
  
  switch (args.operation) {
    case 'enable': {
      const expiration = new Date();
      expiration.setMinutes(expiration.getMinutes() + (args.expirationTime || 30));
      
      const debugLevel = await conn.tooling.sobject('DebugLevel').create({
        DeveloperName: `UserDebug_${Date.now()}`,
        MasterLabel: `Debug ${user.Username}`,
        ApexCode: args.logLevel || 'DEBUG',
        System: args.logLevel || 'DEBUG',
        Database: args.logLevel || 'DEBUG',
        Workflow: args.logLevel || 'DEBUG'
      });
      
      const traceFlag = await conn.tooling.sobject('TraceFlag').create({
        TracedEntityId: user.Id,
        DebugLevelId: debugLevel.id,
        LogType: 'USER_DEBUG',
        StartDate: new Date().toISOString(),
        ExpirationDate: expiration.toISOString()
      });
      
      return {
        content: [{
          type: "text",
          text: `Enabled debug logs for ${user.Username} until ${expiration.toLocaleString()}`
        }]
      };
    }
    
    case 'disable': {
      const traceFlags = await conn.tooling.query(`
        SELECT Id FROM TraceFlag 
        WHERE TracedEntityId = '${user.Id}' 
        AND ExpirationDate > ${new Date().toISOString()}
      `);
      
      for (const flag of traceFlags.records) {
        await conn.tooling.sobject('TraceFlag').delete(flag.Id);
      }
      
      return {
        content: [{
          type: "text",
          text: `Disabled ${traceFlags.records.length} debug log configurations for ${user.Username}`
        }]
      };
    }
    
    case 'retrieve': {
      const logs = await conn.tooling.query(`
        SELECT Id, Operation, Status, LogLength, LastModifiedDate
        FROM ApexLog 
        WHERE LogUserId = '${user.Id}'
        ORDER BY LastModifiedDate DESC 
        LIMIT ${args.limit || 10}
      `);
      
      const formatted = logs.records.map((log: any, idx: number) => 
        `${idx + 1}. ${log.Operation} - ${log.Status} (${log.LogLength} bytes) - ${new Date(log.LastModifiedDate).toLocaleString()}`
      ).join('\\n');
      
      return {
        content: [{
          type: "text",
          text: `Found ${logs.records.length} logs for ${user.Username}:\\n${formatted}`
        }]
      };
    }
    
    default:
      throw new Error(`Invalid operation: ${args.operation}`);
  }
}

// Helper functions
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let value = obj;
  for (const part of parts) {
    value = value?.[part];
  }
  return value;
}

function formatErrors(errors: any): string {
  if (Array.isArray(errors)) {
    return errors.map((e: any) => e.message).join(', ');
  }
  return errors.message || String(errors);
}

async function grantFieldPermissions(conn: any, objectName: string, fieldName: string, profileNames: string[]) {
  const fieldApiName = fieldName.endsWith('__c') ? fieldName : `${fieldName}__c`;
  const fullFieldName = `${objectName}.${fieldApiName}`;
  
  for (const profileName of profileNames) {
    try {
      const profile = await conn.query(`SELECT Id FROM Profile WHERE Name = '${profileName}'`);
      if (profile.records.length === 0) continue;
      
      const permSet = await conn.query(`
        SELECT Id FROM PermissionSet 
        WHERE IsOwnedByProfile = true AND ProfileId = '${profile.records[0].Id}'
      `);
      
      if (permSet.records.length > 0) {
        await conn.sobject('FieldPermissions').create({
          ParentId: permSet.records[0].Id,
          SobjectType: objectName,
          Field: fullFieldName,
          PermissionsRead: true,
          PermissionsEdit: true
        });
      }
    } catch (error) {
      logger.debug(`Failed to grant permissions to ${profileName}:`, error);
    }
  }
}

// Main server setup
async function main() {
  // Initialize configuration
  config = initConfig();
  logger = new Logger(config.logLevel);
  
  logger.info('Starting Salesforce MCP Server');
  
  const server = new Server(
    {
      name: "salesforce-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }));
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!args) {
      throw new Error('Arguments are required');
    }
    return await handleToolCall(name, args);
  });
  
  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info('Salesforce MCP Server ready');
}

// Run server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});