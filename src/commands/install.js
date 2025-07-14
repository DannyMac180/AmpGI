import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getProfileConfig, getServerConfig, generateAmpConfig } from '../registry.js';
import { detectAmpInstallation, updateAmpConfig } from '../utils/amp.js';
import { installMCPServer } from '../utils/mcp.js';

export async function installProfile(options) {
  console.log(chalk.blue('🚀 AmpGI Installation'));
  
  // Detect Amp installation
  const spinner = ora('Detecting Amp installation...').start();
  const ampInstall = await detectAmpInstallation();
  
  if (!ampInstall.found) {
    spinner.fail('Amp installation not found');
    console.log(chalk.yellow('Please install Amp first: https://ampcode.com'));
    return;
  }
  
  spinner.succeed(`Found Amp installation: ${ampInstall.type}`);
  
  let serverIds = [];
  
  if (options.profile) {
    // Install from profile
    const profile = getProfileConfig(options.profile);
    console.log(chalk.green(`\n📦 Installing profile: ${profile.name}`));
    console.log(chalk.gray(profile.description));
    
    serverIds = profile.servers;
    
    if (!options.dryRun) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Install ${serverIds.length} MCP servers for ${profile.name}?`,
          default: true
        }
      ]);
      
      if (!confirmed) {
        console.log(chalk.yellow('Installation cancelled'));
        return;
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
    // Interactive mode
    const { selectedProfile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedProfile',
        message: 'Choose an AmpGI profile to install:',
        choices: [
          { name: 'Personal Assistant - Email, files, web requests', value: 'personal' },
          { name: 'Developer Plus - Git, databases, APIs', value: 'developer' },
          { name: 'Business Productivity - Team communication, cloud storage', value: 'business' },
          { name: 'Research Assistant - Web research, data analysis', value: 'research' },
          { name: 'Custom - Choose individual servers', value: 'custom' }
        ]
      }
    ]);
    
    if (selectedProfile === 'custom') {
      const { selectedServers } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedServers',
          message: 'Select MCP servers to install:',
          choices: [
            { name: 'Gmail - Email management', value: 'gmail' },
            { name: 'Slack - Team messaging', value: 'slack' },
            { name: 'Filesystem - Local file operations', value: 'filesystem' },
            { name: 'Google Drive - Cloud storage', value: 'gdrive' },
            { name: 'Git - Version control', value: 'git' },
            { name: 'Fetch - HTTP requests', value: 'fetch' },
            { name: 'ClickHouse - Database operations', value: 'clickhouse' }
          ]
        }
      ]);
      
      serverIds = selectedServers;
    } else {
      const profile = getProfileConfig(selectedProfile);
      serverIds = profile.servers;
    }
  }
  
  if (serverIds.length === 0) {
    console.log(chalk.yellow('No servers selected for installation'));
    return;
  }
  
  // Show what will be installed
  console.log(chalk.blue('\n📋 Installation Plan:'));
  for (const serverId of serverIds) {
    const server = getServerConfig(serverId);
    console.log(chalk.green(`  ✓ ${server.name} - ${server.description}`));
    
    if (server.auth !== 'none') {
      console.log(chalk.yellow(`    ⚠️  Requires ${server.auth} authentication`));
    }
    
    if (server.permissions.includes('high')) {
      console.log(chalk.red(`    🔒 High privilege server - requires explicit permission`));
    }
  }
  
  if (options.dryRun) {
    console.log(chalk.gray('\n[DRY RUN] No changes will be made'));
    return;
  }
  
  // Install MCP servers
  console.log(chalk.blue('\n🔧 Installing MCP servers...'));
  
  for (const serverId of serverIds) {
    const server = getServerConfig(serverId);
    const serverSpinner = ora(`Installing ${server.name}...`).start();
    
    try {
      await installMCPServer(server);
      serverSpinner.succeed(`${server.name} installed successfully`);
    } catch (error) {
      serverSpinner.fail(`Failed to install ${server.name}: ${error.message}`);
      console.log(chalk.red(`Error details: ${error.message}`));
    }
  }
  
  // Generate and update Amp configuration
  console.log(chalk.blue('\n⚙️  Updating Amp configuration...'));
  const configSpinner = ora('Updating configuration...').start();
  
  try {
    const ampConfig = generateAmpConfig(serverIds);
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
  console.log(chalk.gray('2. Configure authentication for servers that require it'));
  console.log(chalk.gray('3. Test your new capabilities with: ampgi test --all'));
  
  // Show authentication instructions
  const authServers = serverIds.filter(id => {
    const server = getServerConfig(id);
    return server.auth !== 'none';
  });
  
  if (authServers.length > 0) {
    console.log(chalk.yellow('\n🔐 Authentication Required:'));
    for (const serverId of authServers) {
      const server = getServerConfig(serverId);
      console.log(chalk.gray(`  ${server.name}: See ${server.documentation} for setup instructions`));
    }
  }
}
