# Salesforce Claude Desktop Extension

A powerful Claude Desktop Extension (DXT) that enables natural language interactions with Salesforce. Query, modify, and manage your Salesforce data and metadata directly through Claude.

## Features

- **Query & DML**: SOQL queries, aggregate queries, and full CRUD operations.
- **Metadata Management**: Create and manage custom objects, fields, and field-level security.
- **Apex Development**: Read, write, and execute Apex classes and triggers.
- **Search**: SOSL search across multiple objects.
- **Debugging**: Manage and retrieve debug logs for users.

## Installation

### Prerequisites
- Claude Desktop application
- Salesforce org with API access enabled

### Setup Steps

1.  **Download the Extension**: Download the latest `salesforce-dxt-vX.Y.Z.dxt` file from the releases page.
2.  **Install in Claude Desktop**: Double-click the downloaded `.dxt` file. Claude Desktop will open and prompt you to install the extension.
3.  **Configure the Extension**:
    * After installation, click the "Settings" button for the Salesforce extension.
    * Choose your preferred **Connection Type**.
    * Fill in the required credentials for your chosen authentication method.
    * Click "Save".
4.  **Restart Claude Desktop**: Restart the application for the changes to take effect. You are now ready to use the extension!

## Configuration

The extension supports two authentication methods, configurable in the settings UI:

#### Option 1: Username/Password Authentication

-   **Connection Type**: `Username & Password`
-   **Instance URL**: Your Salesforce login URL (e.g., `https://login.salesforce.com`).
-   **Username**: Your Salesforce username.
-   **Password**: Your Salesforce password.
-   **Security Token**: Your security token.

#### Option 2: OAuth 2.0 Client Credentials

-   **Connection Type**: `OAuth 2.0 Client Credentials`
-   **Instance URL**: Your exact Salesforce instance URL (e.g., `https://your-domain.my.salesforce.com`).
-   **Client ID**: From your Salesforce Connected App.
-   **Client Secret**: From your Salesforce Connected App.

## Usage Examples

- **Querying Data**: *"Show me all Accounts in the Technology industry with their open Opportunities"*
- **Managing Metadata**: *"Create a new custom object named 'Feedback' with a 'Comment' text area field"*
- **Working with Apex**: *"Show me the source code for the 'AccountController' Apex class"*
- **Debugging**: *"Enable debug logs for the user 'dev@example.com'"*

## Development

### Building from Source
```bash
# Install dependencies
npm install

# Build the extension
npm run build

# To package the extension for distribution, you will need the DXT CLI
# npm install -g @anthropic-ai/dxt
# dxt pack