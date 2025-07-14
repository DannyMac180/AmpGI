#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { installProfile } from './commands/install.js';
import { listProfiles } from './commands/list.js';
import { testMCPServers } from './commands/test.js';
import { applyConfig } from './commands/apply.js';

const program = new Command();

program
  .name('ampgi')
  .description('Transform Amp into a general-purpose agent through MCP servers')
  .version('0.1.0');

program
  .command('install')
  .description('Install AmpGI profile or individual MCP servers')
  .option('-p, --profile <profile>', 'Install a pre-built profile')
  .option('-s, --servers <servers...>', 'Install specific MCP servers')
  .option('-c, --config <config>', 'Install from configuration file')
  .option('--dry-run', 'Show what would be installed without actually installing')
  .action(async (options) => {
    try {
      await installProfile(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available profiles and MCP servers')
  .option('-p, --profiles', 'List available profiles')
  .option('-s, --servers', 'List available MCP servers')
  .action(async (options) => {
    try {
      await listProfiles(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test MCP server connections and functionality')
  .option('-s, --server <server>', 'Test specific MCP server')
  .option('-a, --all', 'Test all configured MCP servers')
  .action(async (options) => {
    try {
      await testMCPServers(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Apply configuration from file')
  .argument('<config>', 'Path to configuration file')
  .option('--dry-run', 'Show what would be applied without actually applying')
  .action(async (config, options) => {
    try {
      await applyConfig(config, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current AmpGI configuration status')
  .action(() => {
    console.log(chalk.blue('AmpGI Status:'));
    console.log('This feature is coming soon!');
  });

program.parse();
