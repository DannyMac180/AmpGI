/**
 * Authentication utilities for MCP servers
 * 
 * Handles credential management, validation, and authentication flows
 * for various MCP server authentication types.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { getServerConfig } from '../registry.js';
import { storeCredential, getCredential, removeCredential, removeServerCredentials } from './keychain.js';

/**
 * Authentication type definitions and their requirements
 */
export const AUTH_TYPES = {
  api_key: {
    name: 'API Key',
    description: 'Simple API key authentication',
    fields: ['api_key'],
    instructions: {
      github: 'Generate a Personal Access Token at https://github.com/settings/tokens',
      notion: 'Create an integration at https://developers.notion.com/my-integrations',
      brave_search: 'Get your API key from https://api.search.brave.com/app/keys',
      cloudflare: 'Generate an API token at https://dash.cloudflare.com/profile/api-tokens'
    }
  },
  oauth: {
    name: 'OAuth 2.0',
    description: 'OAuth 2.0 authentication flow',
    fields: ['access_token', 'refresh_token', 'expires_at'],
    instructions: {
      google: 'OAuth flow will open in your browser for Google services',
      microsoft: 'OAuth flow will open in your browser for Microsoft services'
    }
  },
  connection_string: {
    name: 'Connection String',
    description: 'Database or service connection string',
    fields: ['connection_string'],
    instructions: {
      database: 'Provide the full connection string for your database'
    }
  },
  custom: {
    name: 'Custom Authentication',
    description: 'Server-specific authentication mechanism',
    fields: ['custom_auth'],
    instructions: {
      default: 'Follow server-specific authentication instructions'
    }
  }
};

/**
 * Get authentication requirements for a server
 */
export function getAuthRequirements(serverId) {
  const server = getServerConfig(serverId);
  
  if (server.auth === 'none') {
    return null;
  }
  
  const authType = AUTH_TYPES[server.auth];
  if (!authType) {
    throw new Error(`Unknown authentication type: ${server.auth}`);
  }
  
  return {
    type: server.auth,
    ...authType,
    server: serverId,
    env: server.env || {}
  };
}

/**
 * Check if server requires authentication
 */
export function requiresAuth(serverId) {
  const server = getServerConfig(serverId);
  return server.auth !== 'none';
}

/**
 * Check if server has stored credentials
 */
export async function hasStoredCredentials(serverId) {
  if (!requiresAuth(serverId)) {
    return true; // No auth required
  }
  
  const authReq = getAuthRequirements(serverId);
  
  // Check if all required fields have stored values
  for (const field of authReq.fields) {
    const value = await getCredential(serverId, field);
    if (!value) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get stored credentials for a server
 */
export async function getServerCredentials(serverId) {
  if (!requiresAuth(serverId)) {
    return {};
  }
  
  const authReq = getAuthRequirements(serverId);
  const credentials = {};
  
  for (const field of authReq.fields) {
    const value = await getCredential(serverId, field);
    if (value) {
      credentials[field] = value;
    }
  }
  
  return credentials;
}

/**
 * Interactive setup for API key authentication
 */
async function setupApiKeyAuth(serverId, authReq) {
  const instructions = authReq.instructions[serverId] || authReq.instructions.default || 'Obtain your API key from the service provider';
  
  console.log(chalk.blue(`\n🔐 Setting up authentication for ${getServerConfig(serverId).name}`));
  console.log(chalk.gray(instructions));
  console.log();
  
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your API key:',
      mask: '*',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'API key is required';
        }
        if (input.length < 10) {
          return 'API key seems too short, please check and try again';
        }
        return true;
      }
    }
  ]);
  
  // Store the credential
  await storeCredential(serverId, 'api_key', apiKey.trim());
  
  return { api_key: apiKey.trim() };
}

/**
 * Interactive setup for connection string authentication
 */
async function setupConnectionStringAuth(serverId, authReq) {
  const instructions = authReq.instructions[serverId] || authReq.instructions.database || 'Provide the connection string for your service';
  
  console.log(chalk.blue(`\n🔐 Setting up authentication for ${getServerConfig(serverId).name}`));
  console.log(chalk.gray(instructions));
  console.log();
  
  const { connectionString } = await inquirer.prompt([
    {
      type: 'password',
      name: 'connectionString',
      message: 'Enter your connection string:',
      mask: '*',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Connection string is required';
        }
        return true;
      }
    }
  ]);
  
  // Store the credential
  await storeCredential(serverId, 'connection_string', connectionString.trim());
  
  return { connection_string: connectionString.trim() };
}

/**
 * Setup authentication for a server interactively
 */
