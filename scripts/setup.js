#!/usr/bin/env node

/**
 * Setup script for Salesforce Claude Desktop Extension
 * Helps users configure the extension in Claude Desktop
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = '') {
  console.log(color + message + COLORS.reset);
}

function header(message) {
  console.log();
  log('═'.repeat(60), COLORS.blue);
  log(message, COLORS.bright + COLORS.blue);
  log('═'.repeat(60), COLORS.blue);
  console.log();
}

function success(message) {
  log('✓ ' + message, COLORS.green);
}

function warning(message) {
  log('⚠ ' + message, COLORS.yellow);
}

function error(message) {
  log('✗ ' + message, COLORS.red);
}

function getClaudeConfigPath() {
  const platform = process.platform;
  let configDir;
  
  switch (platform) {
    case 'darwin': // macOS
      configDir = join(homedir(), 'Library', 'Application Support', 'Claude');
      break;
    case 'win32': // Windows
      configDir = join(process.env.APPDATA || homedir(), 'Claude');
      break;
    default: // Linux and others
      configDir = join(homedir(), '.config', 'Claude');
  }
  
  return join(configDir, 'extensions.json');
}

async function main() {
  header('Salesforce Claude Desktop Extension Setup');
  
  // Step 1: Check if we're in the right directory
  const manifestPath = join(process.cwd(), 'manifest.json');
  if (!existsSync(manifestPath)) {
    error('manifest.json not found. Please run this script from the extension directory.');
    process.exit(1);
  }
  
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  success(`Found extension: ${manifest.name} v${manifest.version}`);
  
  // Step 2: Check dependencies
  log('\nChecking dependencies...');
  if (!existsSync('node_modules')) {
    warning('Dependencies not installed. Installing now...');
    try {
      execSync('npm install', { stdio: 'inherit' });
      success('Dependencies installed');
    } catch (e) {
      error('Failed to install dependencies. Please run: npm install');
      process.exit(1);
    }
  } else {
    success('Dependencies already installed');
  }
  
  // Step 3: Build the extension
  log('\nBuilding extension...');
  if (!existsSync('dist')) {
    try {
      execSync('npm run build', { stdio: 'inherit' });
      success('Extension built successfully');
    } catch (e) {
      error('Failed to build extension. Please run: npm run build');
      process.exit(1);
    }
  } else {
    success('Extension already built');
  }
  
  // Step 4: Configure Claude Desktop
  header('Configuring Claude Desktop');
  
  const configPath = getClaudeConfigPath();
  const extensionPath = resolve(process.cwd());
  
  log(`Extension path: ${extensionPath}`);
  log(`Config path: ${configPath}`);
  
  let config = { extensions: [] };
  
  // Check if config file exists
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
      success('Found existing Claude configuration');
    } catch (e) {
      warning('Could not parse existing configuration, creating new one');
    }
  } else {
    // Create config directory if it doesn't exist
    const configDir = join(configPath, '..');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    warning('No Claude configuration found, creating new one');
  }
  
  // Ensure extensions array exists
  if (!config.extensions) {
    config.extensions = [];
  }
  
  // Check if extension is already configured
  const existingIndex = config.extensions.findIndex(
    ext => ext.id === 'salesforce' || ext.path === extensionPath
  );
  
  if (existingIndex >= 0) {
    // Update existing
    config.extensions[existingIndex] = {
      id: 'salesforce',
      path: extensionPath
    };
    success('Updated existing extension configuration');
  } else {
    // Add new
    config.extensions.push({
      id: 'salesforce',
      path: extensionPath
    });
    success('Added extension to configuration');
  }
  
  // Write configuration
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    success('Configuration saved');
  } catch (e) {
    error(`Failed to save configuration: ${e.message}`);
    console.log('\nPlease manually add the following to your extensions.json:');
    console.log(JSON.stringify({
      id: 'salesforce',
      path: extensionPath
    }, null, 2));
  }
  
  // Step 5: Instructions
  header('Setup Complete!');
  
  log('Next steps:', COLORS.bright);
  log('1. Restart Claude Desktop');
  log('2. Go to Extensions → Salesforce → Settings');
  log('3. Configure your authentication:');
  log('   - For Username/Password: Enter username, password, and security token');
  log('   - For OAuth: Enter client ID and secret from your Connected App');
  log('4. Start using natural language to interact with Salesforce!');
  
  console.log();
  log('Example queries:', COLORS.bright);
  log('  "Show me all Accounts created this month"');
  log('  "Create a Customer_Feedback__c custom object"');
  log('  "Count opportunities by stage"');
  log('  "Update the status of case 5001234 to Closed"');
  
  console.log();
  success('Extension ready to use!');
}

// Run the setup
main().catch(err => {
  error(`Setup failed: ${err.message}`);
  process.exit(1);
});