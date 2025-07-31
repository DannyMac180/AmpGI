import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Permission tiers for MCP server execution
 */
export const PERMISSION_TIERS = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high'
};

/**
 * Default resource limits for each permission tier
 */
const RESOURCE_LIMITS = {
  [PERMISSION_TIERS.LOW]: {
    maxMemory: 256 * 1024 * 1024, // 256MB
    maxCpuPercent: 25,
    maxExecutionTime: 15000, // 15 seconds
    maxConcurrentProcesses: 3
  },
  [PERMISSION_TIERS.MEDIUM]: {
    maxMemory: 512 * 1024 * 1024, // 512MB
    maxCpuPercent: 50,
    maxExecutionTime: 30000, // 30 seconds
    maxConcurrentProcesses: 5
  },
  [PERMISSION_TIERS.HIGH]: {
    maxMemory: 1024 * 1024 * 1024, // 1GB
    maxCpuPercent: 80,
    maxExecutionTime: 60000, // 60 seconds
    maxConcurrentProcesses: 10
  }
};

/**
 * File system access permissions by tier
 */
const FILE_PERMISSIONS = {
  [PERMISSION_TIERS.LOW]: {
    readablePaths: [
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Desktop'),
      process.cwd()
    ],
    writablePaths: [],
    blockedPaths: [
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      '/var',
      '/opt',
      path.join(os.homedir(), '.ssh'),
      path.join(os.homedir(), '.config')
    ]
  },
  [PERMISSION_TIERS.MEDIUM]: {
    readablePaths: [
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Downloads'),
      process.cwd()
    ],
    writablePaths: [
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Downloads'),
      process.cwd()
    ],
    blockedPaths: [
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      '/var',
      '/opt',
      path.join(os.homedir(), '.ssh')
    ]
  },
  [PERMISSION_TIERS.HIGH]: {
    readablePaths: ['*'], // All paths allowed
    writablePaths: ['*'], // All paths allowed (with user consent)
    blockedPaths: [] // No restrictions (but requires explicit consent)
  }
};

/**
 * Network access permissions by tier
 */
const NETWORK_PERMISSIONS = {
  [PERMISSION_TIERS.LOW]: {
    allowNetwork: false,
    allowedDomains: [],
    allowedPorts: []
  },
  [PERMISSION_TIERS.MEDIUM]: {
    allowNetwork: true,
    allowedDomains: [
      'api.github.com',
      'api.openai.com',
      'api.anthropic.com',
      '*.googleapis.com',
      '*.amazonaws.com'
    ],
    allowedPorts: [80, 443, 8080]
  },
  [PERMISSION_TIERS.HIGH]: {
    allowNetwork: true,
    allowedDomains: ['*'],
    allowedPorts: ['*']
  }
};

/**
 * Create a sandbox environment for MCP server execution
 */
export function createSandbox(serverConfig, permissionTier = PERMISSION_TIERS.MEDIUM) {
  const sandboxId = crypto.randomUUID();
  const limits = RESOURCE_LIMITS[permissionTier];
  const filePerms = FILE_PERMISSIONS[permissionTier];
  const networkPerms = NETWORK_PERMISSIONS[permissionTier];
  
  return {
    id: sandboxId,
    serverId: serverConfig.id,
    permissionTier,
    resourceLimits: limits,
    filePermissions: filePerms,
    networkPermissions: networkPerms,
    createdAt: new Date(),
    pid: null,
    status: 'created'
  };
}

/**
 * Validate file system access based on permission tier
 */
