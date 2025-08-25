import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { MetadataInfo } from "../types/metadata.js";

export const MANAGE_OBJECT: Tool = {
  name: "MANAGE_OBJECT",
  description: `Create or update custom objects in Salesforce.
  - Create new custom objects with labels, name field configuration and sharing model
  - Update object labels, description, and sharing model
  Examples: Create Custom_Invoice__c with AutoNumber name field, Update sharing model to Private`,
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["create", "update"],
        description: "Whether to create a new object or update an existing one"
      },
      objectName: { type: "string", description: "API name of the object (e.g. 'Custom_Invoice__c')" },
      label: { type: "string", optional: true, description: "Label for the object" },
      pluralLabel: { type: "string", optional: true, description: "Plural label for the object" },
      description: { type: "string", optional: true, description: "Description for the object" },
      nameFieldLabel: { type: "string", optional: true, description: "Label for the Name field" },
      nameFieldType: { type: "string", enum: ["Text", "AutoNumber"], optional: true, description: "Type of the Name field" },
      nameFieldFormat: { type: "string", optional: true, description: "Display format for AutoNumber name field" },
      sharingModel: { type: "string", enum: ["ReadWrite", "Read", "Private", "ControlledByParent"], optional: true, description: "Sharing model for the object" }
    },
    required: ["operation", "objectName"]
  }
};

export interface ManageObjectArgs {
  operation: 'create' | 'update';
  objectName: string;
  label?: string;
  pluralLabel?: string;
  description?: string;
  nameFieldLabel?: string;
  nameFieldType?: 'Text' | 'AutoNumber';
  nameFieldFormat?: string;
  sharingModel?: 'ReadWrite' | 'Read' | 'Private' | 'ControlledByParent';
}

export async function manageObject(conn: any, args: ManageObjectArgs) {
  const { operation, objectName, label, pluralLabel, description, nameFieldLabel, nameFieldType, nameFieldFormat, sharingModel } = args;

  try {
    if (operation === 'create') {
      // Build metadata for creating a CustomObject
      const metadata: MetadataInfo = {
        fullName: objectName,
        label: label || objectName.replace(/__c$/, '').replace(/_/g, ' '),
        pluralLabel: pluralLabel,
        nameField: {
          type: nameFieldType || 'Text',
          label: nameFieldLabel || 'Name',
          ...(nameFieldType === 'AutoNumber' && nameFieldFormat ? { displayFormat: nameFieldFormat } : {})
        },
        deploymentStatus: 'Deployed',
        ...(sharingModel && { sharingModel }),
        ...(description && { description })
      };

      const result: any = await conn.metadata.create('CustomObject', metadata);

      if (result && (Array.isArray(result) ? result[0].success : result.success)) {
        return {
          content: [{ type: 'text', text: `Successfully created custom object ${objectName}` }],
          isError: false
        };
      }
      return {
        content: [{ type: 'text', text: `Failed to create custom object ${objectName}` }],
        isError: true
      };
    }

    // Update path
    const existing: any = await conn.metadata.read('CustomObject', [objectName]);
    const current = Array.isArray(existing) ? existing[0] : existing;

    if (!current) {
      return {
        content: [{ type: 'text', text: `Custom object ${objectName} not found` }],
        isError: true
      };
    }

    const updateMetadata: MetadataInfo = {
      ...current,
      ...(label && { label }),
      ...(pluralLabel && { pluralLabel }),
      ...(description && { description }),
      ...(sharingModel && { sharingModel }),
      nameField: {
        ...(current.nameField || {}),
        ...(nameFieldLabel && { label: nameFieldLabel }),
        ...(nameFieldType && { type: nameFieldType }),
        ...(nameFieldFormat && { displayFormat: nameFieldFormat })
      }
    };

    const updateResult: any = await conn.metadata.update('CustomObject', updateMetadata);
    if (updateResult && (Array.isArray(updateResult) ? updateResult[0].success : updateResult.success)) {
      return {
        content: [{ type: 'text', text: `Successfully updated custom object ${objectName}` }],
        isError: false
      };
    }

    return {
      content: [{ type: 'text', text: `Failed to update custom object ${objectName}` }],
      isError: true
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error managing object: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
}