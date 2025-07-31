/**
 * MCP Server Discovery Utilities
 * 
 * This module provides functionality to discover MCP servers from various sources,
 * including the official MCP repository, npm registry, and other verified sources.
 */

import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';

/**
 * Discovery cache configuration
 */
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_FILE = '.ampgi-discovery-cache.json';

/**
 * Official MCP server sources
 */
const DISCOVERY_SOURCES = {
  npm: {
    name: 'NPM Registry',
    description: 'Official @modelcontextprotocol packages from npm',
    url: 'https://registry.npmjs.org/-/v1/search',
    enabled: true
  },
  github: {
    name: 'GitHub Repository',
    description: 'Official MCP servers repository',
    url: 'https://api.github.com/repos/modelcontextprotocol/servers',
    enabled: true
  }
};

/**
 * Known official packages that should be prioritized
 */
const OFFICIAL_PACKAGES = [
  '@modelcontextprotocol/server-filesystem',
  '@modelcontextprotocol/server-memory',
  '@modelcontextprotocol/server-everything',
  '@modelcontextprotocol/server-sequential-thinking',
  '@modelcontextprotocol/server-brave-search',
  '@modelcontextprotocol/server-github',
  '@modelcontextprotocol/server-sqlite',
  '@modelcontextprotocol/server-postgres',
  '@modelcontextprotocol/server-puppeteer',
  '@modelcontextprotocol/server-fetch',
  '@modelcontextprotocol/server-git',
  '@modelcontextprotocol/server-time',
  '@notionhq/notion-mcp-server',
  '@cloudflare/mcp-server-cloudflare'
];

/**
 * Load discovery cache from file
 */
export async function loadDiscoveryCache() {
  try {
    const cacheFile = path.join(process.cwd(), CACHE_FILE);
    
    if (await fs.pathExists(cacheFile)) {
      const cache = await fs.readJson(cacheFile);
      const now = Date.now();
      
      // Check if cache is still valid
      if (cache.timestamp && (now - cache.timestamp) < CACHE_DURATION) {
        return cache.servers || [];
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to load discovery cache - ${error.message}`);
  }
  
  return null;
}

/**
 * Save discovery cache to file
 */
export async function saveDiscoveryCache(servers) {
  try {
    const cacheFile = path.join(process.cwd(), CACHE_FILE);
    const cache = {
      timestamp: Date.now(),
      servers,
      sources: Object.keys(DISCOVERY_SOURCES),
      version: '1.0'
    };
    
    await fs.writeJson(cacheFile, cache, { spaces: 2 });
    return cacheFile;
  } catch (error) {
    console.warn(`Warning: Failed to save discovery cache - ${error.message}`);
    return null;
  }
}

/**
 * Discover MCP servers from npm registry
 */
export async function discoverFromNpm() {
  const servers = [];
  
  try {
    // Search for official @modelcontextprotocol packages
    const searchUrl = `${DISCOVERY_SOURCES.npm.url}?text=@modelcontextprotocol&size=50`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    for (const pkg of data.objects || []) {
      const packageData = pkg.package;
      
      // Only include official packages or well-known community packages
      if (packageData.name.startsWith('@modelcontextprotocol/') || 
          OFFICIAL_PACKAGES.includes(packageData.name)) {
        
        const server = {
          id: packageData.name.replace(/[@/]/g, '-').replace(/^-+/, ''),
          name: packageData.name,
          displayName: packageData.name.replace('@modelcontextprotocol/server-', '').replace(/-/g, ' '),
          description: packageData.description || 'No description available',
          package: packageData.name,
          version: packageData.version,
          author: packageData.publisher?.username || packageData.author?.name || 'Unknown',
          license: packageData.license || 'Unknown',
          repository: packageData.links?.repository,
          documentation: packageData.links?.homepage || `https://www.npmjs.com/package/${packageData.name}`,
          keywords: packageData.keywords || [],
          lastUpdated: packageData.date,
          source: 'npm',
          official: packageData.name.startsWith('@modelcontextprotocol/') || OFFICIAL_PACKAGES.includes(packageData.name),
          category: inferCategory(packageData.name, packageData.description, packageData.keywords),
          capabilities: inferCapabilities(packageData.name, packageData.description, packageData.keywords)
        };
        
        servers.push(server);
      }
    }
    
    // Also search for other well-known MCP servers
    const additionalSearches = [
      'mcp-server',
      'model-context-protocol'
    ];
    
    for (const term of additionalSearches) {
      try {
        const searchUrl = `${DISCOVERY_SOURCES.npm.url}?text=${term}&size=20`;
        const response = await fetch(searchUrl);
        
        if (response.ok) {
          const data = await response.json();
          
          for (const pkg of data.objects || []) {
            const packageData = pkg.package;
            
            // Filter for relevant packages and avoid duplicates
            if (isRelevantMcpPackage(packageData) && 
                !servers.find(s => s.package === packageData.name)) {
              
              const server = {
                id: packageData.name.replace(/[@/\-\.]/g, '_').replace(/^_+/, ''),
                name: packageData.name,
                displayName: packageData.name.replace(/mcp-server-?/i, '').replace(/-/g, ' '),
                description: packageData.description || 'No description available',
                package: packageData.name,
                version: packageData.version,
                author: packageData.publisher?.username || packageData.author?.name || 'Unknown',
                license: packageData.license || 'Unknown',
                repository: packageData.links?.repository,
                documentation: packageData.links?.homepage || `https://www.npmjs.com/package/${packageData.name}`,
                keywords: packageData.keywords || [],
                lastUpdated: packageData.date,
                source: 'npm',
                official: OFFICIAL_PACKAGES.includes(packageData.name),
                category: inferCategory(packageData.name, packageData.description, packageData.keywords),
                capabilities: inferCapabilities(packageData.name, packageData.description, packageData.keywords)
              };
              
              servers.push(server);
            }
          }
        }
      } catch (error) {
        console.warn(`Warning: Failed to search for ${term} - ${error.message}`);
      }
    }
    
  } catch (error) {
    throw new Error(`Failed to discover servers from npm: ${error.message}`);
  }
  
  return servers;
}