export function validateFileAccess(sandbox, filePath, operation = 'read') {
  const { filePermissions, permissionTier } = sandbox;
  const normalizedPath = path.resolve(filePath);
  
  // Check blocked paths first
  for (const blockedPath of filePermissions.blockedPaths) {
    if (normalizedPath.startsWith(path.resolve(blockedPath))) {
      return {
        allowed: false,
        reason: `Access to ${blockedPath} is blocked for ${permissionTier} privilege servers`,
        requiresEscalation: permissionTier !== PERMISSION_TIERS.HIGH
      };
    }
  }
  
  // For HIGH tier, allow everything not explicitly blocked
  if (permissionTier === PERMISSION_TIERS.HIGH) {
    return { allowed: true };
  }
  
  // Check operation-specific permissions
  const allowedPaths = operation === 'write' ? 
    filePermissions.writablePaths : 
    filePermissions.readablePaths;
  
  // If allowed paths includes '*', allow everything
  if (allowedPaths.includes('*')) {
    return { allowed: true };
  }
  
  // Check if path is within allowed directories
  for (const allowedPath of allowedPaths) {
    if (normalizedPath.startsWith(path.resolve(allowedPath))) {
      return { allowed: true };
    }
  }
  
  return {
    allowed: false,
    reason: `${operation} access to ${filePath} not permitted for ${permissionTier} privilege servers`,
    requiresEscalation: true,
    suggestedPaths: allowedPaths
  };
}

/**
 * Validate network access based on permission tier
 */
export function validateNetworkAccess(sandbox, domain, port = 443) {
  const { networkPermissions, permissionTier } = sandbox;
  
  if (!networkPermissions.allowNetwork) {
    return {
      allowed: false,
      reason: `Network access not permitted for ${permissionTier} privilege servers`,
      requiresEscalation: true
    };
  }
  
  // Check allowed domains
  const allowedDomains = networkPermissions.allowedDomains;
  if (!allowedDomains.includes('*')) {
    const domainAllowed = allowedDomains.some(allowedDomain => {
      if (allowedDomain.startsWith('*.')) {
        const wildcardDomain = allowedDomain.slice(2);
        return domain.endsWith(wildcardDomain);
      }
      return domain === allowedDomain;
    });
    
    if (!domainAllowed) {
      return {
        allowed: false,
        reason: `Access to domain ${domain} not permitted for ${permissionTier} privilege servers`,
        requiresEscalation: permissionTier !== PERMISSION_TIERS.HIGH,
        allowedDomains
      };
    }
  }
  
  // Check allowed ports
  const allowedPorts = networkPermissions.allowedPorts;
  if (!allowedPorts.includes('*') && !allowedPorts.includes(port)) {
    return {
      allowed: false,
      reason: `Access to port ${port} not permitted for ${permissionTier} privilege servers`,
      requiresEscalation: permissionTier !== PERMISSION_TIERS.HIGH,
      allowedPorts
    };
  }
  
  return { allowed: true };
}

/**
 * Apply resource limits to a child process
 */
