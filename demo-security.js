#!/usr/bin/env node

import { 
  createSandbox, 
  validateFileAccess, 
  validateNetworkAccess,
  getDefaultPermissionTier,
  PERMISSION_TIERS,
  generateSecuritySummary
} from './src/utils/sandbox.js';
import { 
  isSafeModeEnabled, 
  setSafeMode, 
  validateInstallationPermissions 
} from './src/utils/permissions.js';
import { getServerConfig } from './src/registry.js';
import chalk from 'chalk';

console.log(chalk.blue('🔒 AmpGI Security System Demonstration\n'));

// Demo 1: Permission Tier Detection
console.log(chalk.yellow('1. Permission Tier Detection:'));
const filesystemServer = getServerConfig('filesystem');
const memoryServer = getServerConfig('memory');
const everythingServer = getServerConfig('everything');

console.log(`  ${filesystemServer.name}: ${chalk.red(getDefaultPermissionTier(filesystemServer))}`);
console.log(`  ${memoryServer.name}: ${chalk.yellow(getDefaultPermissionTier(memoryServer))}`);
console.log(`  ${everythingServer.name}: ${chalk.green(getDefaultPermissionTier(everythingServer))}`);

// Demo 2: Sandbox Creation and File Access
console.log(chalk.yellow('\n2. File Access Control:'));
const lowSandbox = createSandbox(everythingServer, PERMISSION_TIERS.LOW);
const mediumSandbox = createSandbox(memoryServer, PERMISSION_TIERS.MEDIUM);
const highSandbox = createSandbox(filesystemServer, PERMISSION_TIERS.HIGH);

const testPaths = [
  '/etc/passwd',
  '/Users/danielmcateer/Documents/test.txt',
  '/tmp/safe-file.txt'
];

for (const testPath of testPaths) {
  console.log(`\n  Testing access to: ${testPath}`);
  
  const lowRead = validateFileAccess(lowSandbox, testPath, 'read');
  const mediumRead = validateFileAccess(mediumSandbox, testPath, 'read');
  const highRead = validateFileAccess(highSandbox, testPath, 'read');
  
  console.log(`    Low privilege:    ${lowRead.allowed ? chalk.green('✓') : chalk.red('✗')} ${!lowRead.allowed ? lowRead.reason : ''}`);
  console.log(`    Medium privilege: ${mediumRead.allowed ? chalk.green('✓') : chalk.red('✗')} ${!mediumRead.allowed ? mediumRead.reason : ''}`);
  console.log(`    High privilege:   ${highRead.allowed ? chalk.green('✓') : chalk.red('✗')} ${!highRead.allowed ? highRead.reason : ''}`);
}

// Demo 3: Network Access Control
console.log(chalk.yellow('\n3. Network Access Control:'));
const testDomains = [
  { domain: 'api.github.com', port: 443 },
  { domain: 'evil-site.com', port: 80 },
  { domain: 'api.openai.com', port: 443 }
];

for (const { domain, port } of testDomains) {
  console.log(`\n  Testing access to: ${domain}:${port}`);
  
  const lowNet = validateNetworkAccess(lowSandbox, domain, port);
  const mediumNet = validateNetworkAccess(mediumSandbox, domain, port);
  const highNet = validateNetworkAccess(highSandbox, domain, port);
  
  console.log(`    Low privilege:    ${lowNet.allowed ? chalk.green('✓') : chalk.red('✗')} ${!lowNet.allowed ? lowNet.reason : ''}`);
  console.log(`    Medium privilege: ${mediumNet.allowed ? chalk.green('✓') : chalk.red('✗')} ${!mediumNet.allowed ? mediumNet.reason : ''}`);
  console.log(`    High privilege:   ${highNet.allowed ? chalk.green('✓') : chalk.red('✗')} ${!highNet.allowed ? highNet.reason : ''}`);
}

// Demo 4: Safe Mode
console.log(chalk.yellow('\n4. Safe Mode Protection:'));
console.log(`  Current safe mode: ${await isSafeModeEnabled() ? chalk.green('Enabled') : chalk.red('Disabled')}`);

const testServers = ['filesystem', 'memory', 'everything'];
const validation = await validateInstallationPermissions(testServers);

console.log('\n  Installation validation results:');
for (const result of validation) {
  const status = result.allowed ? chalk.green('Allowed') : chalk.red('Blocked');
  console.log(`    ${result.serverName}: ${status}`);
  if (!result.allowed) {
    console.log(`      Reason: ${result.reason}`);
  }
}

// Demo 5: Security Summaries
console.log(chalk.yellow('\n5. Security Summaries:'));
for (const [name, sandbox] of [
  ['Low Privilege', lowSandbox],
  ['Medium Privilege', mediumSandbox], 
  ['High Privilege', highSandbox]
]) {
  const summary = generateSecuritySummary(sandbox);
  console.log(`\n  ${name}:`);
  console.log(`    Memory limit: ${summary.restrictions.memory}`);
  console.log(`    Execution time: ${summary.restrictions.executionTime}`);
  console.log(`    File access: ${summary.restrictions.fileAccess}`);
  console.log(`    Network access: ${summary.restrictions.networkAccess}`);
  console.log(`    Can write files: ${summary.capabilities.canWriteFiles ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`    Can access network: ${summary.capabilities.canAccessNetwork ? chalk.green('Yes') : chalk.red('No')}`);
}

console.log(chalk.blue('\n✅ Security demonstration complete!'));
console.log(chalk.gray('\nTry these commands:'));
console.log(chalk.gray('  node src/cli.js security status'));
console.log(chalk.gray('  node src/cli.js security safe-mode on'));
console.log(chalk.gray('  node src/cli.js security permissions filesystem'));
console.log(chalk.gray('  node src/cli.js install --profile personal --safe-mode'));
