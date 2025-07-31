/**
 * MCP Server Registry
 * 
 * This module manages the registry of available MCP servers and their capabilities.
 * It provides functionality to discover, validate, and install MCP servers.
 */

export const MCP_SERVERS = {
  // File & Document Management - VERIFIED WORKING
  filesystem: {
    name: 'Filesystem',
    description: 'Local file system operations with secure access controls',
    capabilities: ['file:read', 'file:write', 'file:list', 'file:delete', 'file:move', 'file:search'],
    package: '@modelcontextprotocol/server-filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/{username}/Documents'],
    category: 'storage',
    auth: 'none',
    permissions: ['high'],
    documentation: 'https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem',
    verified: true
  },

  // Memory & Knowledge - VERIFIED WORKING
  memory: {
    name: 'Memory',
    description: 'Persistent memory for AI through knowledge graphs',
    capabilities: ['memory:store', 'memory:retrieve', 'memory:search', 'memory:relate'],
    package: '@modelcontextprotocol/server-memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    category: 'ai',
    auth: 'none',
    permissions: ['medium'],
    documentation: 'https://www.npmjs.com/package/@modelcontextprotocol/server-memory',
    verified: true
  },

  // Development & Testing - VERIFIED WORKING
  everything: {
    name: 'Everything',
    description: 'Comprehensive test server for all MCP protocol features',
    capabilities: ['test:tools', 'test:prompts', 'test:resources', 'test:notifications'],
    package: '@modelcontextprotocol/server-everything',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    category: 'development',
    auth: 'none',
    permissions: ['low'],
    documentation: 'https://www.npmjs.com/package/@modelcontextprotocol/server-everything',
    verified: true
  },

  // Thinking & Problem Solving - VERIFIED WORKING
  sequential: {
    name: 'Sequential Thinking',
    description: 'Dynamic problem-solving through thought sequences',
    capabilities: ['thinking:sequential', 'thinking:breakdown', 'thinking:analyze', 'thinking:reflect'],
    package: '@modelcontextprotocol/server-sequential-thinking',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    category: 'ai',
    auth: 'none',
    permissions: ['low'],
    documentation: 'https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking',
    verified: true
  },

  // Database - PRODUCTION READY
  sqlite: {
    name: 'SQLite Database',
    description: 'Interact with SQLite databases - read, write, and query data',
    capabilities: ['db:query', 'db:read', 'db:write', 'db:schema'],
    package: 'mcp-server-sqlite-npx',
    command: 'npx',
    args: ['-y', 'mcp-server-sqlite-npx', '--db-path', '/Users/{username}/data.db'],
    category: 'database',
    auth: 'none',
    permissions: ['high'],
    documentation: 'https://github.com/johnnyoshika/mcp-server-sqlite-npx',
    verified: true
  },

  // Git Integration - PRODUCTION READY
  git: {
    name: 'Git Operations',
    description: 'LLM-friendly interface to git command-line operations',
    capabilities: ['git:status', 'git:log', 'git:diff', 'git:commit', 'git:branch', 'git:remote'],
    package: '@cyanheads/git-mcp-server',
    command: 'npx',
    args: ['-y', '@cyanheads/git-mcp-server'],
    category: 'development',
    auth: 'none',
    permissions: ['medium'],
    documentation: 'https://www.npmjs.com/package/@cyanheads/git-mcp-server',
    verified: true
  },

  // Browser Automation - PRODUCTION READY


  // Web Search & Extraction - PRODUCTION READY
  brave_search: {
    name: 'Brave Search',
    description: 'Web search and content extraction using Brave Search API',
    capabilities: ['search:web', 'search:news', 'search:images', 'content:extract'],
    package: 'mcp-server-brave-search',
    command: 'npx',
    args: ['-y', 'mcp-server-brave-search'],
    category: 'web',
    auth: 'api_key',
    permissions: ['low'],
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    verified: true,
    env: {
      BRAVE_SEARCH_API_KEY: 'your_brave_api_key'
    }
  },

  // Notion Integration - PRODUCTION READY
  notion: {
    name: 'Notion',
    description: 'Official Notion integration for workspace management',
    capabilities: ['page:read', 'page:write', 'database:query', 'block:manage'],
    package: '@notionhq/notion-mcp-server',
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    category: 'productivity',
    auth: 'api_key',
    permissions: ['high'],
    documentation: 'https://www.npmjs.com/package/@notionhq/notion-mcp-server',
    verified: true,
    env: {
      NOTION_API_KEY: 'your_notion_integration_token'
    }
  },

  // Cloudflare Integration - PRODUCTION READY
  cloudflare: {
    name: 'Cloudflare',
    description: 'Deploy and manage Cloudflare Workers, KV, R2, and D1',
    capabilities: ['worker:deploy', 'kv:read', 'kv:write', 'r2:manage', 'd1:query'],
    package: '@cloudflare/mcp-server-cloudflare',
    command: 'npx',
    args: ['-y', '@cloudflare/mcp-server-cloudflare'],
    category: 'cloud',
    auth: 'api_key',
    permissions: ['high'],
    documentation: 'https://github.com/cloudflare/mcp-server-cloudflare',
    verified: true,
    env: {
      CLOUDFLARE_API_TOKEN: 'your_cloudflare_api_token'
    }
  },

  // Time & Timezone - LIGHTWEIGHT UTILITY
  time: {
    name: 'Time',
    description: 'Time awareness capabilities for LLMs with timezone support',
    capabilities: ['time:current', 'time:format', 'time:calculate', 'timezone:convert'],
    package: 'time-mcp',
    command: 'npx',
    args: ['-y', 'time-mcp'],
    category: 'utility',
    auth: 'none',
    permissions: ['low'],
    documentation: 'https://www.npmjs.com/package/time-mcp',
    verified: true
  }
};

