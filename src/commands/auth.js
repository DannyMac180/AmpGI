/**
 * Authentication management commands
 * 
 * Provides CLI commands for managing MCP server credentials:
 * - setup: Interactive authentication setup
 * - list: Show authentication status
 * - test: Validate stored credentials
 * - remove: Remove stored credentials
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getServerConfig, listServers } from '../registry.js';
import {
  setupServerAuth,
  listAuthStatus,
  validateCredentials,
  removeServerAuth,
  hasStoredCredentials,
  requiresAuth
} from '../utils/auth.js';
import { isKeychainAvailable } from '../utils/keychain.js';

/**
 * Setup authentication for a specific server
 */
export async function authSetup(serverId, options = {}) {
  // Check keychain availability
  const keychainAvailable = await isKeychainAvailable();
  if (!keychainAvailable) {
    console.error(chalk.red('✗ Secure keychain is not available on this system'));
    console.log(chalk.yellow('Authentication requires secure credential storage.'));
    return;
  }
  
  if (!serverId) {
    // Interactive server selection
    const authServers = listServers().filter(server => server.auth !== 'none');
    
    if (authServers.length === 0) {
      console.log(chalk.yellow('No servers require authentication'));
      return;
    }
    
    const { selectedServer } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedServer',
        message: 'Select a server to configure authentication:',
        choices: authServers.map(server => ({
          name: `${server.name} (${server.auth})`,
          value: server.id
        }))
      }
    ]);
    
    serverId = selectedServer;
  }
  
  // Validate server exists and requires auth
  try {
    const server = getServerConfig(serverId);
    
    if (!requiresAuth(serverId)) {
      console.log(chalk.green(`✓ ${server.name} does not require authentication`));
      return;
    }
    
    console.log(chalk.blue(`🔐 Setting up authentication for ${server.name}`));
    console.log(chalk.gray(`Authentication type: ${server.auth}`));
    
    // Setup authentication
    const credentials = await setupServerAuth(serverId);
    
    if (Object.keys(credentials).length > 0) {
      console.log(chalk.green('✅ Authentication setup complete!'));
      
      // Optionally test the credentials
      if (!options.skipTest) {
        const { shouldTest } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldTest',
            message: 'Test the credentials now?',
            default: true
          }
        ]);
        
        if (shouldTest) {
          await authTest(serverId);
        }
      }
    } else {
      console.log(chalk.yellow('⚠️  Authentication setup incomplete'));
    }
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * List authentication status for all servers
 */
