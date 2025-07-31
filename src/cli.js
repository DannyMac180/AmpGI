#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { installProfile } from './commands/install.js';
import { listProfiles } from './commands/list.js';
import { testMCPServers } from './commands/test.js';
import { applyConfig } from './commands/apply.js';
import { authSetup, authList, authTest, authRemove, authInfo } from './commands/auth.js';
import { securityStatus, toggleSafeMode, manageServerPermissions, performSecurityAudit } from './commands/security.js';
import { discoverCommand } from './commands/discover.js';
import { searchCommand } from './commands/search.js';
import { installCommunityServer, listCommunityServers, removeCommunityServer } from './commands/community.js';

const program = new Command();

program
  .name('ampgi')
  .description('Transform Amp into a general-purpose agent through MCP servers')
  .version('1.0.1');

program
  .command('install')
  .description('Install AmpGI profile or individual MCP servers')
  .option('-p, --profile <profile>', 'Install a pre-built profile')
  .option('-s, --servers <servers...>', 'Install specific MCP servers')
  .option('-c, --config <config>', 'Install from configuration file')
  .option('--dry-run', 'Show what would be installed without actually installing')
  .option('--safe-mode [enabled]', 'Enable or disable safe mode during installation')
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

program
  .command('discover')
  .description('Discover available MCP servers from various sources')
  .option('-s, --source <source>', 'Discovery source: npm, github, all', 'all')
  .option('-c, --category <category>', 'Filter by category')
  .option('-t, --test', 'Test compatibility of discovered servers')
  .option('-i, --install', 'Show installation options for discovered servers')
  .option('--no-cache', 'Disable cache and force fresh discovery')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async (options) => {
    try {
      await discoverCommand({
        source: options.source,
        category: options.category,
        test: options.test,
        install: options.install,
        useCache: options.cache,
        limit: parseInt(options.limit)
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('search')
  .argument('<query>', 'Search query for MCP servers')
  .description('Search for MCP servers by capability, name, or description')
  .option('-c, --capability <capability>', 'Filter by specific capability')
  .option('--category <category>', 'Filter by category')
  .option('--source <source>', 'Filter by source: npm, github, all', 'all')
  .option('--official', 'Show only official servers')
  .option('--community', 'Show only community servers')
  .option('--installed', 'Show only installed servers')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .option('--sort <sort>', 'Sort by: relevance, name, updated, popularity, official', 'relevance')
  .action(async (query, options) => {
    try {
      await searchCommand(query, {
        capability: options.capability,
        category: options.category,
        source: options.source,
        official: options.official,
        community: options.community,
        installed: options.installed,
        limit: parseInt(options.limit),
        sort: options.sort
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Authentication commands
const authCommand = program
  .command('auth')
  .description('Manage authentication for MCP servers');

authCommand
  .command('setup [server]')
  .description('Setup authentication for an MCP server')
  .option('--skip-test', 'Skip credential testing after setup')
  .action(async (server, options) => {
    try {
      await authSetup(server, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

authCommand
  .command('list')
  .description('List authentication status for all servers')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    try {
      await authList(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

authCommand
  .command('test [server]')
  .description('Test authentication credentials')
  .action(async (server, options) => {
    try {
      await authTest(server, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

authCommand
  .command('remove <server>')
  .description('Remove stored credentials for a server')
  .option('-f, --force', 'Force removal without confirmation')
  .action(async (server, options) => {
    try {
      await authRemove(server, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

authCommand
  .command('info')
  .description('Show authentication system information')
  .action(async () => {
    try {
      await authInfo();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Security commands
const securityCommand = program
  .command('security')
  .description('Manage security settings and server permissions');

securityCommand
  .command('status')
  .description('Show current security status and settings')
  .action(async () => {
    try {
      await securityStatus();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

securityCommand
  .command('safe-mode [enabled]')
  .description('Toggle safe mode on/off (on=true, off=false)')
  .action(async (enabled) => {
    try {
      let safeModeEnabled;
      if (enabled === 'on' || enabled === 'true') {
        safeModeEnabled = true;
      } else if (enabled === 'off' || enabled === 'false') {
        safeModeEnabled = false;
      }
      await toggleSafeMode(safeModeEnabled);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

securityCommand
  .command('permissions <server> [tier]')
  .description('Show or set permission tier for a server (low/medium/high)')
  .action(async (server, tier) => {
    try {
      await manageServerPermissions(server, tier);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

securityCommand
  .command('audit')
  .description('Perform security audit of current configuration')
  .action(async () => {
    try {
      await performSecurityAudit();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Community commands
const communityCommand = program
  .command('community')
  .description('Manage community MCP servers');

communityCommand
  .command('install <repo>')
  .description('Install MCP server from GitHub repository')
  .option('--no-test', 'Skip compatibility testing')
  .option('--no-validate', 'Skip security validation')
  .option('-f, --force', 'Force installation despite security warnings')
  .action(async (repo, options) => {
    try {
      await installCommunityServer(repo, {
        test: options.test,
        validate: options.validate,
        force: options.force
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

communityCommand
  .command('list')
  .description('List installed community servers')
  .action(async () => {
    try {
      await listCommunityServers();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

communityCommand
  .command('remove <server>')
  .description('Remove a community server')
  .option('-f, --force', 'Force removal without confirmation')
  .action(async (server, options) => {
    try {
      await removeCommunityServer(server, {
        force: options.force
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();
