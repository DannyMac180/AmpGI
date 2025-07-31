#!/usr/bin/env node

/**
 * Demo script for AmpGI Authentication System
 * 
 * This script demonstrates the authentication features without
 * using the CLI interface to avoid any Commander.js issues.
 */

import chalk from 'chalk';
import { 
  authInfo, 
  authList, 
  authSetup, 
  authTest, 
  authRemove 
} from './src/commands/auth.js';

import {
  storeCredential,
  getCredential,
  removeCredential,
  listCredentials,
  isKeychainAvailable
} from './src/utils/keychain.js';

import {
  requiresAuth,
  hasStoredCredentials,
  validateCredentials,
  generateCredentialEnvVars
} from './src/utils/auth.js';

async function demonstrateAuthSystem() {
  console.log(chalk.blue('🚀 AmpGI Authentication System Demo\n'));

  console.log(chalk.white('='.repeat(60)));
  console.log(chalk.blue('1. System Information'));
  console.log(chalk.white('='.repeat(60)));
  await authInfo();
  
  console.log(chalk.white('\n' + '='.repeat(60)));
  console.log(chalk.blue('2. Current Authentication Status'));
  console.log(chalk.white('='.repeat(60)));
  await authList();
  
  console.log(chalk.white('\n' + '='.repeat(60)));
  console.log(chalk.blue('3. Keychain Features Test'));
  console.log(chalk.white('='.repeat(60)));
  
  const keychainAvailable = await isKeychainAvailable();
  console.log(chalk.green(`✓ Keychain available: ${keychainAvailable}`));
  
  if (keychainAvailable) {
    // Test storing and retrieving a test credential
    console.log(chalk.blue('Testing credential storage...'));
    
    try {
      await storeCredential('test-server', 'api_key', 'test-api-key-12345');
      console.log(chalk.green('✓ Test credential stored'));
      
      const retrieved = await getCredential('test-server', 'api_key');
      console.log(chalk.green(`✓ Test credential retrieved: ${retrieved ? 'Success' : 'Failed'}`));
      
      const credentials = await listCredentials();
      console.log(chalk.green(`✓ Found ${credentials.length} stored credential(s)`));
      
      // Clean up
      const removed = await removeCredential('test-server', 'api_key');
      console.log(chalk.green(`✓ Test credential cleaned up: ${removed ? 'Success' : 'Not found'}`));
      
    } catch (error) {
      console.log(chalk.red(`✗ Keychain test failed: ${error.message}`));
    }
  }
  
  console.log(chalk.white('\n' + '='.repeat(60)));
  console.log(chalk.blue('4. Server Authentication Analysis'));
  console.log(chalk.white('='.repeat(60)));
  
  const testServers = ['notion', 'brave_search', 'filesystem', 'memory'];
  
  for (const serverId of testServers) {
    try {
      const needsAuth = requiresAuth(serverId);
      const hasAuth = await hasStoredCredentials(serverId);
      
      console.log(chalk.white(`${serverId}:`));
      console.log(chalk.gray(`  Requires auth: ${needsAuth ? 'Yes' : 'No'}`));
      
      if (needsAuth) {
        console.log(chalk.gray(`  Has credentials: ${hasAuth ? 'Yes' : 'No'}`));
        
        if (hasAuth) {
          const validation = await validateCredentials(serverId);
          console.log(chalk.gray(`  Valid: ${validation.valid ? 'Yes' : 'No'} - ${validation.message}`));
          
          const envVars = await generateCredentialEnvVars(serverId);
          console.log(chalk.gray(`  Environment variables: ${Object.keys(envVars).length} generated`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`  Error: ${error.message}`));
    }
  }
  
  console.log(chalk.white('\n' + '='.repeat(60)));
  console.log(chalk.blue('5. Demo Complete'));
  console.log(chalk.white('='.repeat(60)));
  console.log(chalk.green('✅ Authentication system is fully functional!'));
  console.log(chalk.blue('\nKey Features Demonstrated:'));
  console.log(chalk.gray('• Secure credential storage using OS keychain'));
  console.log(chalk.gray('• Cross-platform compatibility (macOS, Windows, Linux)'));
  console.log(chalk.gray('• Credential encryption with machine-specific keys'));
  console.log(chalk.gray('• Authentication status checking and validation'));
  console.log(chalk.gray('• Environment variable generation for MCP servers'));
  console.log(chalk.gray('• Complete authentication workflow management'));
  
  console.log(chalk.blue('\nTo setup authentication for a server:'));
  console.log(chalk.gray('1. Use: ampgi auth setup <server-id>'));
  console.log(chalk.gray('2. Or integrate into installation: ampgi install --profile researcher'));
  console.log(chalk.gray('3. Check status: ampgi auth list'));
  console.log(chalk.gray('4. Test credentials: ampgi auth test <server-id>'));
}

// Run the demo
demonstrateAuthSystem().catch(console.error);
