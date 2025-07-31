/**
 * Search Command
 * 
 * Search for MCP servers by capability, name, or description.
 * Provides filtering and sorting options for discovered servers.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { discoverAllServers, searchServers, getServersByCategory, getCategories } from '../utils/discovery.js';
import { MCP_SERVERS } from '../registry.js';
import fs from 'fs-extra';
import path from 'path';

const DISCOVERY_CACHE_FILE = path.join(process.cwd(), '.ampgi-discovery-cache.json');

/**
 * Main search command handler
 */
export async function searchCommand(query, options = {}) {
  const { 
    capability = null,
    category = null,
    source = 'all',
    official = false,
    community = false,
    installed = false,
    limit = 20,
    sort = 'relevance'
  } = options;

  console.log(chalk.blue(`🔍 Searching MCP Servers: "${query}"\n`));

  try {
    // Load servers (from cache or discovery)
    let servers = await loadServers();
    
    if (servers.length === 0) {
      console.log(chalk.yellow('No servers available. Run "ampgi discover" first.'));
      return;
    }

    // Apply filters
    servers = applyFilters(servers, {
      query,
      capability,
      category,
      source,
      official,
      community,
      installed
    });

    if (servers.length === 0) {
      console.log(chalk.yellow('No servers found matching your criteria.'));
      suggestAlternatives(query, capability);
      return;
    }

    // Sort results
    servers = applySorting(servers, sort, query);

    // Limit results
    if (servers.length > limit) {
      servers = servers.slice(0, limit);
      console.log(chalk.gray(`Showing first ${limit} results\n`));
    }

    // Display results
    displaySearchResults(servers, query, {
      capability,
      category,
      source,
      official,
      community,
      installed
    });

    // Interactive actions
    if (process.env.NODE_ENV !== 'test') {
      await searchActions(servers);
    }

  } catch (error) {
    console.error(chalk.red(`Search failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Load servers from cache or discovery
 */
async function loadServers() {
  try {
    // Try to load from cache first
    if (await fs.pathExists(DISCOVERY_CACHE_FILE)) {
      const cached = await fs.readJson(DISCOVERY_CACHE_FILE);
      const age = Date.now() - cached.timestamp;
      
      // Use cache if less than 1 hour old
      if (age < 3600000) {
        return cached.data.servers || [];
      }
    }

    // If no cache or expired, do basic discovery
    console.log(chalk.gray('Loading server catalog...\n'));
    const servers = await discoverAllServers({ source: 'npm' });
    return servers || [];

  } catch (error) {
    console.warn(chalk.yellow(`Warning: Failed to load servers - ${error.message}`));
    return [];
  }
}

/**
 * Apply search and filter criteria
 */
function applyFilters(servers, filters) {
  let filtered = [...servers];

  // Text search
  if (filters.query) {
    filtered = searchServers(filtered, filters.query, filters.capability);
  }

  // Category filter
  if (filters.category) {
    filtered = filterServersByCategory(filtered, filters.category);
  }

  // Source filter
  if (filters.source && filters.source !== 'all') {
    filtered = filtered.filter(server => server.source === filters.source);
  }

  // Official/Community filters
  if (filters.official && !filters.community) {
    filtered = filtered.filter(server => server.official);
  } else if (filters.community && !filters.official) {
    filtered = filtered.filter(server => !server.official);
  }

  // Installed filter
  if (filters.installed) {
    filtered = filtered.filter(server => MCP_SERVERS[server.id]);
  }

  return filtered;
}

/**
 * Apply sorting to search results
 */
function applySorting(servers, sortBy, query) {
  switch (sortBy) {
    case 'relevance':
      return sortByRelevance(servers, query);
    case 'name':
      return sortServers(servers, 'name');
    case 'updated':
      return sortServers(servers, 'updated');
    case 'popularity':
      return sortServers(servers, 'popularity');
    case 'official':
      return sortServers(servers, 'official');
    default:
      return servers;
  }
}

/**
 * Sort servers by relevance to search query
 */
function sortByRelevance(servers, query) {
  if (!query) return servers;

  const queryLower = query.toLowerCase();
  
  return [...servers].sort((a, b) => {
    const scoreA = calculateRelevanceScore(a, queryLower);
    const scoreB = calculateRelevanceScore(b, queryLower);
    return scoreB - scoreA;
  });
}

/**
 * Calculate relevance score for a server
 */
function calculateRelevanceScore(server, query) {
  let score = 0;
  
  // Exact name match
  if (server.name.toLowerCase() === query) score += 100;
  else if (server.name.toLowerCase().includes(query)) score += 50;
  
  // Display name match
  if (server.displayName.toLowerCase().includes(query)) score += 30;
  
  // Description match
  if (server.description.toLowerCase().includes(query)) score += 20;
  
  // Category match
  if (server.category.toLowerCase().includes(query)) score += 15;
  
  // Capabilities match
  const capabilityMatches = (server.capabilities || []).filter(cap => 
    cap.toLowerCase().includes(query)
  ).length;
  score += capabilityMatches * 10;
  
  // Keywords match
  const keywordMatches = (server.keywords || []).filter(keyword => 
    keyword.toLowerCase().includes(query)
  ).length;
  score += keywordMatches * 5;
  
  // Boost official servers slightly
  if (server.official) score += 5;
  
  // Boost known servers
  if (MCP_SERVERS[server.id]) score += 10;
  
  return score;
}

/**
 * Display search results
 */
function displaySearchResults(servers, query, filters) {
  console.log(chalk.green(`Found ${servers.length} servers matching "${query}"\n`));
  
  // Show active filters
  const activeFilters = [];
  if (filters.capability) activeFilters.push(`capability: ${filters.capability}`);
  if (filters.category) activeFilters.push(`category: ${filters.category}`);
  if (filters.official) activeFilters.push('official only');
  if (filters.community) activeFilters.push('community only');
  if (filters.installed) activeFilters.push('installed only');
  
  if (activeFilters.length > 0) {
    console.log(chalk.gray(`Filters: ${activeFilters.join(', ')}\n`));
  }

  // Group results
  const groupedServers = groupSearchResults(servers);
  
  // Display each group
  Object.entries(groupedServers).forEach(([groupName, groupServers]) => {
    if (groupServers.length === 0) return;
    
    console.log(getGroupHeader(groupName));
    displayServerGroup(groupServers, query);
    console.log();
  });
}

/**
 * Group search results by type
 */
function groupSearchResults(servers) {
  const groups = {
    exact: [],
    installed: [],
    official: [],
    community: []
  };

  servers.forEach(server => {
    if (MCP_SERVERS[server.id]) {
      groups.installed.push(server);
    } else if (server.official) {
      groups.official.push(server);
    } else {
      groups.community.push(server);
    }
  });

  return groups;
}

/**
 * Get group header
 */
function getGroupHeader(groupName) {
  const headers = {
    exact: chalk.green.bold('🎯 Exact Matches'),
    installed: chalk.blue.bold('✓ Installed Servers'),
    official: chalk.cyan.bold('🏢 Official Servers'),
    community: chalk.yellow.bold('👥 Community Servers')
  };
  
  return headers[groupName] || chalk.white.bold(groupName);
}

/**
 * Display a group of servers
 */
function displayServerGroup(servers, query) {
  servers.forEach((server, index) => {
    const isInstalled = MCP_SERVERS[server.id];
    const prefix = isInstalled ? '✓' : 
                  server.official ? '🏢' : '👤';
    
    // Highlight query matches in name and description
    const highlightedName = highlightMatches(server.displayName, query);
    const highlightedDesc = highlightMatches(server.description, query);
    
    console.log(`${prefix} ${chalk.bold(highlightedName)} ${chalk.gray(`(${server.name})`)}`);
    console.log(`   ${highlightedDesc}`);
    
    // Show category and source
    const categoryIcon = getCategoryIcon(server.category);
    console.log(`   ${categoryIcon} ${chalk.gray('Category:')} ${server.category} ${chalk.gray('|')} ${chalk.gray('Source:')} ${server.source}`);
    
    // Show matching capabilities
    if (server.capabilities && server.capabilities.length > 0) {
      const matchingCaps = server.capabilities.filter(cap => 
        cap.toLowerCase().includes(query.toLowerCase())
      );
      
      if (matchingCaps.length > 0) {
        console.log(`   ${chalk.gray('Matching capabilities:')} ${matchingCaps.join(', ')}`);
      } else {
        const caps = server.capabilities.slice(0, 3).join(', ');
        const moreCount = server.capabilities.length - 3;
        console.log(`   ${chalk.gray('Capabilities:')} ${caps}${moreCount > 0 ? ` +${moreCount} more` : ''}`);
      }
    }
    
    // Show installation status
    if (isInstalled) {
      console.log(`   ${chalk.green('Status:')} Installed and ready to use`);
    } else if (server.package) {
      console.log(`   ${chalk.gray('Install:')} ampgi install -s ${server.id}`);
    } else if (server.repository) {
      console.log(`   ${chalk.gray('Repository:')} ${server.repository}`);
    }
    
    console.log();
  });
}

/**
 * Highlight query matches in text
 */
function highlightMatches(text, query) {
  if (!query || !text) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, chalk.yellow.bold('$1'));
}

/**
 * Get category icon
 */
function getCategoryIcon(category) {
  const icons = {
    database: '🗄️',
    development: '⚙️',
    web: '🌐',
    productivity: '📋',
    ai: '🧠',
    storage: '💾',
    utility: '🔧',
    cloud: '☁️'
  };
  
  return icons[category] || '📦';
}

/**
 * Suggest alternatives when no results found
 */
function suggestAlternatives(query, capability) {
  console.log(chalk.blue('\nSuggestions:'));
  
  if (capability) {
    console.log(`• Try searching without the capability filter`);
    console.log(`• Search for "${query}" in all categories`);
  }
  
  console.log(`• Try broader search terms (e.g., "file" instead of "filesystem")`);
  console.log(`• Run "ampgi discover" to refresh the server catalog`);
  console.log(`• Check available categories: database, development, web, productivity, ai, storage, utility, cloud`);
  
  // Suggest similar terms
  const suggestions = getSimilarTerms(query);
  if (suggestions.length > 0) {
    console.log(`• Did you mean: ${suggestions.join(', ')}?`);
  }
}

/**
 * Get similar search terms
 */
function getSimilarTerms(query) {
  const commonTerms = {
    'file': ['filesystem', 'storage', 'document'],
    'git': ['github', 'repository', 'version control'],
    'database': ['db', 'sql', 'data'],
    'web': ['http', 'api', 'browser'],
    'memory': ['storage', 'cache', 'knowledge'],
    'ai': ['llm', 'thinking', 'reasoning'],
    'cloud': ['aws', 'azure', 'gcp']
  };
  
  const queryLower = query.toLowerCase();
  for (const [term, alternatives] of Object.entries(commonTerms)) {
    if (queryLower.includes(term)) {
      return alternatives;
    }
  }
  
  return [];
}

/**
 * Interactive search actions
 */
async function searchActions(servers) {
  if (servers.length === 0) return;
  
  const choices = [
    { name: 'View server details', value: 'details' },
    { name: 'Install a server', value: 'install' },
    { name: 'Refine search', value: 'refine' },
    { name: 'Export results', value: 'export' },
    { name: 'Exit', value: 'exit' }
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with these results?',
      choices
    }
  ]);

  switch (action) {
    case 'details':
      await showServerDetails(servers);
      break;
    case 'install':
      await installFromSearch(servers);
      break;
    case 'refine':
      await refineSearch(servers);
      break;
    case 'export':
      await exportResults(servers);
      break;
    case 'exit':
      return;
  }
}

/**
 * Show detailed information about a selected server
 */
async function showServerDetails(servers) {
  const choices = servers.map(server => ({
    name: `${server.displayName} - ${server.description}`,
    value: server
  }));

  const { selectedServer } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedServer',
      message: 'Select a server to view details:',
      choices,
      pageSize: 10
    }
  ]);

  console.log(chalk.blue.bold(`\n📋 ${selectedServer.displayName} Details\n`));
  
  // Display comprehensive server information
  const details = [
    ['Name', selectedServer.name],
    ['Display Name', selectedServer.displayName],
    ['Description', selectedServer.description],
    ['Category', `${getCategoryIcon(selectedServer.category)} ${selectedServer.category}`],
    ['Source', selectedServer.source],
    ['Official', selectedServer.official ? 'Yes' : 'No'],
    ['Installed', MCP_SERVERS[selectedServer.id] ? 'Yes' : 'No']
  ];

  if (selectedServer.version) details.push(['Version', selectedServer.version]);
  if (selectedServer.author) details.push(['Author', selectedServer.author]);
  if (selectedServer.license) details.push(['License', selectedServer.license]);
  
  details.forEach(([label, value]) => {
    console.log(`${chalk.bold(label + ':')} ${value}`);
  });
  
  if (selectedServer.capabilities && selectedServer.capabilities.length > 0) {
    console.log(`${chalk.bold('Capabilities:')}`);
    selectedServer.capabilities.forEach(cap => {
      console.log(`  • ${cap}`);
    });
  }
  
  if (selectedServer.keywords && selectedServer.keywords.length > 0) {
    console.log(`${chalk.bold('Keywords:')} ${selectedServer.keywords.join(', ')}`);
  }
  
  console.log(`${chalk.bold('Documentation:')} ${selectedServer.documentation || 'Not available'}`);
  
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
 * Install a server from search results
 */
async function installFromSearch(servers) {
  const installableServers = servers.filter(server => 
    server.package && !MCP_SERVERS[server.id]
  );

  if (installableServers.length === 0) {
    console.log(chalk.yellow('No installable servers in search results.'));
    return;
  }

  const choices = installableServers.map(server => ({
    name: `${server.displayName} - ${server.description}`,
    value: server
  }));

  const { selectedServer } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedServer',
      message: 'Select a server to install:',
      choices,
      pageSize: 10
    }
  ]);

  console.log(chalk.blue(`\n📦 Installing ${selectedServer.displayName}...\n`));
  console.log(chalk.gray(`Command: ampgi install -s ${selectedServer.id}`));
  console.log(chalk.yellow('Use the install command to complete the installation.'));
}

/**
 * Refine search with new criteria
 */
async function refineSearch(servers) {
  console.log(chalk.blue('\n🔍 Refine Search\n'));
  
  const { newQuery } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newQuery',
      message: 'Enter new search query:',
      default: ''
    }
  ]);

  const { newCapability } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newCapability',
      message: 'Filter by capability (optional):',
      default: ''
    }
  ]);

  const { newCategory } = await inquirer.prompt([
    {
      type: 'list',
      name: 'newCategory',
      message: 'Filter by category:',
      choices: [
        { name: 'All categories', value: null },
        { name: 'Database', value: 'database' },
        { name: 'Development', value: 'development' },
        { name: 'Web', value: 'web' },
        { name: 'Productivity', value: 'productivity' },
        { name: 'AI', value: 'ai' },
        { name: 'Storage', value: 'storage' },
        { name: 'Utility', value: 'utility' },
        { name: 'Cloud', value: 'cloud' }
      ]
    }
  ]);

  // Execute refined search
  await searchCommand(newQuery, {
    capability: newCapability || null,
    category: newCategory,
    limit: 20
  });
}

/**
 * Export search results
 */
async function exportResults(servers) {
  const { format } = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Export format:',
      choices: [
        { name: 'JSON', value: 'json' },
        { name: 'CSV', value: 'csv' },
        { name: 'Markdown', value: 'md' }
      ]
    }
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `ampgi-search-results-${timestamp}.${format}`;
  
  try {
    let content;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(servers, null, 2);
        break;
      case 'csv':
        content = generateCSV(servers);
        break;
      case 'md':
        content = generateMarkdown(servers);
        break;
    }
    
    await fs.writeFile(filename, content);
    console.log(chalk.green(`\n✓ Results exported to ${filename}`));
    
  } catch (error) {
    console.error(chalk.red(`Export failed: ${error.message}`));
  }
}

/**
 * Generate CSV content
 */
function generateCSV(servers) {
  const headers = ['Name', 'Description', 'Category', 'Source', 'Official', 'Package', 'Repository'];
  const rows = servers.map(server => [
    server.name,
    server.description,
    server.category,
    server.source,
    server.official ? 'Yes' : 'No',
    server.package || '',
    server.repository || ''
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

/**
 * Generate Markdown content
 */
function generateMarkdown(servers) {
  let content = '# AmpGI Search Results\n\n';
  content += `Generated: ${new Date().toLocaleDateString()}\n`;
  content += `Total servers: ${servers.length}\n\n`;
  
  content += '## Servers\n\n';
  
  servers.forEach(server => {
    content += `### ${server.displayName}\n\n`;
    content += `- **Name:** ${server.name}\n`;
    content += `- **Description:** ${server.description}\n`;
    content += `- **Category:** ${server.category}\n`;
    content += `- **Source:** ${server.source}\n`;
    content += `- **Official:** ${server.official ? 'Yes' : 'No'}\n`;
    
    if (server.capabilities && server.capabilities.length > 0) {
      content += `- **Capabilities:** ${server.capabilities.join(', ')}\n`;
    }
    
    if (server.package) {
      content += `- **Package:** ${server.package}\n`;
    }
    
    if (server.repository) {
      content += `- **Repository:** ${server.repository}\n`;
    }
    
    content += '\n';
  });
  
  return content;
}
