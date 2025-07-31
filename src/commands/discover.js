/**
 * Discover Command
 * 
 * Discovers available MCP servers from various sources and displays them
 * with compatibility information and installation options.
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { discoverAllServers, searchServers, getServersByCategory, getCategories } from '../utils/discovery.js';
import { testServerCompatibility, testMultipleServers, TEST_LEVELS } from '../utils/compatibility.js';
import { MCP_SERVERS } from '../registry.js';
import fs from 'fs-extra';
import path from 'path';

const DISCOVERY_CACHE_FILE = path.join(process.cwd(), '.ampgi-discovery-cache.json');
const CACHE_MAX_AGE = 3600000; // 1 hour

/**
 * Main discover command handler
 */
export async function discoverCommand(options = {}) {
  const { 
    source = 'all',
    category = null,
    test = false,
    install = false,
    useCache = true,
    limit = 50
  } = options;

  console.log(chalk.blue('🔍 Discovering MCP Servers\n'));

  try {
    // Load or discover servers
    let servers;
    if (useCache) {
      const cached = await loadCachedDiscovery();
      if (cached) {
        servers = cached;
      } else {
        servers = await discoverAndCache(source, limit);
      }
    } else {
      servers = await discoverAllServers({ source, useCache: false, limit });
    }

    if (!servers || servers.length === 0) {
      console.log(chalk.yellow('No MCP servers found.'));
      return;
    }

    console.log(chalk.green(`Found ${servers.length} MCP servers`));
    console.log();

    // Filter by category if specified
    if (category) {
      servers = getServersByCategory(servers, category);
      console.log(chalk.blue(`Filtered to ${servers.length} servers in category: ${category}\n`));
    }

    // Limit results
    if (servers.length > limit) {
      servers = servers.slice(0, limit);
      console.log(chalk.yellow(`Showing first ${limit} results\n`));
    }

    // Sort servers (official first, then by name)
    servers = servers.sort((a, b) => {
      if (a.official && !b.official) return -1;
      if (!a.official && b.official) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    // Test compatibility if requested
    if (test) {
      console.log(chalk.blue('🧪 Testing server compatibility...\n'));
      const testResults = await testMultipleServers(servers.slice(0, 10), {
        level: TEST_LEVELS.BASIC,
        concurrency: 3
      });
      
      // Merge test results with server info
      servers = servers.map(server => {
        const testResult = testResults.find(result => result.serverId === server.id);
        return {
          ...server,
          compatibility: testResult || null
        };
      });
    }

    // Display servers
    displayServers(servers, { showCompatibility: test });

    // Interactive options
    if (install) {
      await interactiveInstall(servers);
    } else if (process.env.NODE_ENV !== 'test') {
      await interactiveActions(servers);
    }

  } catch (error) {
    console.error(chalk.red(`Discovery failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Load cached discovery results
 */
async function loadCachedDiscovery() {
  try {
    if (await fs.pathExists(DISCOVERY_CACHE_FILE)) {
      const cached = await fs.readJson(DISCOVERY_CACHE_FILE);
      const age = Date.now() - cached.timestamp;
      
      if (age < CACHE_MAX_AGE) {
        console.log(chalk.gray('Using cached discovery results\n'));
        return cached.servers;
      }
    }
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Failed to load cache - ${error.message}`));
  }
  return null;
}

/**
 * Discover servers and cache results
 */
async function discoverAndCache(source, limit) {
  const servers = await discoverAllServers({ source, useCache: false, limit });
  
  try {
    await fs.writeJson(DISCOVERY_CACHE_FILE, {
      timestamp: Date.now(),
      servers
    });
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Failed to cache results - ${error.message}`));
  }
  
  return servers;
}

/**
 * Display servers in a formatted table
 */
function displayServers(servers, options = {}) {
  const { showCompatibility = false } = options;
  
  // Separate official and community servers
  const officialServers = servers.filter(s => s.official);
  const communityServers = servers.filter(s => !s.official);
  const knownServers = servers.filter(s => MCP_SERVERS[s.id]);

  // Display known servers first
  if (knownServers.length > 0) {
    console.log(chalk.green.bold('📦 Known Servers (Already in AmpGI Registry)'));
    displayServerGroup(knownServers, showCompatibility, 'known');
    console.log();
  }

  // Display official servers
  if (officialServers.length > 0) {
    console.log(chalk.blue.bold('🏢 Official MCP Servers'));
    displayServerGroup(officialServers, showCompatibility, 'official');
    console.log();
  }

  // Display community servers
  if (communityServers.length > 0) {
    console.log(chalk.yellow.bold('👥 Community Servers'));
    displayServerGroup(communityServers, showCompatibility, 'community');
    console.log();
  }
}

/**
 * Display a group of servers
 */
function displayServerGroup(servers, showCompatibility, type) {
  servers.forEach((server, index) => {
    const prefix = type === 'known' ? '✓' : 
                  type === 'official' ? '🏢' : '👤';
    
    console.log(`${prefix} ${chalk.bold(server.displayName)} ${chalk.gray(`(${server.name})`)}`);
    console.log(`   ${server.description}`);
    console.log(`   ${chalk.gray('Category:')} ${server.category} ${chalk.gray('|')} ${chalk.gray('Source:')} ${server.source}`);
    
    if (server.capabilities && server.capabilities.length > 0) {
      const caps = server.capabilities.slice(0, 3).join(', ');
      const moreCount = server.capabilities.length - 3;
      console.log(`   ${chalk.gray('Capabilities:')} ${caps}${moreCount > 0 ? ` +${moreCount} more` : ''}`);
    }
    
    if (showCompatibility && server.compatibility) {
      const comp = server.compatibility;
      const status = comp.passed ? chalk.green('✓ Compatible') : chalk.red('✗ Issues');
      console.log(`   ${chalk.gray('Compatibility:')} ${status} (${comp.score}/${comp.maxScore})`);
    }
    
    if (server.package) {
      console.log(`   ${chalk.gray('Install:')} npm install ${server.package}`);
    } else if (server.repository) {
      console.log(`   ${chalk.gray('Repository:')} ${server.repository}`);
    }
    
    console.log();
  });
}

/**
 * Interactive server actions
 */
async function interactiveActions(servers) {
  const choices = [
    { name: 'View server details', value: 'details' },
    { name: 'Test server compatibility', value: 'test' },
    { name: 'Install a server', value: 'install' },
    { name: 'Search servers', value: 'search' },
    { name: 'Exit', value: 'exit' }
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices
    }
  ]);

  switch (action) {
    case 'details':
      await showServerDetails(servers);
      break;
    case 'test':
      await testServerInteractive(servers);
      break;
    case 'install':
      await interactiveInstall(servers);
      break;
    case 'search':
      await searchServerInteractive(servers);
      break;
    case 'exit':
      return;
  }
}

/**
 * Show detailed information about a server
 */
async function showServerDetails(servers) {
  const serverChoices = servers.map(server => ({
    name: `${server.displayName} - ${server.description}`,
    value: server
  }));

  const { selectedServer } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedServer',
      message: 'Select a server to view details:',
      choices: serverChoices,
      pageSize: 10
    }
  ]);

  console.log(chalk.blue.bold(`\n📋 ${selectedServer.displayName} Details\n`));
  console.log(`${chalk.bold('Name:')} ${selectedServer.name}`);
  console.log(`${chalk.bold('Description:')} ${selectedServer.description}`);
  console.log(`${chalk.bold('Category:')} ${selectedServer.category}`);
  console.log(`${chalk.bold('Source:')} ${selectedServer.source}`);
  console.log(`${chalk.bold('Official:')} ${selectedServer.official ? 'Yes' : 'No'}`);
  
  if (selectedServer.version) {
    console.log(`${chalk.bold('Version:')} ${selectedServer.version}`);
  }
  
  if (selectedServer.author) {
    console.log(`${chalk.bold('Author:')} ${selectedServer.author}`);
  }
  
  if (selectedServer.license) {
    console.log(`${chalk.bold('License:')} ${selectedServer.license}`);
  }
  
  if (selectedServer.capabilities && selectedServer.capabilities.length > 0) {
    console.log(`${chalk.bold('Capabilities:')}`);
    selectedServer.capabilities.forEach(cap => {
      console.log(`  • ${cap}`);
    });
  }
  
  if (selectedServer.keywords && selectedServer.keywords.length > 0) {
    console.log(`${chalk.bold('Keywords:')} ${selectedServer.keywords.join(', ')}`);
  }
  
  if (selectedServer.documentation) {
    console.log(`${chalk.bold('Documentation:')} ${selectedServer.documentation}`);
  }
  
  if (selectedServer.repository) {
    console.log(`${chalk.bold('Repository:')} ${selectedServer.repository}`);
  }
  
  if (selectedServer.package) {
    console.log(`${chalk.bold('NPM Package:')} ${selectedServer.package}`);
  }
  
  if (selectedServer.lastUpdated) {
    console.log(`${chalk.bold('Last Updated:')} ${new Date(selectedServer.lastUpdated).toLocaleDateString()}`);
  }
  
  console.log();
}

/**
 * Test server compatibility interactively
 */
async function testServerInteractive(servers) {
  const serverChoices = servers.map(server => ({
    name: `${server.displayName} - ${server.description}`,
    value: server
  }));

  const { selectedServer } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedServer',
      message: 'Select a server to test:',
      choices: serverChoices,
      pageSize: 10
    }
  ]);

  const { testLevel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'testLevel',
      message: 'Select test level:',
      choices: [
        { name: 'Basic (Installation & Startup)', value: TEST_LEVELS.BASIC },
        { name: 'Functional (Tools & Features)', value: TEST_LEVELS.FUNCTIONAL },
        { name: 'Full Protocol Compliance', value: TEST_LEVELS.PROTOCOL }
      ]
    }
  ]);

  console.log(chalk.blue(`\n🧪 Testing ${selectedServer.displayName}...\n`));
  
  const result = await testServerCompatibility(selectedServer, {
    level: testLevel,
    includeSecurity: true
  });

  displayTestResult(result);
}

/**
 * Display test result
 */
function displayTestResult(result) {
  console.log(chalk.blue.bold(`\n📊 Test Results for ${result.serverName}\n`));
  
  const status = result.passed ? chalk.green('✓ PASSED') : chalk.red('✗ FAILED');
  console.log(`${chalk.bold('Overall Status:')} ${status}`);
  console.log(`${chalk.bold('Score:')} ${result.score}/${result.maxScore} (${Math.round((result.score/result.maxScore)*100)}%)`);
  console.log(`${chalk.bold('Recommendation:')} ${getRecommendationDisplay(result.recommendation)}`);
  
  // Display test details
  if (result.tests.basic) {
    console.log(chalk.blue.bold('\nBasic Tests:'));
    displayTestGroup(result.tests.basic);
  }
  
  if (result.tests.functional) {
    console.log(chalk.blue.bold('\nFunctional Tests:'));
    displayTestGroup(result.tests.functional);
  }
  
  if (result.tests.protocol) {
    console.log(chalk.blue.bold('\nProtocol Tests:'));
    displayTestGroup(result.tests.protocol);
  }
  
  if (result.tests.security) {
    console.log(chalk.blue.bold('\nSecurity Tests:'));
    displayTestGroup(result.tests.security);
  }
  
  if (result.errors.length > 0) {
    console.log(chalk.red.bold('\nErrors:'));
    result.errors.forEach(error => {
      console.log(chalk.red(`  • ${error.message}`));
    });
  }
  
  if (result.warnings.length > 0) {
    console.log(chalk.yellow.bold('\nWarnings:'));
    result.warnings.forEach(warning => {
      console.log(chalk.yellow(`  • ${warning}`));
    });
  }
  
  console.log();
}

/**
 * Display test group results
 */
function displayTestGroup(tests) {
  Object.entries(tests).forEach(([testName, test]) => {
    const status = test.passed ? chalk.green('✓') : chalk.red('✗');
    const duration = test.duration ? chalk.gray(`(${test.duration}ms)`) : '';
    console.log(`  ${status} ${testName}: ${test.message} ${duration}`);
  });
}

/**
 * Get recommendation display
 */
function getRecommendationDisplay(recommendation) {
  const recommendations = {
    highly_recommended: chalk.green.bold('Highly Recommended'),
    recommended: chalk.green('Recommended'),
    use_with_caution: chalk.yellow('Use with Caution'),
    not_recommended: chalk.red('Not Recommended')
  };
  
  return recommendations[recommendation] || chalk.gray('Unknown');
}

/**
 * Interactive server installation
 */
async function interactiveInstall(servers) {
  // Filter to installable servers only
  const installableServers = servers.filter(server => 
    server.package || (server.repository && !MCP_SERVERS[server.id])
  );

  if (installableServers.length === 0) {
    console.log(chalk.yellow('No installable servers found.'));
    return;
  }

  const serverChoices = installableServers.map(server => ({
    name: `${server.displayName} - ${server.description} ${server.official ? '(Official)' : '(Community)'}`,
    value: server
  }));

  const { selectedServer } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedServer',
      message: 'Select a server to install:',
      choices: serverChoices,
      pageSize: 10
    }
  ]);

  const { confirmInstall } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmInstall',
      message: `Install ${selectedServer.displayName}?`,
      default: true
    }
  ]);

  if (confirmInstall) {
    console.log(chalk.blue(`\n📦 Installing ${selectedServer.displayName}...\n`));
    
    if (selectedServer.package) {
      console.log(chalk.gray(`Command: npm install ${selectedServer.package}`));
      console.log(chalk.yellow('Installation functionality will be implemented in the install command.'));
    } else {
      console.log(chalk.gray(`Repository: ${selectedServer.repository}`));
      console.log(chalk.yellow('Community server installation will be implemented in the community command.'));
    }
  }
}

/**
 * Interactive server search
 */
async function searchServerInteractive(servers) {
  const { searchQuery } = await inquirer.prompt([
    {
      type: 'input',
      name: 'searchQuery',
      message: 'Enter search query (name, description, or capability):',
      validate: input => input.trim().length > 0 || 'Please enter a search query'
    }
  ]);

  const { capability } = await inquirer.prompt([
    {
      type: 'input',
      name: 'capability',
      message: 'Filter by capability (optional):',
    }
  ]);

  const results = searchServers(servers, searchQuery, capability || null);
  
  if (results.length === 0) {
    console.log(chalk.yellow('\nNo servers found matching your search.'));
    return;
  }

  console.log(chalk.green(`\n🔍 Found ${results.length} matching servers:\n`));
  displayServers(results);
}
