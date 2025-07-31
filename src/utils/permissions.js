import { validateFileAccess, validateNetworkAccess, PERMISSION_TIERS } from './sandbox.js';
import { getServerConfig } from '../registry.js';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';

/**
 * Permission enforcement utilities
 */

/**
 * Check if safe mode is enabled
 */
export async function isSafeModeEnabled() {
  try {
    const configPath = path.join(process.cwd(), '.ampgi-config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      return config.safeMode === true;
    }
  } catch (error) {
    // Ignore errors, default to safe mode
  }
  return true; // Default to safe mode for new installations
}

/**
 * Set safe mode
 */
export async function setSafeMode(enabled) {
  try {
    const configPath = path.join(process.cwd(), '.ampgi-config.json');
    let config = {};
    
    if (await fs.pathExists(configPath)) {
      config = await fs.readJson(configPath);
    }
    
    config.safeMode = enabled;
    config.lastModified = new Date().toISOString();
    
    await fs.writeJson(configPath, config, { spaces: 2 });
    return true;
  } catch (error) {
    throw new Error(`Failed to update safe mode setting: ${error.message}`);
  }
}

/**
 * Get stored permission overrides for servers
 */
export async function getPermissionOverrides() {
  try {
    const configPath = path.join(process.cwd(), '.ampgi-config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      return config.permissionOverrides || {};
    }
  } catch (error) {
    // Ignore errors
  }
  return {};
}

/**
 * Set permission override for a server
 */
export async function setPermissionOverride(serverId, permissionTier) {
  try {
    const configPath = path.join(process.cwd(), '.ampgi-config.json');
    let config = {};
    
    if (await fs.pathExists(configPath)) {
      config = await fs.readJson(configPath);
    }
    
    if (!config.permissionOverrides) {
      config.permissionOverrides = {};
    }
    
    config.permissionOverrides[serverId] = {
      tier: permissionTier,
      setAt: new Date().toISOString()
    };
    
    await fs.writeJson(configPath, config, { spaces: 2 });
    return true;
  } catch (error) {
    throw new Error(`Failed to set permission override: ${error.message}`);
  }
}

/**
 * Enforce permission checks at runtime
 */
export function enforcePermissions(sandbox, operation, target, options = {}) {
  const { serverId, permissionTier } = sandbox;
  
  switch (operation) {
    case 'file_read':
    case 'file_write':
      return validateFileAccess(sandbox, target, operation === 'file_write' ? 'write' : 'read');
      
    case 'network_access':
      const { domain, port = 443 } = options;
      return validateNetworkAccess(sandbox, domain || target, port);
      
    case 'subprocess_spawn':
      if (permissionTier === PERMISSION_TIERS.LOW) {
        return {
          allowed: false,
          reason: 'Subprocess execution not permitted for low privilege servers',
          requiresEscalation: true
        };
      }
      return { allowed: true };
      
    case 'environment_access':
      const envVar = target;
      const sensitiveVars = ['SSH_KEY', 'API_KEY', 'TOKEN', 'PASSWORD', 'SECRET'];
      
      if (permissionTier === PERMISSION_TIERS.LOW && 
          sensitiveVars.some(pattern => envVar.includes(pattern))) {
        return {
          allowed: false,
          reason: 'Access to sensitive environment variables not permitted for low privilege servers',
          requiresEscalation: true
        };
      }
      return { allowed: true };
      
    default:
      return {
        allowed: false,
        reason: `Unknown operation: ${operation}`,
        requiresEscalation: false
      };
  }
}

/**
 * Check if a server is blocked by safe mode
 */
export async function isServerBlockedByQuarantinemode(serverId) {
  const safeMode = await isSafeModeEnabled();
  if (!safeMode) {
    return { blocked: false };
  }
  
  const serverConfig = getServerConfig(serverId);
  if (!serverConfig) {
    return { blocked: true, reason: 'Server configuration not found' };
  }
  
  // Check if server requires high privileges
  const requiresHighPrivileges = 
    serverConfig.permissions?.includes('high') ||
    serverConfig.permissionTier === PERMISSION_TIERS.HIGH;
  
  if (requiresHighPrivileges) {
    return {
      blocked: true,
      reason: 'High privilege servers are blocked in safe mode',
      serverName: serverConfig.name,
      requiredTier: PERMISSION_TIERS.HIGH
    };
  }
  
  return { blocked: false };
}

/**
 * Request permission escalation from user
 */