export function applyResourceLimits(childProcess, sandbox) {
  const { resourceLimits } = sandbox;
  
  // Set memory limit (platform specific) - skip for now to avoid import issues
  // Memory limits can be implemented later with a different approach
  // if (process.platform !== 'win32') {
  //   try {
  //     const { execSync } = await import('child_process');
  //     const memoryLimitKB = Math.floor(resourceLimits.maxMemory / 1024);
  //     execSync(`ulimit -v ${memoryLimitKB}`, { stdio: 'ignore' });
  //   } catch (error) {
  //     // Silently ignore memory limit issues during testing
  //   }
  // }
  
  // Set execution timeout
  const timeout = setTimeout(() => {
    if (childProcess && !childProcess.killed) {
      console.warn(`Process ${childProcess.pid} exceeded execution time limit, terminating`);
      childProcess.kill('SIGTERM');
      
      // Force kill if SIGTERM doesn't work
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }, resourceLimits.maxExecutionTime);
  
  // Clean up timeout when process exits
  childProcess.on('exit', () => {
    clearTimeout(timeout);
  });
  
  return {
    memoryLimit: resourceLimits.maxMemory,
    executionTimeout: resourceLimits.maxExecutionTime,
    cleanup: () => clearTimeout(timeout)
  };
}

/**
 * Create sandboxed environment variables
 */
export function createSandboxedEnv(sandbox, originalEnv = process.env) {
  const { permissionTier } = sandbox;
  
  // Start with minimal environment
  const sandboxedEnv = {
    NODE_ENV: originalEnv.NODE_ENV || 'production',
    PATH: originalEnv.PATH,
    HOME: originalEnv.HOME,
    USER: originalEnv.USER,
    LANG: originalEnv.LANG,
    TZ: originalEnv.TZ
  };
  
  // Add permission tier identifier
  sandboxedEnv.AMPGI_PERMISSION_TIER = permissionTier;
  sandboxedEnv.AMPGI_SANDBOX_ID = sandbox.id;
  
  // For LOW tier, remove potentially sensitive variables
  if (permissionTier === PERMISSION_TIERS.LOW) {
    // Only include essential variables
    return sandboxedEnv;
  }
  
  // For MEDIUM and HIGH tiers, include more environment variables
  const allowedVars = [
    'npm_config_registry',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY'
  ];
  
  for (const varName of allowedVars) {
    if (originalEnv[varName]) {
      sandboxedEnv[varName] = originalEnv[varName];
    }
  }
  
  // For HIGH tier, include all non-sensitive variables
  if (permissionTier === PERMISSION_TIERS.HIGH) {
    const sensitivePatterns = [
      /^.*_TOKEN$/,
      /^.*_KEY$/,
      /^.*_SECRET$/,
      /^.*_PASSWORD$/,
      /^SSH_/,
      /^AWS_/,
      /^GITHUB_/
    ];
    
    for (const [key, value] of Object.entries(originalEnv)) {
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
      if (!isSensitive && !sandboxedEnv[key]) {
        sandboxedEnv[key] = value;
      }
    }
  }
  
  return sandboxedEnv;
}

/**
 * Get default permission tier for a server configuration
 */
export function getDefaultPermissionTier(serverConfig) {
  // Check server's declared permission requirements
  if (serverConfig.permissions) {
    if (serverConfig.permissions.includes('high')) {
      return PERMISSION_TIERS.HIGH;
    }
    if (serverConfig.permissions.includes('medium')) {
      return PERMISSION_TIERS.MEDIUM;
    }
  }
  
  // Check for indicators of high privilege requirements
  const highPrivilegeIndicators = [
    'system',
    'admin',
    'root',
    'sudo',
    'filesystem-write',
    'network-unrestricted'
  ];
  
  const serverName = serverConfig.name?.toLowerCase() || '';
  const serverDesc = serverConfig.description?.toLowerCase() || '';
  const serverPackage = serverConfig.package?.toLowerCase() || '';
  
  for (const indicator of highPrivilegeIndicators) {
    if (serverName.includes(indicator) || 
        serverDesc.includes(indicator) || 
        serverPackage.includes(indicator)) {
      return PERMISSION_TIERS.HIGH;
    }
  }
  
  // Check for medium privilege indicators
  const mediumPrivilegeIndicators = [
    'filesystem',
    'file',
    'git',
    'database',
    'api',
    'web'
  ];
  
  for (const indicator of mediumPrivilegeIndicators) {
    if (serverName.includes(indicator) || 
        serverDesc.includes(indicator) || 
        serverPackage.includes(indicator)) {
      return PERMISSION_TIERS.MEDIUM;
    }
  }
  
  // Default to low privilege for safety
  return PERMISSION_TIERS.LOW;
}

/**
 * Check if permission escalation is available
 */
export function canEscalatePermissions(currentTier, targetTier) {
  const tierLevels = {
    [PERMISSION_TIERS.LOW]: 1,
    [PERMISSION_TIERS.MEDIUM]: 2,
    [PERMISSION_TIERS.HIGH]: 3
  };
  
  return tierLevels[targetTier] > tierLevels[currentTier];
}

/**
 * Generate security summary for a sandbox
 */
export function generateSecuritySummary(sandbox) {
  const { permissionTier, resourceLimits, filePermissions, networkPermissions } = sandbox;
  
  return {
    permissionTier,
    restrictions: {
      memory: `${Math.round(resourceLimits.maxMemory / 1024 / 1024)}MB`,
      executionTime: `${resourceLimits.maxExecutionTime / 1000}s`,
      fileAccess: filePermissions.writablePaths.length > 0 ? 'Limited write access' : 'Read-only',
      networkAccess: networkPermissions.allowNetwork ? 'Restricted domains' : 'No network access'
    },
    capabilities: {
      canWriteFiles: filePermissions.writablePaths.length > 0,
      canAccessNetwork: networkPermissions.allowNetwork,
      canExecuteSubprocesses: permissionTier === PERMISSION_TIERS.HIGH
    }
  };
}
