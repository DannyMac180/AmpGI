import chalk from 'chalk';
import { listProfiles as getProfiles, listServers as getServers } from '../registry.js';

export async function listProfiles(options) {
  if (options.profiles || !options.servers) {
    console.log(chalk.blue('📦 Available AmpGI Profiles:\n'));
    
    const profiles = getProfiles();
    
    for (const profile of profiles) {
      console.log(chalk.green(`${profile.name} (${profile.id})`));
      console.log(chalk.gray(`  ${profile.description}`));
      console.log(chalk.gray(`  Servers: ${profile.servers.join(', ')}`));
      
      console.log(chalk.gray('  Features:'));
      for (const feature of profile.features) {
        console.log(chalk.gray(`    • ${feature}`));
      }
      
      console.log(); // Empty line
    }
    
    console.log(chalk.blue('Usage:'));
    console.log(chalk.gray('  ampgi install --profile personal'));
    console.log(chalk.gray('  ampgi install --profile developer'));
  }
  
  if (options.servers) {
    console.log(chalk.blue('🛠️  Available MCP Servers:\n'));
    
    const servers = getServers();
    const categories = {};
    
    // Group servers by category
    for (const server of servers) {
      if (!categories[server.category]) {
        categories[server.category] = [];
      }
      categories[server.category].push(server);
    }
    
    // Display servers by category
    for (const [category, categoryServers] of Object.entries(categories)) {
      console.log(chalk.yellow(`${category.toUpperCase()}`));
      
      for (const server of categoryServers) {
        console.log(chalk.green(`  ${server.name} (${server.id})`));
        console.log(chalk.gray(`    ${server.description}`));
        console.log(chalk.gray(`    Package: ${server.package}`));
        console.log(chalk.gray(`    Auth: ${server.auth}`));
        console.log(chalk.gray(`    Permissions: ${server.permissions.join(', ')}`));
        console.log(chalk.gray(`    Capabilities: ${server.capabilities.join(', ')}`));
        console.log();
      }
    }
    
    console.log(chalk.blue('Usage:'));
    console.log(chalk.gray('  ampgi install --servers gmail slack'));
    console.log(chalk.gray('  ampgi install --servers filesystem git'));
  }
}
