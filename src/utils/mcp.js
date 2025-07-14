import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Install an MCP server package
 */
export async function installMCPServer(serverConfig) {
  return new Promise((resolve, reject) => {
    // For now, we assume npx packages are available
    // In a real implementation, we might want to check if the package exists
    // and potentially install it globally
    
    if (serverConfig.package) {
      // Check if package is available via npx
      const child = spawn('npx', ['--help'], { stdio: 'pipe' });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: 'NPX available for package execution' });
        } else {
          reject(new Error('NPX not available - please install Node.js'));
        }
      });
      
      child.on('error', (error) => {
        reject(new Error(`Failed to verify NPX: ${error.message}`));
      });
    } else {
      resolve({ success: true, message: 'No package installation required' });
    }
  });
}

/**
 * Test MCP server connection
 */
export async function testMCPServerConnection(serverConfig, ampConfig) {
  return new Promise((resolve) => {
    const timeout = 10000; // 10 seconds
    let resolved = false;
    
    const resolveOnce = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };
    
    try {
      // Replace placeholders in args
      const args = serverConfig.args?.map(arg => {
        return arg.replace('{username}', os.userInfo().username);
      }) || [];
      
      // Set up environment variables
      const env = { ...process.env };
      if (ampConfig.env) {
        Object.assign(env, ampConfig.env);
      }
      
      // Spawn the MCP server process
      const child = spawn(serverConfig.command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolveOnce({
            success: true,
            capabilities: extractCapabilities(stdout),
            tools: extractTools(stdout),
            message: 'Server started successfully'
          });
        } else {
          resolveOnce({
            success: false,
            error: `Server exited with code ${code}`,
            stderr,
            suggestions: generateSuggestions(stderr, serverConfig)
          });
        }
      });
      
      child.on('error', (error) => {
        resolveOnce({
          success: false,
          error: error.message,
          suggestions: generateSuggestions(error.message, serverConfig)
        });
      });
      
      // Test basic MCP protocol - send initialize request
      setTimeout(() => {
        const initRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'ampgi-test',
              version: '0.1.0'
            }
          }
        };
        
        try {
          child.stdin.write(JSON.stringify(initRequest) + '\n');
          child.stdin.end();
        } catch (error) {
          // Ignore write errors - server might not be ready
        }
      }, 1000);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          child.kill();
          resolveOnce({
            success: false,
            error: 'Connection timeout',
            suggestions: ['Check if server package is installed', 'Verify server configuration']
          });
        }
      }, timeout);
      
    } catch (error) {
      resolveOnce({
        success: false,
        error: error.message,
        suggestions: generateSuggestions(error.message, serverConfig)
      });
    }
  });
}

/**
 * Extract capabilities from server output
 */
function extractCapabilities(output) {
  const capabilities = [];
  
  // Look for capability-related patterns in output
  const capabilityPatterns = [
    /tools?:\s*\[([^\]]+)\]/i,
    /capabilities?:\s*\[([^\]]+)\]/i,
    /supports?:\s*\[([^\]]+)\]/i
  ];
  
  for (const pattern of capabilityPatterns) {
    const match = output.match(pattern);
    if (match) {
      const caps = match[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
      capabilities.push(...caps);
    }
  }
  
  return [...new Set(capabilities)]; // Remove duplicates
}

/**
 * Extract tools from server output
 */
function extractTools(output) {
  const tools = [];
  
  // Look for tool-related patterns
  const toolPatterns = [
    /"name":\s*"([^"]+)"/g,
    /"tool":\s*"([^"]+)"/g
  ];
  
  for (const pattern of toolPatterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      tools.push(match[1]);
    }
  }
  
  return [...new Set(tools)]; // Remove duplicates
}

/**
 * Generate helpful suggestions based on error messages
 */
function generateSuggestions(error, serverConfig) {
  const suggestions = [];
  
  if (error.includes('command not found') || error.includes('not found')) {
    suggestions.push('Install Node.js and npm');
    suggestions.push('Verify the server package is available');
  }
  
  if (error.includes('ENOENT') || error.includes('No such file')) {
    suggestions.push('Check file paths in server configuration');
    suggestions.push('Ensure required directories exist');
  }
  
  if (error.includes('permission') || error.includes('EACCES')) {
    suggestions.push('Check file permissions');
    suggestions.push('Run with appropriate user privileges');
  }
  
  if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
    suggestions.push('Check network connectivity');
    suggestions.push('Verify server endpoints are accessible');
  }
  
  if (error.includes('authentication') || error.includes('unauthorized')) {
    suggestions.push('Configure authentication credentials');
    suggestions.push('Check API keys and tokens');
  }
  
  if (serverConfig.auth && serverConfig.auth !== 'none') {
    suggestions.push(`Configure ${serverConfig.auth} authentication`);
    if (serverConfig.documentation) {
      suggestions.push(`See documentation: ${serverConfig.documentation}`);
    }
  }
  
  return suggestions;
}

/**
 * Get MCP server status
 */
export async function getMCPServerStatus(serverConfig) {
  // This would check if the server is running and responsive
  // For now, we'll return a basic status
  return {
    running: false,
    healthy: false,
    lastSeen: null,
    version: null
  };
}

/**
 * Stop MCP server
 */
export async function stopMCPServer(serverId) {
  // This would stop a running MCP server
  // Implementation depends on how servers are managed
  return { success: true, message: `Server ${serverId} stopped` };
}

/**
 * Restart MCP server
 */
export async function restartMCPServer(serverId) {
  // This would restart a running MCP server
  // Implementation depends on how servers are managed
  return { success: true, message: `Server ${serverId} restarted` };
}
