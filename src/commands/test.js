import chalk from 'chalk';
import ora from 'ora';
import { getServerConfig } from '../registry.js';
import { detectAmpInstallation, getCurrentAmpConfig } from '../utils/amp.js';
import { testMCPServerConnection, verifyMCPServer } from '../utils/mcp.js';

export async function testMCPServers(options) {
  console.log(chalk.blue('🔍 Testing MCP Server Connections'));
  
  // Detect Amp installation
  const spinner = ora('Detecting Amp installation...').start();
  const ampInstall = await detectAmpInstallation();
  
  if (!ampInstall.found) {
    spinner.fail('Amp installation not found');
    return;
  }
  
  spinner.succeed(`Found Amp installation: ${ampInstall.type}`);
  
  // Get current configuration
  const configSpinner = ora('Reading Amp configuration...').start();
  let ampConfig;
  
  try {
    ampConfig = await getCurrentAmpConfig(ampInstall);
    configSpinner.succeed('Configuration loaded');
  } catch (error) {
    configSpinner.fail(`Failed to read configuration: ${error.message}`);
    return;
  }
  
  const mcpServers = ampConfig['amp.mcpServers'] || {};
  const serverIds = Object.keys(mcpServers);
  
  if (serverIds.length === 0) {
    console.log(chalk.yellow('No MCP servers configured'));
    console.log(chalk.gray('Use "ampgi install" to add servers'));
    return;
  }
  
  console.log(chalk.blue(`\n📋 Found ${serverIds.length} configured MCP servers`));
  
  // Test specific server or all servers
  let serversToTest = [];
  
  if (options.server) {
    if (serverIds.includes(options.server)) {
      serversToTest = [options.server];
    } else {
      console.log(chalk.red(`Server "${options.server}" not found in configuration`));
      return;
    }
  } else {
    serversToTest = serverIds;
  }
  
  console.log(chalk.blue('\n🧪 Testing Connections:\n'));
  
  const results = {
    passed: 0,
    failed: 0,
    total: serversToTest.length
  };
  
  for (const serverId of serversToTest) {
    const testSpinner = ora(`Testing ${serverId}...`).start();
    
    try {
      // Get server configuration from registry
      let serverConfig;
      try {
        serverConfig = getServerConfig(serverId);
      } catch (error) {
        // Server not in registry, use config from Amp
        serverConfig = {
          name: serverId,
          command: mcpServers[serverId].command,
          args: mcpServers[serverId].args,
          env: mcpServers[serverId].env
        };
      }
      
      // First verify package installation if applicable
      if (serverConfig.package) {
        const verifyResult = await verifyMCPServer(serverConfig);
        if (!verifyResult.success) {
          testSpinner.fail(`${serverConfig.name || serverId} - Package verification failed`);
          console.log(chalk.red(`    Package Error: ${verifyResult.error}`));
          results.failed++;
          console.log(); // Empty line for spacing
          continue;
        }
      }
      
      const testResult = await testMCPServerConnection(serverConfig, mcpServers[serverId]);
      
      if (testResult.success) {
        testSpinner.succeed(`${serverConfig.name || serverId} - Connection successful`);
        
        if (testResult.capabilities && testResult.capabilities.length > 0) {
          console.log(chalk.gray(`    Capabilities: ${testResult.capabilities.join(', ')}`));
        }
        
        if (testResult.tools && testResult.tools.length > 0) {
          console.log(chalk.gray(`    Tools: ${testResult.tools.length} available`));
        }
        
        results.passed++;
      } else {
        testSpinner.fail(`${serverConfig.name || serverId} - Connection failed`);
        console.log(chalk.red(`    Error: ${testResult.error}`));
        
        if (testResult.suggestions && testResult.suggestions.length > 0) {
          console.log(chalk.yellow('    Suggestions:'));
          for (const suggestion of testResult.suggestions) {
            console.log(chalk.yellow(`      • ${suggestion}`));
          }
        }
        
        results.failed++;
      }
      
    } catch (error) {
      testSpinner.fail(`${serverId} - Test failed`);
      console.log(chalk.red(`    Error: ${error.message}`));
      results.failed++;
    }
    
    console.log(); // Empty line for spacing
  }
  
  // Summary
  console.log(chalk.blue('📊 Test Summary:'));
  console.log(chalk.green(`  ✓ Passed: ${results.passed}`));
  console.log(chalk.red(`  ✗ Failed: ${results.failed}`));
  console.log(chalk.gray(`  Total: ${results.total}`));
  
  if (results.failed > 0) {
    console.log(chalk.yellow('\n💡 Troubleshooting:'));
    console.log(chalk.gray('  • Check server authentication configuration'));
    console.log(chalk.gray('  • Verify required environment variables are set'));
    console.log(chalk.gray('  • Ensure all MCP server packages are installed'));
    console.log(chalk.gray('  • Check server documentation for setup requirements'));
  }
  
  if (results.passed === results.total) {
    console.log(chalk.green('\n🎉 All MCP servers are working correctly!'));
  }
}
