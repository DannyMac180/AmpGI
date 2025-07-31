#!/usr/bin/env node

/**
 * Discovery System Demonstration
 * 
 * This script demonstrates the complete discovery system functionality
 * without interactive prompts for demonstration purposes.
 */

import chalk from 'chalk';
import { discoverAllServers, searchServers, getCategories } from './src/utils/discovery.js';
import { testServerCompatibility, TEST_LEVELS } from './src/utils/compatibility.js';

console.log(chalk.blue.bold('🚀 AmpGI Discovery System Demonstration\n'));

async function demonstrateDiscoverySystem() {
  try {
    // Demo 1: Discover Official MCP Servers
    console.log(chalk.green('📡 Discovering Official MCP Servers...'));
    const servers = await discoverAllServers({ 
      source: 'npm', 
      useCache: false, 
      limit: 15 
    });
    
    console.log(chalk.green(`✓ Found ${servers.length} MCP servers\n`));
    
    // Demo 2: Show Server Categories
    console.log(chalk.cyan('📋 Available Server Categories:'));
    const categories = getCategories(servers);
    categories.forEach(category => {
      const count = servers.filter(s => s.category === category).length;
      const emoji = {
        'storage': '💾',
        'ai': '🧠',
        'web': '🌐',
        'development': '⚙️',
        'utility': '🔧',
        'database': '🗄️',
        'productivity': '📊',
        'cloud': '☁️'
      }[category] || '📦';
      console.log(`  ${emoji} ${category}: ${count} servers`);
    });
    
    // Demo 3: Highlight Notable Servers
    console.log(chalk.yellow('\n⭐ Notable Servers Discovered:'));
    const notableServers = [
      servers.find(s => s.name.includes('filesystem')),
      servers.find(s => s.name.includes('memory')),
      servers.find(s => s.name.includes('sequential-thinking')),
      servers.find(s => s.name.includes('github')),
      servers.find(s => s.name.includes('puppeteer'))
    ].filter(Boolean);
    
    notableServers.forEach((server, i) => {
      const icon = server.official ? '🏢' : '👥';
      console.log(`${i + 1}. ${icon} ${chalk.bold(server.displayName)}`);
      console.log(`   ${server.description}`);
      console.log(`   Package: ${chalk.gray(server.package)}`);
      console.log(`   Capabilities: ${chalk.blue(server.capabilities?.slice(0, 2).join(', ') || 'general')}`);
    });
    
    // Demo 4: Search Functionality
    console.log(chalk.magenta('\n🔍 Search Demonstration:'));
    const searchQueries = ['file', 'ai', 'web', 'memory'];
    searchQueries.forEach(query => {
      const results = searchServers(servers, query);
      console.log(`  "${query}": ${results.length} matches`);
      if (results.length > 0) {
        console.log(`    → ${results[0].displayName}`);
      }
    });
    
    // Demo 5: Compatibility Testing
    console.log(chalk.red('\n🧪 Compatibility Testing:'));
    const testServer = servers.find(s => s.official && s.package && s.name.includes('filesystem'));
    
    if (testServer) {
      console.log(`Testing: ${testServer.displayName}`);
      const result = await testServerCompatibility(testServer, {
        level: TEST_LEVELS.BASIC
      });
      
      const statusColor = result.passed ? chalk.green : chalk.red;
      console.log(`  Status: ${statusColor(result.passed ? 'PASSED' : 'FAILED')}`);
      console.log(`  Score: ${chalk.blue(result.score)}/${chalk.blue(result.maxScore)} (${Math.round((result.score/result.maxScore)*100)}%)`);
      console.log(`  Recommendation: ${chalk.yellow(result.recommendation)}`);
      
      if (result.tests.basic) {
        console.log('  Basic Tests:');
        Object.entries(result.tests.basic).forEach(([test, res]) => {
          const icon = res.passed ? '✓' : '✗';
          const color = res.passed ? chalk.green : chalk.red;
          console.log(`    ${color(icon)} ${test}: ${res.message}`);
        });
      }
    }
    
    // Demo 6: Installation Guidance
    console.log(chalk.blue('\n📦 Installation Guidance:'));
    const installableServers = servers.filter(s => s.package && s.official).slice(0, 3);
    
    console.log('Ready for installation:');
    installableServers.forEach((server, i) => {
      console.log(`${i + 1}. ${server.displayName}`);
      console.log(`   Command: ${chalk.gray(`ampgi install -s ${server.id}`)}`);
      console.log(`   Package: ${chalk.gray(server.package)}`);
    });
    
    // Demo 7: System Statistics
    console.log(chalk.white('\n📊 Discovery Statistics:'));
    const stats = {
      total: servers.length,
      official: servers.filter(s => s.official).length,
      community: servers.filter(s => !s.official).length,
      installable: servers.filter(s => s.package).length,
      categories: categories.length
    };
    
    console.log(`  Total servers discovered: ${chalk.bold(stats.total)}`);
    console.log(`  Official servers: ${chalk.green(stats.official)}`);
    console.log(`  Community servers: ${chalk.yellow(stats.community)}`);
    console.log(`  Installable packages: ${chalk.blue(stats.installable)}`);
    console.log(`  Categories available: ${chalk.cyan(stats.categories)}`);
    
    // Demo 8: Next Steps
    console.log(chalk.green.bold('\n🎯 Next Steps:'));
    console.log('1. Run `ampgi discover` to interactively explore servers');
    console.log('2. Use `ampgi search <term>` to find specific capabilities');
    console.log('3. Install servers with `ampgi install -s <server-id>`');
    console.log('4. Test compatibility with `ampgi discover --test`');
    console.log('5. Check installation status with `ampgi list --servers`');
    
    console.log(chalk.green.bold('\n✅ Discovery System Demo Complete!'));
    console.log(chalk.gray('The AmpGI discovery system has found dozens of additional'));
    console.log(chalk.gray('MCP servers that can extend Amp\'s capabilities significantly.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Demo failed:'), error.message);
  }
}

demonstrateDiscoverySystem();