export async function setupServerAuth(serverId) {
  if (!requiresAuth(serverId)) {
    console.log(chalk.green(`✓ ${getServerConfig(serverId).name} does not require authentication`));
    return {};
  }
  
  const authReq = getAuthRequirements(serverId);
  
  // Check if already configured
  const hasCredentials = await hasStoredCredentials(serverId);
  if (hasCredentials) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `${getServerConfig(serverId).name} already has stored credentials. Overwrite?`,
        default: false
      }
    ]);
    
    if (!overwrite) {
      console.log(chalk.yellow('Keeping existing credentials'));
      return await getServerCredentials(serverId);
    }
  }
  
  // Setup based on auth type
  let credentials;
  switch (authReq.type) {
    case 'api_key':
      credentials = await setupApiKeyAuth(serverId, authReq);
      break;
      
    case 'connection_string':
      credentials = await setupConnectionStringAuth(serverId, authReq);
      break;
      
    case 'oauth':
      console.log(chalk.yellow('OAuth authentication setup is not yet implemented'));
      console.log(chalk.gray('Please refer to the server documentation for manual setup'));
      return {};
      
    default:
      console.log(chalk.yellow(`Custom authentication for ${authReq.type} is not yet implemented`));
      console.log(chalk.gray('Please refer to the server documentation for manual setup'));
      return {};
  }
  
  console.log(chalk.green(`✓ Authentication configured for ${getServerConfig(serverId).name}`));
  return credentials;
}

/**
 * Validate stored credentials by testing server connection
 */
export async function validateCredentials(serverId) {
  if (!requiresAuth(serverId)) {
    return { valid: true, message: 'No authentication required' };
  }
  
  const hasCredentials = await hasStoredCredentials(serverId);
  if (!hasCredentials) {
    return { valid: false, message: 'No credentials stored' };
  }
  
  const credentials = await getServerCredentials(serverId);
  
  // For now, we'll do basic validation
  // In the future, this could test actual server connections
  if (credentials.api_key && credentials.api_key.length < 10) {
    return { valid: false, message: 'API key appears invalid (too short)' };
  }
  
  if (credentials.connection_string && !credentials.connection_string.includes('://')) {
    return { valid: false, message: 'Connection string appears invalid (no protocol)' };
  }
  
  return { valid: true, message: 'Credentials appear valid' };
}

/**
 * Generate environment variables from stored credentials
 */
export async function generateCredentialEnvVars(serverId) {
  if (!requiresAuth(serverId)) {
    return {};
  }
  
  const server = getServerConfig(serverId);
  const credentials = await getServerCredentials(serverId);
  const envVars = {};
  
  // Map credentials to environment variable names
  if (server.env) {
    for (const [envVar, template] of Object.entries(server.env)) {
      if (template.includes('api_key') && credentials.api_key) {
        envVars[envVar] = credentials.api_key;
      } else if (template.includes('connection_string') && credentials.connection_string) {
        envVars[envVar] = credentials.connection_string;
      } else if (template.includes('access_token') && credentials.access_token) {
        envVars[envVar] = credentials.access_token;
      }
    }
  }
  
  return envVars;
}

/**
 * Remove all authentication for a server
 */
export async function removeServerAuth(serverId) {
  if (!requiresAuth(serverId)) {
    return { removed: 0, message: 'No authentication configured' };
  }
  
  const results = await removeServerCredentials(serverId);
  const removedCount = results.filter(r => r.removed).length;
  
  return {
    removed: removedCount,
    total: results.length,
    message: `Removed ${removedCount} credential(s) for ${getServerConfig(serverId).name}`
  };
}

/**
 * List servers that require authentication and their status
 */
export async function listAuthStatus() {
  const { MCP_SERVERS } = await import('../registry.js');
  const servers = Object.keys(MCP_SERVERS);
  const authStatus = [];
  
  for (const serverId of servers) {
    if (requiresAuth(serverId)) {
      const server = getServerConfig(serverId);
      const hasCredentials = await hasStoredCredentials(serverId);
      const validation = await validateCredentials(serverId);
      
      authStatus.push({
        serverId,
        name: server.name,
        authType: server.auth,
        hasCredentials,
        valid: validation.valid,
        message: validation.message
      });
    }
  }
  
  return authStatus;
}

/**
 * Setup authentication for multiple servers
 */
export async function setupMultipleServerAuth(serverIds) {
  const results = [];
  
  for (const serverId of serverIds) {
    try {
      console.log(chalk.blue(`\n--- Setting up authentication for ${serverId} ---`));
      const credentials = await setupServerAuth(serverId);
      results.push({ serverId, success: true, credentials });
    } catch (error) {
      console.error(chalk.red(`Failed to setup authentication for ${serverId}: ${error.message}`));
      results.push({ serverId, success: false, error: error.message });
    }
  }
  
  return results;
}