export const PROFILES = {
  personal: {
    name: 'Personal Assistant',
    description: 'File management, memory, and productivity tools',
    servers: ['filesystem', 'memory', 'notion', 'time'],
    features: [
      'Manage local files and documents',
      'Persistent memory across conversations',
      'Notion workspace integration',
      'Time and timezone utilities'
    ]
  },
  
  developer: {
    name: 'Developer Toolkit',
    description: 'Complete development environment with Git and database access',
    servers: ['filesystem', 'memory', 'git', 'sqlite', 'everything'],
    features: [
      'File system operations and code management',
      'Git repository integration and version control',
      'SQLite database interactions',
      'Persistent memory for development context',
      'Comprehensive MCP protocol testing'
    ]
  },
  
  researcher: {
    name: 'Research Assistant',
    description: 'Web research, data collection, and knowledge management',
    servers: ['filesystem', 'memory', 'brave_search', 'notion'],
    features: [
      'Web search and content extraction',
      'Knowledge storage in Notion',
      'Persistent research memory',
      'Document analysis and organization'
    ]
  },
  
  thinker: {
    name: 'Enhanced Reasoning',
    description: 'Advanced problem-solving with structured thinking',
    servers: ['memory', 'sequential', 'filesystem', 'time'],
    features: [
      'Sequential thinking workflows',
      'Dynamic problem breakdown and analysis',
      'Persistent memory for complex reasoning',
      'Document storage and retrieval',
      'Time-aware thinking processes'
    ]
  },

  enterprise: {
    name: 'Enterprise Suite',
    description: 'Full-featured enterprise productivity and development',
    servers: ['filesystem', 'memory', 'git', 'notion', 'cloudflare', 'sqlite'],
    features: [
      'Comprehensive file and code management',
      'Git integration for team development',
      'Notion workspace collaboration',
      'Cloudflare infrastructure management',
      'Database operations and queries',
      'Persistent enterprise knowledge base'
    ]
  },

  web_automation: {
    name: 'Web Automation',
    description: 'Specialized web search and data collection',
    servers: ['brave_search', 'memory', 'filesystem'],
    features: [
      'Advanced web search capabilities',
      'Content extraction and analysis',
      'Automated workflow memory',
      'Results storage and management'
    ]
  }
};

/**
 * Get MCP server configuration by ID
 */
export function getServerConfig(serverId) {
  const server = MCP_SERVERS[serverId];
  if (!server) {
    throw new Error(`Unknown MCP server: ${serverId}`);
  }
  return server;
}

/**
 * Get profile configuration by ID
 */