/**
 * Discover MCP servers from GitHub repository
 */
export async function discoverFromGitHub() {
  const servers = [];
  
  try {
    // Get repository information
    const repoUrl = DISCOVERY_SOURCES.github.url;
    const response = await fetch(repoUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const repoData = await response.json();
    
    // Get contents of the src directory
    const contentsUrl = `${repoUrl}/contents/src`;
    const contentsResponse = await fetch(contentsUrl);
    
    if (contentsResponse.ok) {
      const contents = await contentsResponse.json();
      
      for (const item of contents) {
        if (item.type === 'dir') {
          try {
            // Get package.json for each server
            const packageUrl = `${repoUrl}/contents/src/${item.name}/package.json`;
            const packageResponse = await fetch(packageUrl);
            
            if (packageResponse.ok) {
              const packageFile = await packageResponse.json();
              const packageContent = JSON.parse(Buffer.from(packageFile.content, 'base64').toString());
              
              const server = {
                id: item.name.replace(/[-\.]/g, '_'),
                name: packageContent.name || item.name,
                displayName: item.name.replace(/-/g, ' '),
                description: packageContent.description || 'Official MCP server',
                package: packageContent.name,
                version: packageContent.version || '1.0.0',
                author: packageContent.author || 'Model Context Protocol Team',
                license: packageContent.license || 'MIT',
                repository: `https://github.com/modelcontextprotocol/servers/tree/main/src/${item.name}`,
                documentation: `https://github.com/modelcontextprotocol/servers/tree/main/src/${item.name}`,
                keywords: packageContent.keywords || [],
                lastUpdated: repoData.updated_at,
                source: 'github',
                official: true,
                category: inferCategory(item.name, packageContent.description, packageContent.keywords),
                capabilities: inferCapabilities(item.name, packageContent.description, packageContent.keywords)
              };
              
              servers.push(server);
            }
          } catch (error) {
            console.warn(`Warning: Failed to process ${item.name} - ${error.message}`);
          }
        }
      }
    }
    
  } catch (error) {
    throw new Error(`Failed to discover servers from GitHub: ${error.message}`);
  }
  
  return servers;
}

/**
 * Discover all MCP servers from enabled sources
 */
export async function discoverAllServers(options = {}) {
  const { source = 'all', useCache = true, limit = 50 } = options;
  
  // Try to load from cache first
  if (useCache) {
    const cachedServers = await loadDiscoveryCache();
    if (cachedServers) {
      console.log('Using cached discovery results');
      return limitResults(filterBySource(cachedServers, source), limit);
    }
  }
  
  const allServers = [];
  const sources = [];
  
  // Determine which sources to use
  if (source === 'all' || source === 'npm') {
    sources.push('npm');
  }
  if (source === 'all' || source === 'github') {
    sources.push('github');
  }
  
  // Discover from each source
  for (const src of sources) {
    try {
      console.log(`Discovering servers from ${src}...`);
      
      let servers = [];
      if (src === 'npm') {
        servers = await discoverFromNpm();
      } else if (src === 'github') {
        servers = await discoverFromGitHub();
      }
      
      console.log(`Found ${servers.length} servers from ${src}`);
      allServers.push(...servers);
      
    } catch (error) {
      console.warn(`Warning: Discovery from ${src} failed - ${error.message}`);
    }
  }
  
  // Deduplicate servers (prefer npm versions)
  const uniqueServers = deduplicateServers(allServers);
  
  // Cache the results
  if (useCache) {
    await saveDiscoveryCache(uniqueServers);
  }
  
  return limitResults(uniqueServers, limit);
}

/**
 * Check if a package is relevant to MCP
 */
function isRelevantMcpPackage(packageData) {
  const name = packageData.name?.toLowerCase() || '';
  const description = packageData.description?.toLowerCase() || '';
  const keywords = (packageData.keywords || []).join(' ').toLowerCase();
  
  // Include if it mentions MCP or Model Context Protocol
  if (name.includes('mcp') || 
      description.includes('mcp') || 
      description.includes('model context protocol') ||
      keywords.includes('mcp') ||
      keywords.includes('model-context-protocol')) {
    return true;
  }
  
  // Include well-known MCP servers
  if (OFFICIAL_PACKAGES.includes(packageData.name)) {
    return true;
  }
  
  return false;
}

/**
 * Infer server category from name, description, and keywords
 */
function inferCategory(name, description, keywords) {
  const text = `${name} ${description} ${keywords?.join(' ')}`.toLowerCase();
  
  if (text.includes('file') || text.includes('filesystem') || text.includes('storage')) return 'storage';
  if (text.includes('database') || text.includes('sql') || text.includes('postgres') || text.includes('sqlite')) return 'database';
  if (text.includes('git') || text.includes('github') || text.includes('repo')) return 'development';
  if (text.includes('web') || text.includes('http') || text.includes('fetch') || text.includes('browser')) return 'web';
  if (text.includes('ai') || text.includes('llm') || text.includes('memory') || text.includes('thinking')) return 'ai';
  if (text.includes('cloud') || text.includes('aws') || text.includes('azure') || text.includes('gcp')) return 'cloud';
  if (text.includes('notion') || text.includes('productivity') || text.includes('task')) return 'productivity';
  if (text.includes('search') || text.includes('brave')) return 'search';
  if (text.includes('time') || text.includes('timezone') || text.includes('calendar')) return 'utility';
  
  return 'utility';
}

/**
 * Infer server capabilities from name, description, and keywords
 */
function inferCapabilities(name, description, keywords) {
  const text = `${name} ${description} ${keywords?.join(' ')}`.toLowerCase();
  const capabilities = [];
  
  if (text.includes('file') || text.includes('filesystem')) {
    capabilities.push('file:read', 'file:write', 'file:list');
  }
  if (text.includes('database') || text.includes('sql')) {
    capabilities.push('db:query', 'db:read', 'db:write');
  }
  if (text.includes('git')) {
    capabilities.push('git:status', 'git:log', 'git:commit');
  }
  if (text.includes('web') || text.includes('http') || text.includes('fetch')) {
    capabilities.push('web:fetch', 'web:parse', 'web:navigate');
  }
  if (text.includes('search')) {
    capabilities.push('search:web', 'search:query');
  }
  if (text.includes('memory')) {
    capabilities.push('memory:store', 'memory:retrieve', 'memory:search');
  }
  if (text.includes('time')) {
    capabilities.push('time:current', 'time:format', 'time:convert');
  }
  
  return capabilities.length > 0 ? capabilities : ['general'];
}

/**
 * Deduplicate servers, preferring npm versions over github
 */
function deduplicateServers(servers) {
  const seen = new Map();
  
  // Sort by source priority (npm first, then github)
  servers.sort((a, b) => {
    if (a.source === 'npm' && b.source !== 'npm') return -1;
    if (a.source !== 'npm' && b.source === 'npm') return 1;
    return 0;
  });
  
  for (const server of servers) {
    const key = server.package || server.name;
    if (!seen.has(key)) {
      seen.set(key, server);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Filter servers by source
 */
function filterBySource(servers, source) {
  if (source === 'all') return servers;
  return servers.filter(server => server.source === source);
}

/**
 * Limit results
 */
function limitResults(servers, limit) {
  return servers.slice(0, limit);
}

/**
 * Search servers by query
 */
export function searchServers(servers, query, options = {}) {
  const {
    capability,
    category,
    official,
    installed,
    sort = 'relevance'
  } = options;
  
  let filtered = [...servers];
  
  // Apply filters
  if (capability) {
    filtered = filtered.filter(server => 
      server.capabilities?.some(cap => 
        cap.toLowerCase().includes(capability.toLowerCase())
      )
    );
  }
  
  if (category) {
    filtered = filtered.filter(server => 
      server.category === category
    );
  }
  
  if (official !== undefined) {
    filtered = filtered.filter(server => 
      server.official === official
    );
  }
  
  // Search by query
  if (query) {
    const queryLower = query.toLowerCase();
    filtered = filtered.filter(server => {
      const searchText = `${server.name} ${server.displayName} ${server.description} ${server.keywords?.join(' ')}`.toLowerCase();
      return searchText.includes(queryLower);
    });
  }
  
  // Sort results
  if (sort === 'relevance' && query) {
    filtered = filtered.sort((a, b) => {
      const aScore = calculateRelevanceScore(a, query);
      const bScore = calculateRelevanceScore(b, query);
      return bScore - aScore;
    });
  } else if (sort === 'name') {
    filtered = filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
  } else if (sort === 'updated') {
    filtered = filtered.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  } else if (sort === 'official') {
    filtered = filtered.sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0));
  }
  
  return filtered;
}

/**
 * Calculate relevance score for search
 */
function calculateRelevanceScore(server, query) {
  const queryLower = query.toLowerCase();
  let score = 0;
  
  // Name match (highest priority)
  if (server.name.toLowerCase().includes(queryLower)) score += 10;
  if (server.displayName.toLowerCase().includes(queryLower)) score += 8;
  
  // Description match
  if (server.description.toLowerCase().includes(queryLower)) score += 5;
  
  // Keywords match
  if (server.keywords?.some(keyword => keyword.toLowerCase().includes(queryLower))) {
    score += 3;
  }
  
  // Capabilities match
  if (server.capabilities?.some(cap => cap.toLowerCase().includes(queryLower))) {
    score += 4;
  }
  
  // Official servers get bonus
  if (server.official) score += 2;
  
  return score;
}

/**
 * Get server info by ID
 */
export function getServerInfo(servers, serverId) {
  return servers.find(server => 
    server.id === serverId || 
    server.name === serverId ||
    server.package === serverId
  );
}

/**
 * Get servers by category
 */
export function getServersByCategory(servers, category) {
  return servers.filter(server => server.category === category);
}

/**
 * Get unique categories from servers
 */
export function getCategories(servers) {
  const categories = new Set();
  servers.forEach(server => {
    if (server.category) {
      categories.add(server.category);
    }
  });
  return Array.from(categories).sort();
}

/**
 * Get server statistics
 */
export function getDiscoveryStats(servers) {
  const stats = {
    total: servers.length,
    official: servers.filter(s => s.official).length,
    community: servers.filter(s => !s.official).length,
    sources: {},
    categories: {}
  };
  
  // Count by source
  servers.forEach(server => {
    stats.sources[server.source] = (stats.sources[server.source] || 0) + 1;
  });
  
  // Count by category
  servers.forEach(server => {
    if (server.category) {
      stats.categories[server.category] = (stats.categories[server.category] || 0) + 1;
    }
  });
  
  return stats;
}

export default {
  discoverAllServers,
  discoverFromNpm,
  discoverFromGitHub,
  searchServers,
  getServerInfo,
  getServersByCategory,
  getCategories,
  getDiscoveryStats,
  loadDiscoveryCache,
  saveDiscoveryCache
};
