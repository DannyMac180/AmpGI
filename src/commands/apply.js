import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import { detectAmpInstallation, updateAmpConfig } from '../utils/amp.js';

export async function applyConfig(configPath, options) {
  console.log(chalk.blue('📄 Applying AmpGI Configuration'));
  
  // Check if config file exists
  if (!await fs.pathExists(configPath)) {
    console.log(chalk.red(`Configuration file not found: ${configPath}`));
    return;
  }
  
  // Read and parse configuration
  const spinner = ora('Reading configuration file...').start();
  let config;
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configContent);
    spinner.succeed('Configuration file loaded');
  } catch (error) {
    spinner.fail(`Failed to read configuration: ${error.message}`);
    return;
  }
  
  // Validate configuration structure
  if (!config['amp.mcpServers']) {
    console.log(chalk.red('Invalid configuration: Missing "amp.mcpServers" section'));
    return;
  }
  
  // Detect Amp installation
  const ampSpinner = ora('Detecting Amp installation...').start();
  const ampInstall = await detectAmpInstallation();
  
  if (!ampInstall.found) {
    ampSpinner.fail('Amp installation not found');
    return;
  }
  
  ampSpinner.succeed(`Found Amp installation: ${ampInstall.type}`);
  
  // Show what will be applied
  const mcpServers = config['amp.mcpServers'];
  const serverIds = Object.keys(mcpServers);
  
  console.log(chalk.blue(`\n📋 Configuration Summary:`));
  console.log(chalk.gray(`  File: ${configPath}`));
  console.log(chalk.gray(`  Servers: ${serverIds.length}`));
  
  console.log(chalk.blue('\n🛠️  MCP Servers to Configure:'));
  for (const serverId of serverIds) {
    const serverConfig = mcpServers[serverId];
    console.log(chalk.green(`  ✓ ${serverId}`));
    console.log(chalk.gray(`    Command: ${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`));
    
    if (serverConfig.env) {
      const envKeys = Object.keys(serverConfig.env);
      console.log(chalk.gray(`    Environment: ${envKeys.join(', ')}`));
    }
  }
  
  if (options.dryRun) {
    console.log(chalk.gray('\n[DRY RUN] No changes will be made'));
    return;
  }
  
  // Apply configuration
  console.log(chalk.blue('\n⚙️  Applying configuration...'));
  const applySpinner = ora('Updating Amp configuration...').start();
  
  try {
    await updateAmpConfig(config, ampInstall);
    applySpinner.succeed('Configuration applied successfully');
  } catch (error) {
    applySpinner.fail(`Failed to apply configuration: ${error.message}`);
    return;
  }
  
  // Success message
  console.log(chalk.green('\n✅ Configuration applied successfully!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log(chalk.gray('1. Restart your Amp client (VS Code or CLI)'));
  console.log(chalk.gray('2. Test your configuration with: ampgi test --all'));
  
  // Show authentication reminders
  const authServers = serverIds.filter(serverId => {
    const serverConfig = mcpServers[serverId];
    return serverConfig.env && Object.keys(serverConfig.env).length > 0;
  });
  
  if (authServers.length > 0) {
    console.log(chalk.yellow('\n🔐 Authentication Required:'));
    for (const serverId of authServers) {
      const serverConfig = mcpServers[serverId];
      const envKeys = Object.keys(serverConfig.env);
      console.log(chalk.gray(`  ${serverId}: Configure ${envKeys.join(', ')}`));
    }
  }
}