export function getProfileConfig(profileId) {
  const profile = PROFILES[profileId];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileId}`);
  }
  return profile;
}

/**
 * List all available MCP servers
 */
export function listServers() {
  return Object.entries(MCP_SERVERS).map(([id, config]) => ({
    id,
    ...config
  }));
}

/**
 * List all available profiles
 */
export function listProfiles() {
  return Object.entries(PROFILES).map(([id, config]) => ({
    id,
    ...config
  }));
}

/**
 * Generate MCP server configuration for Amp
 */
export async function generateAmpConfig(serverIds, credentialEnvVars = {}) {
  const mcpServers = {};
  const allServers = getAllServers();
  
  for (const serverId of serverIds) {
    const server = allServers[serverId];
    if (!server) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }
    
    // Merge server env with credential env vars
    const envVars = { ...server.env };
    if (credentialEnvVars[serverId]) {
      Object.assign(envVars, credentialEnvVars[serverId]);
    }
    
    if (server.command && server.args) {
      mcpServers[serverId] = {
        command: server.command,
        args: server.args,
        ...(Object.keys(envVars).length > 0 && { env: envVars })
      };
    } else if (server.package) {
      // Generate default configuration for discovered servers
      mcpServers[serverId] = {
        command: 'npx',
        args: ['-y', server.package],
        ...(Object.keys(envVars).length > 0 && { env: envVars })
      };
    }
  }
  
  return {
    'amp.mcpServers': mcpServers
  };
}

/**
 * Dynamic server registry for discovered servers
 */
let dynamicServers = {};

/**
 * Add discovered server to dynamic registry
 */
export function addDynamicServer(serverId, serverConfig) {
  dynamicServers[serverId] = {
    ...serverConfig,
    isDynamic: true,
    addedAt: new Date().toISOString()
  };
}

/**
 * Remove server from dynamic registry
 */
export function removeDynamicServer(serverId) {
  delete dynamicServers[serverId];
}

/**
 * Get all servers (static + dynamic)
 */
export function getAllServers() {
  return {
    ...MCP_SERVERS,
    ...dynamicServers
  };
}

/**
 * Get server configuration by ID (includes dynamic servers)
 */
export function getServerConfigExtended(serverId) {
  const allServers = getAllServers();
  const server = allServers[serverId];
  if (!server) {
    throw new Error(`Unknown MCP server: ${serverId}`);
  }
  return server;
}

/**
 * List all available MCP servers (including dynamic)
 */
export function listAllServers() {
  const allServers = getAllServers();
  return Object.entries(allServers).map(([id, config]) => ({
    id,
    ...config
  }));
}

/**
 * Check if server is installed/available
 */
export function isServerInstalled(serverId) {
  const allServers = getAllServers();
  return !!allServers[serverId];
}

/**
 * Get servers by category
 */
export function getServersByCategory(category) {
  const allServers = getAllServers();
  return Object.entries(allServers)
    .filter(([_, config]) => config.category === category)
    .map(([id, config]) => ({ id, ...config }));
}

/**
 * Search servers by capability
 */
export function searchServersByCapability(capability) {
  const allServers = getAllServers();
  return Object.entries(allServers)
    .filter(([_, config]) => 
      config.capabilities && 
      config.capabilities.some(cap => 
        cap.toLowerCase().includes(capability.toLowerCase())
      )
    )
    .map(([id, config]) => ({ id, ...config }));
}

/**
 * Convert discovered server to registry format
 */
export function convertDiscoveredServer(discoveredServer) {
  const serverId = discoveredServer.id;
  
  // Create registry-compatible configuration
  const config = {
    name: discoveredServer.displayName || discoveredServer.name,
    description: discoveredServer.description,
    capabilities: discoveredServer.capabilities || [],
    category: discoveredServer.category || 'utility',
    auth: 'none', // Default, can be updated
    permissions: ['medium'], // Default, can be updated
    documentation: discoveredServer.documentation,
    verified: false, // Will be set by compatibility testing
    source: discoveredServer.source,
    official: discoveredServer.official || false,
    
    // Installation configuration
    ...(discoveredServer.package && {
      package: discoveredServer.package,
      command: 'npx',
      args: ['-y', discoveredServer.package]
    }),
    
    // Repository information
    ...(discoveredServer.repository && {
      repository: discoveredServer.repository
    }),
    
    // Metadata
    version: discoveredServer.version,
    author: discoveredServer.author,
    license: discoveredServer.license,
    lastUpdated: discoveredServer.lastUpdated,
    keywords: discoveredServer.keywords || []
  };

  return { serverId, config };
}

/**
 * Update server registry from discovered servers
 */
export function updateRegistryFromDiscovery(discoveredServers) {
  const updates = {
    added: [],
    updated: [],
    errors: []
  };

  for (const discoveredServer of discoveredServers) {
    try {
      const { serverId, config } = convertDiscoveredServer(discoveredServer);
      
      // Check if server already exists
      const allServers = getAllServers();
      if (allServers[serverId]) {
        // Update existing server
        if (dynamicServers[serverId]) {
          dynamicServers[serverId] = {
            ...dynamicServers[serverId],
            ...config,
            updatedAt: new Date().toISOString()
          };
          updates.updated.push(serverId);
        }
      } else {
        // Add new server
        addDynamicServer(serverId, config);
        updates.added.push(serverId);
      }
      
    } catch (error) {
      updates.errors.push({
        server: discoveredServer.name,
        error: error.message
      });
    }
  }

  return updates;
}

/**
 * Save dynamic registry to file
 */
export async function saveDynamicRegistry() {
  try {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const registryFile = path.join(process.cwd(), '.ampgi-dynamic-registry.json');
    await fs.writeJson(registryFile, {
      timestamp: new Date().toISOString(),
      servers: dynamicServers
    }, { spaces: 2 });
    
    return registryFile;
  } catch (error) {
    throw new Error(`Failed to save dynamic registry: ${error.message}`);
  }
}

/**
 * Load dynamic registry from file
 */
export async function loadDynamicRegistry() {
  try {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const registryFile = path.join(process.cwd(), '.ampgi-dynamic-registry.json');
    
    if (await fs.pathExists(registryFile)) {
      const data = await fs.readJson(registryFile);
      dynamicServers = data.servers || {};
      return data.timestamp;
    }
  } catch (error) {
    console.warn(`Warning: Failed to load dynamic registry - ${error.message}`);
  }
  return null;
}
