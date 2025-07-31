import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { getProfileConfig, getServerConfig, generateAmpConfig } from '../registry.js';
import { detectAmpInstallation, updateAmpConfig } from '../utils/amp.js';
import { installMCPServer } from '../utils/mcp.js';
import { setupMultipleServerAuth, requiresAuth, generateCredentialEnvVars } from '../utils/auth.js';
import { 
  validateInstallationPermissions, 
  isSafeModeEnabled, 
  setSafeMode,
  requestPermissionEscalation 
} from '../utils/permissions.js';
import { PERMISSION_TIERS } from '../utils/sandbox.js';

// Helper function to get color for permission tier
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

// Create a utility function for prompts
async function promptConfirm(message, defaultValue = true) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const defaultText = defaultValue ? '(Y/n)' : '(y/N)';
    rl.question(`${message} ${defaultText} `, (answer) => {
      rl.close();
      const normalizedAnswer = answer.toLowerCase().trim();
      if (!normalizedAnswer) {
        resolve(defaultValue);
      } else {
        resolve(normalizedAnswer === 'y' || normalizedAnswer === 'yes');
      }
    });
  });
}

export async function installProfile(options) {
  console.log(chalk.blue('🚀 AmpGI Installation'));
  
  // Check safe mode and set if requested
  if (options.safeMode !== undefined) {
    await setSafeMode(options.safeMode);
    console.log(chalk.green(`✓ Safe mode ${options.safeMode ? 'enabled' : 'disabled'}`));
  }
  
  // Show security status
  const safeMode = await isSafeModeEnabled();
  if (safeMode) {
    console.log(chalk.yellow('🔒 Safe mode is enabled - high privilege servers will require approval'));
  }
  
  // Detect Amp installation
  console.log(chalk.blue('Detecting Amp installation...'));
  const ampInstall = await detectAmpInstallation();
  
  if (!ampInstall.found) {
    console.log(chalk.red('✗ Amp installation not found'));
    console.log(chalk.yellow('Please install Amp first: https://ampcode.com'));
    return;
  }
  
  console.log(chalk.green(`✓ Found Amp installation: ${ampInstall.type}`));
  
  let serverIds = [];
  
  if (options.profile) {
    // Install from profile
    const profile = getProfileConfig(options.profile);
    console.log(chalk.green(`\n📦 Installing profile: ${profile.name}`));
    console.log(chalk.gray(profile.description));
    
    serverIds = profile.servers;
    
    if (!options.dryRun) {
      try {
        const confirmed = await promptConfirm(`Install ${serverIds.length} MCP servers for ${profile.name}?`);
        
        if (!confirmed) {
          console.log(chalk.yellow('Installation cancelled'));
          return;
        }
      } catch (error) {
        console.log(chalk.yellow('Interactive prompt not available, proceeding with installation...'));
      }
    }
    
  } else if (options.servers) {
    // Install specific servers
    serverIds = options.servers;
    
  } else if (options.config) {
    // Install from config file
    console.log(chalk.yellow('Config file installation not yet implemented'));
    return;
    
  } else {
    // Interactive mode currently disabled due to readline interface issues
    console.log(chalk.yellow('Interactive mode is temporarily disabled.'));
    console.log(chalk.blue('Please use one of these commands instead:'));
    console.log(chalk.gray('  ampgi install --profile personal'));
    console.log(chalk.gray('  ampgi install --profile developer'));
    console.log(chalk.gray('  ampgi install --profile business'));
    console.log(chalk.gray('  ampgi install --profile research'));
    console.log(chalk.gray('  ampgi list --profiles      # to see all available profiles'));
    return;
  }
  
  if (serverIds.length === 0) {
    console.log(chalk.yellow('No servers selected for installation'));
    return;
  }
  
  // Validate installation permissions
  console.log(chalk.blue('\n🔍 Validating permissions...'));
  const permissionValidation = await validateInstallationPermissions(serverIds);
  
  const allowedServers = [];
  const blockedServers = [];
  
  for (const result of permissionValidation) {
    if (result.allowed) {
      allowedServers.push(result.serverId);
    } else {
      blockedServers.push(result);
    }
  }
  
  // Show what will be installed
  console.log(chalk.blue('\n📋 Installation Plan:'));
  for (const serverId of allowedServers) {
    const server = getServerConfig(serverId);
    const permissionTier = server.permissionTier || PERMISSION_TIERS.MEDIUM;
    const tierColor = getTierColor(permissionTier);
    
    console.log(chalk.green(`  ✓ ${server.name} - ${server.description}`));
    console.log(chalk.gray(`    Permission: ${tierColor(permissionTier)}`));
    
    if (server.auth !== 'none') {
      console.log(chalk.yellow(`    ⚠️  Requires ${server.auth} authentication`));
    }
  }
  
  // Show blocked servers
  if (blockedServers.length > 0) {
    console.log(chalk.red('\n🚫 Blocked Servers:'));
    for (const blocked of blockedServers) {
      console.log(chalk.red(`  ✗ ${blocked.serverName}`));
      console.log(chalk.gray(`    Reason: ${blocked.reason}`));
      
      if (blocked.requiresEscalation) {
        console.log(chalk.gray(`    Use: ampgi security safe-mode off (to disable safe mode)`));
      }
    }
  }
  
  // Handle blocked servers
  if (blockedServers.length > 0 && !options.force) {
    try {
      const proceed = await promptConfirm(`\nProceed with ${allowedServers.length} allowed servers (skip ${blockedServers.length} blocked)?`, false);
      
      if (!proceed) {
        console.log(chalk.yellow('Installation cancelled'));
        return;
      }
      
      // Update server list to only allowed servers
      serverIds = allowedServers;
      
    } catch (error) {
      console.log(chalk.yellow('Non-interactive mode: skipping blocked servers'));
      serverIds = allowedServers;
    }
  }
  
  if (options.dryRun) {
    console.log(chalk.gray('\n[DRY RUN] No changes will be made'));
    return;
  }
  
  // Install MCP servers
  console.log(chalk.blue('\n🔧 Installing MCP servers...'));
  
  const installedServers = [];
  const failedServers = [];
  
  for (const serverId of serverIds) {
    const server = getServerConfig(serverId);
    const serverSpinner = ora(`Installing ${server.name}...`).start();
    
    try {
      const result = await installMCPServer(server);
      serverSpinner.succeed(`${server.name} installed successfully`);
      
      if (result.packageVersion) {
        console.log(chalk.gray(`  Installed: ${result.packageVersion}`));
      }
      
      installedServers.push(serverId);
    } catch (error) {
      serverSpinner.fail(`Failed to install ${server.name}: ${error.message}`);
      console.log(chalk.red(`Error details: ${error.message}`));
      failedServers.push({ serverId, error: error.message });
    }
  }
  
  // Handle installation failures
  if (failedServers.length > 0) {
    console.log(chalk.yellow(`\n⚠️  ${failedServers.length} server(s) failed to install`));
    
    if (installedServers.length > 0) {
      try {
        const rollback = await promptConfirm('Some installations failed. Rollback successful installations?', false);
        
        if (rollback) {
          console.log(chalk.blue('\n🔄 Rolling back installations...'));
          const rollbackSpinner = ora('Cleaning up installed packages...').start();
          
          for (const serverId of installedServers) {
            try {
              const server = getServerConfig(serverId);
              const { uninstallMCPServer } = await import('../utils/mcp.js');
              await uninstallMCPServer(server);
            } catch (error) {
              console.log(chalk.red(`Warning: Failed to rollback ${serverId}: ${error.message}`));
            }
          }
          
          rollbackSpinner.succeed('Rollback completed');
          console.log(chalk.yellow('Installation cancelled due to failures'));
          return;
        }
      } catch (error) {
        console.log(chalk.yellow('Proceeding with partial installation...'));
      }
    } else {
      console.log(chalk.red('All installations failed. No configuration changes made.'));
      return;
    }
    
    // Continue with partial installation
    serverIds = installedServers;
  }
  
  // Handle authentication setup
  const authServers = serverIds.filter(id => requiresAuth(id));
  let credentialEnvVars = {};
  
  if (authServers.length > 0) {
    console.log(chalk.blue('\n🔐 Authentication Setup'));
    
    try {
      const setupAuth = await promptConfirm(`Setup authentication for ${authServers.length} server(s) now?`, true);
      
      if (setupAuth) {
        console.log(chalk.blue('Setting up authentication...'));
        const authResults = await setupMultipleServerAuth(authServers);
        
        // Generate credential environment variables
        for (const serverId of authServers) {
          try {
            const envVars = await generateCredentialEnvVars(serverId);
            if (Object.keys(envVars).length > 0) {
              credentialEnvVars[serverId] = envVars;
            }
          } catch (error) {
            console.log(chalk.yellow(`Warning: Could not generate env vars for ${serverId}: ${error.message}`));
          }
        }
        
        const successfulAuth = authResults.filter(r => r.success).length;
        if (successfulAuth > 0) {
          console.log(chalk.green(`✅ Successfully configured authentication for ${successfulAuth} server(s)`));
        }
      } else {
        console.log(chalk.yellow('Skipping authentication setup'));
        console.log(chalk.blue('You can setup authentication later with: ampgi auth setup <server>'));
      }
    } catch (error) {
      console.log(chalk.yellow('Interactive authentication setup not available, skipping...'));
    }
  }

  // Generate and update Amp configuration
  console.log(chalk.blue('\n⚙️  Updating Amp configuration...'));
  const configSpinner = ora('Updating configuration...').start();
  
  try {
    const ampConfig = await generateAmpConfig(serverIds, credentialEnvVars);
    await updateAmpConfig(ampConfig, ampInstall);
    configSpinner.succeed('Amp configuration updated successfully');
  } catch (error) {
    configSpinner.fail(`Failed to update Amp configuration: ${error.message}`);
    console.log(chalk.red(`Error details: ${error.message}`));
    return;
  }
  
  // Success message
  console.log(chalk.green('\n✅ AmpGI installation complete!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log(chalk.gray('1. Restart your Amp client (VS Code or CLI)'));
  console.log(chalk.gray('2. Test your new capabilities with: ampgi test --all'));
  
  // Show authentication status
  const needsAuth = [];
  
  for (const serverId of authServers) {
    if (credentialEnvVars[serverId] && Object.keys(credentialEnvVars[serverId]).length > 0) {
      // Authentication was configured
      continue;
    } else {
      needsAuth.push(serverId);
    }
  }
  
  if (needsAuth.length > 0) {
    console.log(chalk.yellow('\n🔐 Authentication Required:'));
    console.log(chalk.gray('The following servers require authentication setup:'));
    for (const serverId of needsAuth) {
      const server = getServerConfig(serverId);
      console.log(chalk.gray(`  • ${server.name} (${server.auth})`));
    }
    console.log(chalk.blue('\n💡 Setup authentication:'));
    console.log(chalk.gray('  ampgi auth setup <server>    # Setup individual server'));
    console.log(chalk.gray('  ampgi auth list              # Show auth status'));
  } else if (authServers.length > 0) {
    console.log(chalk.green('\n🔐 All servers are authenticated and ready!'));
  }
}
