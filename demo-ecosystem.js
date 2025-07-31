#!/usr/bin/env node

import chalk from 'chalk';
import { discoverMCPServers, searchServers, filterServersByCategory } from './src/utils/discovery.js';
import { testServerCompatibility, TEST_LEVELS } from './src/utils/compatibility.js';
import { updateRegistryFromDiscovery, saveDynamicRegistry, getAllServers } from './src/registry.js';

console.log(chalk.blue.bold('🌟 AmpGI MCP Ecosystem Integration Demo\n'));

async function demonstrateDiscovery() {
  console.log(chalk.cyan('🔍 1. Discovering MCP Servers from the Ecosystem\n'));
  
  const discovery = await discoverMCPServers({ 
    source: 'npm', 
    useCache: false 
  });
  
  console.log(chalk.green(`✅ Discovered ${discovery.total} MCP servers from NPM registry`));
  console.log(chalk.gray(`   Official: ${discovery.servers.filter(s => s.official).length}`));
  console.log(chalk.gray(`   Community: ${discovery.servers.filter(s => !s.official).length}\n`));
  
  return discovery.servers;
}

async function demonstrateSearch(servers) {
  console.log(chalk.cyan('🔎 2. Searching Servers by Capability\n'));
  
  // Search for database servers
  const dbServers = searchServers(servers, 'database');
  console.log(chalk.blue(`Database servers found: ${dbServers.length}`));
  dbServers.slice(0, 2).forEach(server => {
    console.log(chalk.gray(`  • ${server.name}: ${server.description}`));
  });
  
  // Search for web servers
  const webServers = searchServers(servers, 'web');
  console.log(chalk.blue(`\nWeb-related servers found: ${webServers.length}`));
  webServers.slice(0, 2).forEach(server => {
    console.log(chalk.gray(`  • ${server.name}: ${server.description}`));
  });
  
  console.log();
  return { dbServers, webServers };
}

async function demonstrateCompatibilityTesting(servers) {
  console.log(chalk.cyan('🧪 3. Testing Server Compatibility\n'));
  
  // Test first 2 servers
  const testServers = servers.slice(0, 2);
  const results = [];
  
  for (const server of testServers) {
    console.log(chalk.blue(`Testing ${server.name}...`));
    
    try {
      const result = await testServerCompatibility(server, {
        level: TEST_LEVELS.BASIC,
        includeSecurity: true
      });
      
      const status = result.passed ? chalk.green('✓ Compatible') : chalk.red('✗ Issues');
      console.log(`  ${status} (Score: ${result.score}/${result.maxScore})`);
      
      results.push({ server, result });
    } catch (error) {
      console.log(chalk.red(`  ✗ Test failed: ${error.message}`));
    }
  }
  
  console.log();
  return results;
}

async function demonstrateRegistryIntegration(servers) {
  console.log(chalk.cyan('📝 4. Integrating with Dynamic Registry\n'));
  
  const updates = updateRegistryFromDiscovery(servers);
  
  console.log(chalk.green(`✅ Registry updated:`));
  console.log(chalk.gray(`   Added: ${updates.added.length} servers`));
  console.log(chalk.gray(`   Updated: ${updates.updated.length} servers`));
  console.log(chalk.gray(`   Errors: ${updates.errors.length} errors`));
  
  if (updates.added.length > 0) {
    console.log(chalk.blue('\nNewly added servers:'));
    updates.added.slice(0, 3).forEach(serverId => {
      console.log(chalk.gray(`  • ${serverId}`));
    });
  }
  
  // Save registry
  try {
    const registryFile = await saveDynamicRegistry();
    console.log(chalk.gray(`\n📁 Registry saved to: ${registryFile}`));
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Failed to save registry - ${error.message}`));
  }
  
  console.log();
}

async function demonstrateExpandedCapabilities() {
  console.log(chalk.cyan('🚀 5. Expanded Capabilities Summary\n'));
  
  const allServers = getAllServers();
  const serverList = Object.entries(allServers).map(([id, config]) => ({ id, ...config }));
  
  const categories = {};
  serverList.forEach(server => {
    const cat = server.category || 'unknown';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  console.log(chalk.green(`📊 Total available servers: ${serverList.length}`));
  console.log(chalk.blue('Categories available:'));
  
  Object.entries(categories).sort(([,a], [,b]) => b - a).forEach(([category, count]) => {
    const icon = getCategoryIcon(category);
    console.log(chalk.gray(`  ${icon} ${category}: ${count} servers`));
  });
  
  console.log();
  
  // Show some capabilities
  const allCapabilities = new Set();
  serverList.forEach(server => {
    if (server.capabilities) {
      server.capabilities.forEach(cap => allCapabilities.add(cap));
    }
  });
  
  console.log(chalk.blue(`🔧 Total capabilities: ${allCapabilities.size}`));
  console.log(chalk.gray('Sample capabilities:'));
  Array.from(allCapabilities).slice(0, 8).forEach(cap => {
    console.log(chalk.gray(`  • ${cap}`));
  });
  
  console.log();
}

function getCategoryIcon(category) {
  const icons = {
    database: '🗄️',
    development: '⚙️',
    web: '🌐',
    productivity: '📋',
    ai: '🧠',
    storage: '💾',
    utility: '🔧',
    cloud: '☁️',
    community: '👥'
  };
  return icons[category] || '📦';
}

async function main() {
  try {
    // 1. Discovery
    const servers = await demonstrateDiscovery();
    
    // 2. Search
    await demonstrateSearch(servers);
    
    // 3. Compatibility Testing
    await demonstrateCompatibilityTesting(servers);
    
    // 4. Registry Integration
    await demonstrateRegistryIntegration(servers);
    
    // 5. Show expanded capabilities
    await demonstrateExpandedCapabilities();
    
    console.log(chalk.green.bold('✅ Ecosystem Integration Complete!\n'));
    
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray('• Use "ampgi discover" to find new servers'));
    console.log(chalk.gray('• Use "ampgi search <query>" to find specific capabilities'));
    console.log(chalk.gray('• Use "ampgi community install <repo>" for GitHub servers'));
    console.log(chalk.gray('• Use "ampgi install -s <server>" to add servers to Amp'));
    
  } catch (error) {
    console.error(chalk.red(`Demo failed: ${error.message}`));
    process.exit(1);
  }
}

main();
