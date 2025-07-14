/**
 * MCP Server Registry
 * 
 * This module manages the registry of available MCP servers and their capabilities.
 * It provides functionality to discover, validate, and install MCP servers.
 */

export const MCP_SERVERS = {
  // File & Document Management
  filesystem: {
    name: 'Filesystem',
    description: 'Local file system operations',
    capabilities: ['file:read', 'file:write', 'file:list', 'file:delete'],
    package: '@modelcontextprotocol/server-filesystem',
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem', '/Users/{username}/Documents'],
    category: 'storage',
    auth: 'none',
    permissions: ['high'],
    documentation: 'https://github.com/modelcontextprotocol/servers'
  },

  // Memory & Knowledge
  memory: {
    name: 'Memory',
    description: 'Memory for Claude through a knowledge graph',
    capabilities: ['memory:store', 'memory:retrieve', 'memory:search'],
    package: '@modelcontextprotocol/server-memory',
    command: 'npx',
    args: ['@modelcontextprotocol/server-memory'],
    category: 'ai',
    auth: 'none',
    permissions: ['medium'],
    documentation: 'https://github.com/modelcontextprotocol/servers'
  },

  // Browser Automation
  puppeteer: {
    name: 'Puppeteer',
    description: 'Browser automation using Puppeteer',
    capabilities: ['browser:navigate', 'browser:click', 'browser:screenshot'],
    package: '@hisma/server-puppeteer',
    command: 'npx',
    args: ['@hisma/server-puppeteer'],
    category: 'automation',
    auth: 'none',
    permissions: ['medium'],
    documentation: 'https://github.com/modelcontextprotocol/servers'
  },

  // Development & Testing
  everything: {
    name: 'Everything',
    description: 'Test server exercising all MCP protocol features',
    capabilities: ['test:tools', 'test:prompts', 'test:resources'],
    package: '@modelcontextprotocol/server-everything',
    command: 'npx',
    args: ['@modelcontextprotocol/server-everything'],
    category: 'development',
    auth: 'none',
    permissions: ['low'],
    documentation: 'https://github.com/modelcontextprotocol/servers'
  },

  // Thinking & Problem Solving
  sequential: {
    name: 'Sequential Thinking',
    description: 'Sequential thinking and problem solving',
    capabilities: ['thinking:sequential', 'thinking:breakdown', 'thinking:analyze'],
    package: '@modelcontextprotocol/server-sequential-thinking',
    command: 'npx',
    args: ['@modelcontextprotocol/server-sequential-thinking'],
    category: 'ai',
    auth: 'none',
    permissions: ['low'],
    documentation: 'https://github.com/modelcontextprotocol/servers'
  },

  // Web Scraping
  crawler: {
    name: 'Smart Crawler',
    description: 'Web crawling using Playwright',
    capabilities: ['web:crawl', 'web:scrape', 'web:extract'],
    package: 'mcp-smart-crawler',
    command: 'npx',
    args: ['mcp-smart-crawler'],
    category: 'web',
    auth: 'none',
    permissions: ['medium'],
    documentation: 'https://www.npmjs.com/package/mcp-smart-crawler'
  }
};

export const PROFILES = {
  personal: {
    name: 'Personal Assistant',
    description: 'File management, memory, and web automation',
    servers: ['filesystem', 'memory', 'puppeteer'],
    features: [
      'Manage local files and documents',
      'Remember important information',
      'Automate web browsing tasks'
    ]
  },
  
  developer: {
    name: 'Developer Plus',
    description: 'Enhanced development tools and testing',
    servers: ['filesystem', 'memory', 'everything'],
    features: [
      'File system operations',
      'Persistent memory across sessions',
      'Test all MCP protocol features'
    ]
  },
  
  researcher: {
    name: 'Research Assistant',
    description: 'Web research and knowledge management',
    servers: ['filesystem', 'memory', 'crawler', 'puppeteer'],
    features: [
      'Web crawling and data extraction',
      'Knowledge graph storage',
      'Document analysis and organization',
      'Browser automation for research'
    ]
  },
  
  thinker: {
    name: 'Sequential Thinker',
    description: 'Enhanced reasoning and problem solving',
    servers: ['memory', 'sequential', 'filesystem'],
    features: [
      'Sequential thinking workflows',
      'Problem breakdown and analysis',
      'Persistent memory for complex tasks',
      'Document storage and retrieval'
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
export function generateAmpConfig(serverIds) {
  const mcpServers = {};
  
  for (const serverId of serverIds) {
    const server = getServerConfig(serverId);
    
    mcpServers[serverId] = {
      command: server.command,
      args: server.args,
      ...(server.env && { env: server.env })
    };
  }
  
  return {
    'amp.mcpServers': mcpServers
  };
}
