import jsforce from 'jsforce';
import { ConnectionType, ConnectionConfig } from '../types/connection.js';
import https from 'https';
import querystring from 'querystring';

/**
 * Creates a Salesforce connection using either username/password or OAuth 2.0 Client Credentials Flow
 * @returns Connected jsforce Connection instance
 */
export async function createSalesforceConnection() {
  // Determine connection type from environment variables set by the DXT manifest
  const connectionType = process.env.SALESFORCE_CONNECTION_TYPE as ConnectionType || ConnectionType.User_Password;
  
  // Set login URL from environment variable or default
  const loginUrl = process.env.SALESFORCE_INSTANCE_URL || 'https://login.salesforce.com';
  
  try {
    if (connectionType === ConnectionType.OAuth_2_0_Client_Credentials) {
      // OAuth 2.0 Client Credentials Flow
      const clientId = process.env.SALESFORCE_CLIENT_ID;
      const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET are required for OAuth 2.0');
      }
      
      console.error('Connecting to Salesforce using OAuth 2.0 Client Credentials Flow');
      
      const tokenUrl = new URL('/services/oauth2/token', loginUrl);
      
      const requestBody = querystring.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      });
      
      const tokenResponse = await new Promise<any>((resolve, reject) => {
        const req = https.request({
          method: 'POST',
          hostname: tokenUrl.hostname,
          path: tokenUrl.pathname,
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
        req.end(requestBody);
      });
      
      return new jsforce.Connection({
        instanceUrl: tokenResponse.instance_url,
        accessToken: tokenResponse.access_token
      });

    } else {
      // Default: Username/Password Flow with Security Token
      const username = process.env.SALESFORCE_USERNAME;
      const password = process.env.SALESFORCE_PASSWORD;
      const token = process.env.SALESFORCE_TOKEN;
      
      if (!username || !password) {
        throw new Error('SALESFORCE_USERNAME and SALESFORCE_PASSWORD are required for Username/Password authentication');
      }
      
      console.error('Connecting to Salesforce using Username/Password authentication');
      
      const conn = new jsforce.Connection({ loginUrl });
      
      await conn.login(
        username,
        password + (token || '')
      );
      
      return conn;
    }
  } catch (error) {
    console.error('Error connecting to Salesforce:', error);
    throw error;
  }
}