export async function requestPermissionEscalation(serverId, currentTier, requestedTier, reason) {
  if (process.env.NODE_ENV === 'test' || !process.stdin.isTTY) {
    // In test environment or non-interactive mode, deny escalation
    return { granted: false, reason: 'Non-interactive environment' };
  }
  
  const serverConfig = getServerConfig(serverId);
  const serverName = serverConfig?.name || serverId;
  
  console.log(chalk.yellow('\n🔒 Permission Escalation Required'));
  console.log(chalk.gray(`Server: ${serverName}`));
  console.log(chalk.gray(`Current Permission: ${currentTier}`));
  console.log(chalk.gray(`Requested Permission: ${requestedTier}`));
  console.log(chalk.gray(`Reason: ${reason}`));
  
  // Show security implications
  console.log(chalk.red('\n⚠️  Security Warning:'));
  if (requestedTier === PERMISSION_TIERS.HIGH) {
    console.log(chalk.red('  • Full file system access'));
    console.log(chalk.red('  • Unrestricted network access'));
    console.log(chalk.red('  • Ability to execute system commands'));
    console.log(chalk.red('  • Access to sensitive environment variables'));
  } else if (requestedTier === PERMISSION_TIERS.MEDIUM) {
    console.log(chalk.yellow('  • Limited file system write access'));
    console.log(chalk.yellow('  • Restricted network access'));
    console.log(chalk.yellow('  • Access to user directories'));
  }
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  try {
    const answer = await new Promise((resolve) => {
      rl.question(chalk.white('\nGrant permission escalation? (yes/no): '), resolve);
    });
    
    const granted = answer.toLowerCase().trim() === 'yes';
    
    if (granted) {
      // Store the permission override
      await setPermissionOverride(serverId, requestedTier);
      console.log(chalk.green(`✓ Permission escalation granted for ${serverName}`));
    } else {
      console.log(chalk.yellow(`✗ Permission escalation denied for ${serverName}`));
    }
    
    return { granted, permanentOverride: granted };
    
  } finally {
    rl.close();
  }
}

/**
 * Get effective permission tier for a server
 */
export async function getEffectivePermissionTier(serverId, defaultTier) {
  // Check for permission overrides
  const overrides = await getPermissionOverrides();
  const override = overrides[serverId];
  
  if (override) {
    return override.tier;
  }
  
  // Check if safe mode blocks this server
  const safeModeCheck = await isServerBlockedByQuarantinemode(serverId);
  if (safeModeCheck.blocked) {
    return PERMISSION_TIERS.LOW; // Force low privilege in safe mode
  }
  
  return defaultTier;
}

/**
 * Validate server installation permissions
 */
export async function validateInstallationPermissions(serverIds) {
  const safeMode = await isSafeModeEnabled();
  const results = [];
  
  for (const serverId of serverIds) {
    const serverConfig = getServerConfig(serverId);
    if (!serverConfig) {
      results.push({
        serverId,
        allowed: false,
        reason: 'Server configuration not found'
      });
      continue;
    }
    
    const safeModeCheck = await isServerBlockedByQuarantinemode(serverId);
    if (safeModeCheck.blocked) {
      results.push({
        serverId,
        serverName: serverConfig.name,
        allowed: false,
        reason: safeModeCheck.reason,
        requiresEscalation: true,
        currentMode: 'safe'
      });
    } else {
      results.push({
        serverId,
        serverName: serverConfig.name,
        allowed: true,
        permissionTier: serverConfig.permissionTier || PERMISSION_TIERS.MEDIUM
      });
    }
  }
  
  return results;
}

/**
 * Get security audit information
 */
export async function getSecurityAudit() {
  const safeMode = await isSafeModeEnabled();
  const overrides = await getPermissionOverrides();
  
  // Get information about installed servers (would need to be implemented)
  const installedServers = {}; // TODO: Get from amp config or registry
  
  const audit = {
    safeMode: safeMode,
    permissionOverrides: Object.keys(overrides).length,
    servers: {},
    securityIssues: []
  };
  
  // Check for high privilege servers in safe mode
  for (const [serverId, override] of Object.entries(overrides)) {
    if (safeMode && override.tier === PERMISSION_TIERS.HIGH) {
      audit.securityIssues.push({
        type: 'high_privilege_in_safe_mode',
        serverId,
        message: `High privilege server ${serverId} is allowed despite safe mode being enabled`
      });
    }
  }
  
  return audit;
}

/**
 * Generate permission recommendations
 */
export function generatePermissionRecommendations(serverConfig) {
  const recommendations = [];
  
  // Check for overprivileged servers
  if (serverConfig.permissions?.includes('high')) {
    const serverType = serverConfig.package?.toLowerCase() || '';
    
    if (serverType.includes('filesystem') && !serverType.includes('system')) {
      recommendations.push({
        type: 'reduce_privilege',
        message: 'Consider using medium privilege instead of high for filesystem operations',
        suggestedTier: PERMISSION_TIERS.MEDIUM
      });
    }
  }
  
  // Check for missing security configurations
  if (!serverConfig.permissions || serverConfig.permissions.length === 0) {
    recommendations.push({
      type: 'missing_permissions',
      message: 'Server configuration lacks explicit permission requirements',
      suggestion: 'Add permission tier to server configuration'
    });
  }
  
  // Check for authentication requirements
  if (serverConfig.auth === 'none' && serverConfig.permissions?.includes('high')) {
    recommendations.push({
      type: 'missing_auth',
      message: 'High privilege server lacks authentication requirements',
      suggestion: 'Consider requiring authentication for high privilege operations'
    });
  }
  
  return recommendations;
}
