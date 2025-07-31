import chalk from 'chalk';
import ora from 'ora';
import { 
  isSafeModeEnabled, 
  setSafeMode, 
  getPermissionOverrides,
  setPermissionOverride,
  getSecurityAudit,
  generatePermissionRecommendations
} from '../utils/permissions.js';
import { PERMISSION_TIERS } from '../utils/sandbox.js';
import { getAllServers, getServerStatus } from '../utils/process-manager.js';
import { getServerConfig } from '../registry.js';

/**
 * Show current security status
 */
export async function securityStatus() {
  console.log(chalk.blue('🔒 AmpGI Security Status\n'));
  
  const spinner = ora('Gathering security information...').start();
  
  try {
    // Get safe mode status
    const safeMode = await isSafeModeEnabled();
    spinner.succeed('Security information gathered');
    
    console.log(chalk.yellow('Safe Mode:'), safeMode ? 
      chalk.green('Enabled ✓') : 
      chalk.red('Disabled ✗'));
    
    if (safeMode) {
      console.log(chalk.gray('  • High privilege servers are blocked'));
      console.log(chalk.gray('  • New installations default to low privilege'));
      console.log(chalk.gray('  • Explicit consent required for privilege escalation'));
    } else {
      console.log(chalk.red('  ⚠️  All permission tiers allowed'));
    }
    
    // Get permission overrides
    const overrides = await getPermissionOverrides();
    console.log(chalk.yellow('\nPermission Overrides:'), Object.keys(overrides).length);
    
    if (Object.keys(overrides).length > 0) {
      for (const [serverId, override] of Object.entries(overrides)) {
        const serverConfig = getServerConfig(serverId);
        const serverName = serverConfig?.name || serverId;
        const tierColor = getTierColor(override.tier);
        
        console.log(chalk.gray(`  • ${serverName}: ${tierColor(override.tier)}`));
        console.log(chalk.gray(`    Set: ${new Date(override.setAt).toLocaleDateString()}`));
      }
    } else {
      console.log(chalk.gray('  No permission overrides configured'));
    }
    
    // Show running servers
    const runningServers = getAllServers();
    const runningCount = Object.keys(runningServers).length;
    
    console.log(chalk.yellow('\nRunning Servers:'), runningCount);
    
    if (runningCount > 0) {
      for (const [serverId, status] of Object.entries(runningServers)) {
        const serverConfig = getServerConfig(serverId);
        const serverName = serverConfig?.name || serverId;
        const tierColor = getTierColor(status.permissionTier);
        
        console.log(chalk.gray(`  • ${serverName} (PID: ${status.pid})`));
        console.log(chalk.gray(`    Permission: ${tierColor(status.permissionTier)}`));
        console.log(chalk.gray(`    Uptime: ${Math.round(status.uptime / 1000)}s`));
      }
    } else {
      console.log(chalk.gray('  No servers currently running'));
    }
    
    // Security recommendations
    console.log(chalk.yellow('\nSecurity Recommendations:'));
    
    if (!safeMode) {
      console.log(chalk.red('  • Enable safe mode for new installations'));
      console.log(chalk.gray('    Run: ampgi security safe-mode on'));
    }
    
    const highPrivilegeOverrides = Object.entries(overrides)
      .filter(([, override]) => override.tier === PERMISSION_TIERS.HIGH);
    
    if (highPrivilegeOverrides.length > 0) {
      console.log(chalk.red(`  • Review ${highPrivilegeOverrides.length} high privilege server(s)`));
      console.log(chalk.gray('    Run: ampgi security audit'));
    }
    
    if (Object.keys(overrides).length === 0 && runningCount > 0) {
      console.log(chalk.yellow('  • Consider setting explicit permission tiers'));
      console.log(chalk.gray('    Run: ampgi security permissions <server>'));
    }
    
  } catch (error) {
    spinner.fail('Failed to gather security information');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Toggle safe mode on/off
 */
export async function toggleSafeMode(enabled) {
  const currentMode = await isSafeModeEnabled();
  
  if (enabled === undefined) {
    // Toggle current state
    enabled = !currentMode;
  }
  
  const spinner = ora(`${enabled ? 'Enabling' : 'Disabling'} safe mode...`).start();
  
  try {
    await setSafeMode(enabled);
    spinner.succeed(`Safe mode ${enabled ? 'enabled' : 'disabled'}`);
    
    if (enabled) {
      console.log(chalk.green('\n✓ Safe mode is now enabled'));
      console.log(chalk.gray('  • High privilege servers will be blocked'));
      console.log(chalk.gray('  • New installations will require explicit approval'));
      console.log(chalk.gray('  • Existing high privilege servers remain accessible'));
    } else {
      console.log(chalk.yellow('\n⚠️  Safe mode is now disabled'));
      console.log(chalk.red('  • All permission tiers are allowed'));
      console.log(chalk.red('  • High privilege servers can be installed without warnings'));
      console.log(chalk.gray('  • Consider reviewing your security settings'));
    }
    
  } catch (error) {
    spinner.fail(`Failed to update safe mode`);
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Manage server permissions
 */
export async function manageServerPermissions(serverId, newTier) {
  if (!serverId) {
    console.log(chalk.red('Error: Server ID is required'));
    console.log(chalk.gray('Usage: ampgi security permissions <server> [tier]'));
    return;
  }
  
  const serverConfig = getServerConfig(serverId);
  if (!serverConfig) {
    console.log(chalk.red(`Error: Server ${serverId} not found`));
    return;
  }
  
  const serverName = serverConfig.name;
  
  if (!newTier) {
    // Show current permissions
    const overrides = await getPermissionOverrides();
    const override = overrides[serverId];
    const defaultTier = serverConfig.permissionTier || PERMISSION_TIERS.MEDIUM;
    const effectiveTier = override?.tier || defaultTier;
    
    console.log(chalk.blue(`🔒 Permissions for ${serverName}\n`));
    
    console.log(chalk.yellow('Current Tier:'), getTierColor(effectiveTier)(effectiveTier));
    console.log(chalk.yellow('Default Tier:'), getTierColor(defaultTier)(defaultTier));
    
    if (override) {
      console.log(chalk.yellow('Override Set:'), new Date(override.setAt).toLocaleString());
    } else {
      console.log(chalk.gray('No override configured (using default)'));
    }
    
    // Show tier capabilities
    console.log(chalk.yellow('\nPermission Tiers:'));
    console.log(chalk.gray(`  ${getTierColor(PERMISSION_TIERS.LOW)(PERMISSION_TIERS.LOW)}: Read-only access, no network`));
    console.log(chalk.gray(`  ${getTierColor(PERMISSION_TIERS.MEDIUM)(PERMISSION_TIERS.MEDIUM)}: Limited write access, restricted network`));
    console.log(chalk.gray(`  ${getTierColor(PERMISSION_TIERS.HIGH)(PERMISSION_TIERS.HIGH)}: Full system access (requires approval)`));
    
    // Show recommendations
    const recommendations = generatePermissionRecommendations(serverConfig);
    if (recommendations.length > 0) {
      console.log(chalk.yellow('\nRecommendations:'));
      for (const rec of recommendations) {
        console.log(chalk.gray(`  • ${rec.message}`));
        if (rec.suggestedTier) {
          console.log(chalk.gray(`    Suggested: ${rec.suggestedTier}`));
        }
      }
    }
    
    console.log(chalk.gray('\nTo change: ampgi security permissions <server> <tier>'));
    return;
  }
  
  // Validate new tier
  if (!Object.values(PERMISSION_TIERS).includes(newTier)) {
    console.log(chalk.red(`Error: Invalid permission tier '${newTier}'`));
    console.log(chalk.gray('Valid tiers: low, medium, high'));
    return;
  }
  
  // Set new permission tier
  const spinner = ora(`Setting ${serverName} to ${newTier} privilege...`).start();
  
  try {
    await setPermissionOverride(serverId, newTier);
    spinner.succeed(`Permission tier updated`);
    
    console.log(chalk.green(`✓ ${serverName} now has ${getTierColor(newTier)(newTier)} privilege`));
    
    if (newTier === PERMISSION_TIERS.HIGH) {
      console.log(chalk.red('\n⚠️  High Privilege Warning:'));
      console.log(chalk.red('  • Full file system access'));
      console.log(chalk.red('  • Unrestricted network access'));
      console.log(chalk.red('  • System command execution'));
      console.log(chalk.gray('\nRestart the server for changes to take effect'));
    }
    
  } catch (error) {
    spinner.fail(`Failed to update permissions`);
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Perform security audit
 */
export async function performSecurityAudit() {
  console.log(chalk.blue('🔍 AmpGI Security Audit\n'));
  
  const spinner = ora('Performing security audit...').start();
  
  try {
    const audit = await getSecurityAudit();
    spinner.succeed('Security audit completed');
    
    // Safe mode status
    console.log(chalk.yellow('Safe Mode:'), audit.safeMode ? 
      chalk.green('Enabled ✓') : 
      chalk.red('Disabled ✗'));
    
    // Permission overrides
    console.log(chalk.yellow('Permission Overrides:'), audit.permissionOverrides);
    
    // Security issues
    if (audit.securityIssues.length > 0) {
      console.log(chalk.red('\n🚨 Security Issues Found:'));
      for (const issue of audit.securityIssues) {
        console.log(chalk.red(`  • ${issue.message}`));
        if (issue.serverId) {
          const serverConfig = getServerConfig(issue.serverId);
          console.log(chalk.gray(`    Server: ${serverConfig?.name || issue.serverId}`));
        }
      }
      
      console.log(chalk.yellow('\nRecommended Actions:'));
      console.log(chalk.gray('  • Review high privilege server permissions'));
      console.log(chalk.gray('  • Consider enabling safe mode'));
      console.log(chalk.gray('  • Remove unnecessary permission overrides'));
    } else {
      console.log(chalk.green('\n✅ No security issues detected'));
    }
    
    // Server analysis
    const runningServers = getAllServers();
    if (Object.keys(runningServers).length > 0) {
      console.log(chalk.yellow('\nRunning Server Analysis:'));
      
      for (const [serverId, status] of Object.entries(runningServers)) {
        const serverConfig = getServerConfig(serverId);
        const serverName = serverConfig?.name || serverId;
        
        console.log(chalk.gray(`\n  ${serverName}:`));
        console.log(chalk.gray(`    Permission: ${getTierColor(status.permissionTier)(status.permissionTier)}`));
        console.log(chalk.gray(`    PID: ${status.pid}`));
        console.log(chalk.gray(`    Uptime: ${Math.round(status.uptime / 1000)}s`));
        
        // Security recommendations for this server
        const recommendations = generatePermissionRecommendations(serverConfig);
        if (recommendations.length > 0) {
          console.log(chalk.yellow('    Recommendations:'));
          for (const rec of recommendations) {
            console.log(chalk.gray(`      • ${rec.message}`));
          }
        }
      }
    }
    
    // Overall security score
    let score = 100;
    if (!audit.safeMode) score -= 20;
    if (audit.securityIssues.length > 0) score -= 10 * audit.securityIssues.length;
    if (audit.permissionOverrides > 5) score -= 10;
    
    score = Math.max(0, score);
    const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
    
    console.log(chalk.yellow('\nSecurity Score:'), scoreColor(`${score}/100`));
    
  } catch (error) {
    spinner.fail('Security audit failed');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Get color for permission tier
 */
function getTierColor(tier) {
  switch (tier) {
    case PERMISSION_TIERS.LOW:
      return chalk.green;
    case PERMISSION_TIERS.MEDIUM:
      return chalk.yellow;
    case PERMISSION_TIERS.HIGH:
      return chalk.red;
    default:
      return chalk.gray;
  }
}
