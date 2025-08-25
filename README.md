# Salesforce Claude Desktop Extension

A powerful Claude Desktop Extension (DXT) that enables natural language interactions with Salesforce. Query, modify, and manage your Salesforce data and metadata directly through Claude.

## Features

### Data Operations
- **Query Records** - Use SOQL with relationship support
- **Aggregate Queries** - GROUP BY, COUNT, SUM, AVG functions
- **CRUD Operations** - Insert, update, delete, and upsert records
- **Global Search** - Search across multiple objects using SOSL

### Metadata Management
- **Object Management** - Create and modify custom objects
- **Field Management** - Create and update custom fields
- **Field-Level Security** - Manage field permissions for profiles
- **Schema Discovery** - Search and describe objects and fields

### Apex Development
- **Read/Write Classes** - Create and update Apex classes
- **Manage Triggers** - Create and update Apex triggers
- **Execute Anonymous** - Run Apex code directly
- **Debug Logs** - Configure and retrieve debug logs

## Installation

### Prerequisites
- Claude Desktop application
- Node.js 18+ installed
- Salesforce org with API access enabled

### Setup Steps

1. **Clone or download this extension**
```bash
git clone https://github.com/yourusername/salesforce-dxt.git
cd salesforce-dxt
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the extension**
```bash
npm run build
```

4. **Install in Claude Desktop**

Add the extension to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/extensions.json`
**Windows**: `%APPDATA%\Claude\extensions.json`
**Linux**: `~/.config/Claude/extensions.json`

```json
{
  "extensions": [
    {
      "id": "salesforce",
      "path": "/absolute/path/to/salesforce-dxt"
    }
  ]
}
```

5. **Restart Claude Desktop**

## Configuration

### Authentication Methods

The extension supports two authentication methods:

#### Option 1: Username/Password Authentication

1. In Claude Desktop, go to Extensions → Salesforce → Settings
2. Configure:
   - **Connection Type**: `User_Password`
   - **Instance URL**: Your Salesforce URL (default: `https://login.salesforce.com`)
   - **Username**: Your Salesforce username
   - **Password**: Your Salesforce password
   - **Security Token**: Your security token (get from Salesforce Settings → Personal → Reset Security Token)

#### Option 2: OAuth 2.0 Client Credentials

1. **Create a Connected App in Salesforce:**
   - Setup → Apps → App Manager → New Connected App
   - Enable OAuth Settings
   - Enable "Client Credentials Flow"
   - Set OAuth Scopes (minimum: `api`)
   - Save and note the Client ID and Client Secret

2. **Configure in Claude Desktop:**
   - **Connection Type**: `OAuth_2.0_Client_Credentials`
   - **Instance URL**: Your exact Salesforce instance URL (e.g., `https://your-domain.my.salesforce.com`)
   - **Client ID**: From your Connected App
   - **Client Secret**: From your Connected App

### Advanced Settings

- **API Version**: Salesforce API version (default: 58.0)
- **Timeout**: Request timeout in milliseconds (default: 30000)
- **Log Level**: Logging verbosity (error, warn, info, debug)

## Usage Examples

### Searching Objects
```
"Find all objects related to Accounts"
"Show me custom objects for orders"
```

### Querying Data
```
"Get all Accounts created this month"
"Show me Opportunities over $100k with their Account names"
"Count opportunities by stage"
```

### Managing Metadata
```
"Create a Customer_Feedback__c object"
"Add a Rating picklist field to Account"
"Grant System Administrator access to Custom_Field__c"
```

### Working with Apex
```
"Show me the AccountController class"
"Create a trigger for Opportunity object"
"Execute Apex code to update account ratings"
```

### Debug Logs
```
"Enable debug logs for user@example.com"
"Retrieve recent debug logs"
```

## Tool Reference

| Tool | Description |
|------|------------|
| `salesforce_search_objects` | Search for objects by name pattern |
| `salesforce_describe_object` | Get detailed schema information |
| `salesforce_query_records` | Query records with SOQL |
| `salesforce_aggregate_query` | Execute aggregate queries with GROUP BY |
| `salesforce_dml_records` | Insert, update, delete, upsert records |
| `salesforce_manage_object` | Create/update custom objects |
| `salesforce_manage_field` | Create/update custom fields |
| `salesforce_manage_field_permissions` | Manage field-level security |
| `salesforce_search_all` | Search across multiple objects (SOSL) |
| `salesforce_read_apex` | Read Apex classes |
| `salesforce_write_apex` | Create/update Apex classes |
| `salesforce_read_apex_trigger` | Read Apex triggers |
| `salesforce_write_apex_trigger` | Create/update Apex triggers |
| `salesforce_execute_anonymous` | Execute anonymous Apex |
| `salesforce_manage_debug_logs` | Manage debug logs |

## Troubleshooting

### Connection Issues
- Verify your credentials are correct
- Check that your IP is whitelisted in Salesforce (Setup → Network Access)
- For OAuth, ensure the Connected App is properly configured
- Check that API access is enabled for your user profile

### Permission Errors
- Ensure your user has appropriate object and field permissions
- Check that API access is enabled for your profile
- Verify CRUD permissions for the objects you're accessing

### Timeout Errors
- Increase the timeout value in settings
- Optimize queries to return fewer records
- Use LIMIT clauses in queries

### Debug Mode
Enable debug logging to see detailed information:
1. Set Log Level to "debug" in extension settings
2. Check Claude Desktop logs for detailed error messages

## Security Notes

- Credentials are stored securely by Claude Desktop
- Never share your security token or client secret
- Use a dedicated integration user when possible
- Follow Salesforce security best practices
- Regularly rotate your security tokens

## Development

### Building from Source
```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch mode for development
npm run dev

# Run tests
npm test
```

### Project Structure
```
salesforce-dxt/
├── manifest.json       # Extension manifest
├── src/
│   └── index.ts       # Main MCP server implementation
├── dist/              # Compiled JavaScript (generated)
├── package.json       # Dependencies
├── tsconfig.json      # TypeScript configuration
└── README.md          # Documentation
```

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests:
- Create an issue on [GitHub](https://github.com/yourusername/salesforce-dxt/issues)
- Check existing issues for solutions
- Consult Salesforce documentation for API details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Acknowledgments

- Built on the [Model Context Protocol SDK](https://github.com/anthropics/mcp-sdk)
- Uses [jsforce](https://jsforce.github.io/) for Salesforce API access
- Based on the original Salesforce MCP Server