import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

/**
 * Detect Amp installation type and configuration paths
 */
export async function detectAmpInstallation() {
  const homeDir = os.homedir();
  
  // Check for VS Code extension
  const vscodeExtensionPaths = [
    path.join(homeDir, '.vscode/extensions'),
    path.join(homeDir, '.vscode-insiders/extensions'),
    path.join(homeDir, 'Library/Application Support/Code/User/extensions'), // macOS
    path.join(homeDir, 'AppData/Roaming/Code/User/extensions'), // Windows
    path.join(homeDir, '.config/Code/User/extensions') // Linux
  ];
  
  for (const extensionPath of vscodeExtensionPaths) {
    if (await fs.pathExists(extensionPath)) {
      try {
        const extensions = await fs.readdir(extensionPath);
        const ampExtension = extensions.find(ext => ext.includes('sourcegraph') && ext.includes('amp'));
        
        if (ampExtension) {
          return {
            found: true,
            type: 'vscode',
            path: path.join(extensionPath, ampExtension),
            configPath: getVSCodeConfigPath()
          };
        }
      } catch (error) {
        // Continue checking other paths
      }
    }
  }
  
  // Check for CLI installation
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('amp', ['--version'], { stdio: 'pipe' });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      
      child.on('error', () => {
        resolve(false);
      });
    });
    
    if (result) {
      return {
        found: true,
        type: 'cli',
        path: null,
        configPath: getCLIConfigPath()
      };
    }
  } catch (error) {
    // CLI not found
  }
  
  return {
    found: false,
    type: null,
    path: null,
    configPath: null
  };
}

/**
 * Get VS Code settings path
 */
function getVSCodeConfigPath() {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin':
      return path.join(homeDir, 'Library/Application Support/Code/User/settings.json');
    case 'win32':
      return path.join(homeDir, 'AppData/Roaming/Code/User/settings.json');
    default:
      return path.join(homeDir, '.config/Code/User/settings.json');
  }
}

/**
 * Get CLI configuration path
 */
function getCLIConfigPath() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.config/amp/config.json');
}

/**
 * Get current Amp configuration
 */
export async function getCurrentAmpConfig(ampInstall) {
  const configPath = ampInstall.configPath;
  
  if (!await fs.pathExists(configPath)) {
    return {};
  }
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Failed to read configuration from ${configPath}: ${error.message}`);
  }
}

/**
 * Update Amp configuration with new settings
 */
export async function updateAmpConfig(newConfig, ampInstall) {
  const configPath = ampInstall.configPath;
  
  // Ensure config directory exists
  await fs.ensureDir(path.dirname(configPath));
  
  // Read existing configuration
  let existingConfig = {};
  if (await fs.pathExists(configPath)) {
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      existingConfig = JSON.parse(configContent);
    } catch (error) {
      // If config is malformed, start with empty config
      existingConfig = {};
    }
  }
  
  // Merge configurations
  const mergedConfig = {
    ...existingConfig,
    ...newConfig
  };
  
  // Handle MCP servers specifically - merge rather than replace
  if (newConfig['amp.mcpServers']) {
    mergedConfig['amp.mcpServers'] = {
      ...existingConfig['amp.mcpServers'],
      ...newConfig['amp.mcpServers']
    };
  }
  
  // Write updated configuration
  try {
    const configContent = JSON.stringify(mergedConfig, null, 2);
    await fs.writeFile(configPath, configContent, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write configuration to ${configPath}: ${error.message}`);
  }
}

/**
 * Backup current configuration
 */
export async function backupAmpConfig(ampInstall) {
  const configPath = ampInstall.configPath;
  
  if (!await fs.pathExists(configPath)) {
    return null;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${configPath}.backup.${timestamp}`;
  
  try {
    await fs.copy(configPath, backupPath);
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * Restore configuration from backup
 */
export async function restoreAmpConfig(backupPath, ampInstall) {
  const configPath = ampInstall.configPath;
  
  if (!await fs.pathExists(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  
  try {
    await fs.copy(backupPath, configPath);
  } catch (error) {
    throw new Error(`Failed to restore from backup: ${error.message}`);
  }
}