export async function authList(options = {}) {
  console.log(chalk.blue('🔐 Authentication Status\n'));
  
  try {
    const authStatus = await listAuthStatus();
    
    if (authStatus.length === 0) {
      console.log(chalk.gray('No servers require authentication'));
      return;
    }
    
    // Group by status
    const configured = authStatus.filter(s => s.hasCredentials && s.valid);
    const needsAuth = authStatus.filter(s => !s.hasCredentials);
    const invalid = authStatus.filter(s => s.hasCredentials && !s.valid);
    
    if (configured.length > 0) {
      console.log(chalk.green('✅ Configured and Valid:'));
      for (const server of configured) {
        console.log(chalk.green(`  ✓ ${server.name} (${server.authType})`));
        if (options.verbose) {
          console.log(chalk.gray(`    ${server.message}`));
        }
      }
      console.log();
    }
    
    if (invalid.length > 0) {
      console.log(chalk.yellow('⚠️  Configured but Invalid:'));
      for (const server of invalid) {
        console.log(chalk.yellow(`  ⚠ ${server.name} (${server.authType})`));
        console.log(chalk.gray(`    ${server.message}`));
      }
      console.log();
    }
    
    if (needsAuth.length > 0) {
      console.log(chalk.red('❌ Needs Authentication:'));
      for (const server of needsAuth) {
        console.log(chalk.red(`  ✗ ${server.name} (${server.authType})`));
      }
      console.log();
      
      console.log(chalk.blue('💡 To setup authentication:'));
      for (const server of needsAuth) {
        console.log(chalk.gray(`  ampgi auth setup ${server.serverId}`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Test authentication for a specific server
 */
export async function authTest(serverId, options = {}) {
  if (!serverId) {
    // Test all configured servers
    console.log(chalk.blue('🧪 Testing all server authentications\n'));
    
    const authStatus = await listAuthStatus();
    const configuredServers = authStatus.filter(s => s.hasCredentials);
    
    if (configuredServers.length === 0) {
      console.log(chalk.yellow('No servers have stored credentials to test'));
      return;
    }
    
    let passed = 0;
    let failed = 0;
    
    for (const server of configuredServers) {
      const spinner = ora(`Testing ${server.name}...`).start();
      
      try {
        const result = await validateCredentials(server.serverId);
        
        if (result.valid) {
          spinner.succeed(`${server.name}: ${result.message}`);
          passed++;
        } else {
          spinner.fail(`${server.name}: ${result.message}`);
          failed++;
        }
      } catch (error) {
        spinner.fail(`${server.name}: ${error.message}`);
        failed++;
      }
    }
    
    console.log(chalk.blue(`\n📊 Test Results: ${passed} passed, ${failed} failed`));
    return;
  }
  
  // Test specific server
  try {
    const server = getServerConfig(serverId);
    
    if (!requiresAuth(serverId)) {
      console.log(chalk.green(`✓ ${server.name} does not require authentication`));
      return;
    }
    
    const hasCredentials = await hasStoredCredentials(serverId);
    if (!hasCredentials) {
      console.log(chalk.red(`✗ No credentials stored for ${server.name}`));
      console.log(chalk.blue(`💡 Run: ampgi auth setup ${serverId}`));
      return;
    }
    
    console.log(chalk.blue(`🧪 Testing authentication for ${server.name}`));
    
    const spinner = ora('Validating credentials...').start();
    
    try {
      const result = await validateCredentials(serverId);
      
      if (result.valid) {
        spinner.succeed(`Credentials are valid: ${result.message}`);
      } else {
        spinner.fail(`Credentials are invalid: ${result.message}`);
        console.log(chalk.blue(`💡 Run: ampgi auth setup ${serverId} --overwrite`));
      }
    } catch (error) {
      spinner.fail(`Validation failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Remove authentication for a specific server
 */
export async function authRemove(serverId, options = {}) {
  if (!serverId) {
    console.error(chalk.red('Server ID is required'));
    console.log(chalk.blue('Usage: ampgi auth remove <server-id>'));
    return;
  }
  
  try {
    const server = getServerConfig(serverId);
    
    if (!requiresAuth(serverId)) {
      console.log(chalk.green(`✓ ${server.name} does not require authentication`));
      return;
    }
    
    const hasCredentials = await hasStoredCredentials(serverId);
    if (!hasCredentials) {
      console.log(chalk.yellow(`No credentials stored for ${server.name}`));
      return;
    }
    
    // Confirm removal unless force flag is used
    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Remove all stored credentials for ${server.name}?`,
          default: false
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.yellow('Cancelled'));
        return;
      }
    }
    
    console.log(chalk.blue(`🗑️  Removing credentials for ${server.name}`));
    
    const spinner = ora('Removing credentials...').start();
    
    try {
      const result = await removeServerAuth(serverId);
      
      if (result.removed > 0) {
        spinner.succeed(result.message);
      } else {
        spinner.warn('No credentials were found to remove');
      }
    } catch (error) {
      spinner.fail(`Failed to remove credentials: ${error.message}`);
    }
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Show authentication information and help
 */
export async function authInfo() {
  console.log(chalk.blue('🔐 AmpGI Authentication System\n'));
  
  console.log(chalk.white('Supported Authentication Types:'));
  console.log(chalk.green('  • API Key') + chalk.gray(' - Simple API key authentication'));
  console.log(chalk.green('  • OAuth 2.0') + chalk.gray(' - OAuth flow (coming soon)'));
  console.log(chalk.green('  • Connection String') + chalk.gray(' - Database connections'));
  console.log(chalk.green('  • Custom') + chalk.gray(' - Server-specific authentication'));
  
  console.log(chalk.white('\nSecurity Features:'));
  console.log(chalk.green('  • OS Keychain Integration') + chalk.gray(' - Uses system secure storage'));
  console.log(chalk.green('  • Credential Encryption') + chalk.gray(' - Additional encryption layer'));
  console.log(chalk.green('  • Secure Access') + chalk.gray(' - Machine-specific key derivation'));
  
  console.log(chalk.white('\nCommands:'));
  console.log(chalk.blue('  ampgi auth setup <server>') + chalk.gray(' - Setup authentication'));
  console.log(chalk.blue('  ampgi auth list') + chalk.gray('           - Show auth status'));
  console.log(chalk.blue('  ampgi auth test <server>') + chalk.gray('  - Test credentials'));
  console.log(chalk.blue('  ampgi auth remove <server>') + chalk.gray(' - Remove credentials'));
  
  // Show keychain status
  const keychainAvailable = await isKeychainAvailable();
  console.log(chalk.white('\nSystem Status:'));
  
  if (keychainAvailable) {
    console.log(chalk.green('  ✓ Secure keychain available'));
  } else {
    console.log(chalk.red('  ✗ Secure keychain not available'));
    console.log(chalk.yellow('    Authentication features will be limited'));
  }
}
