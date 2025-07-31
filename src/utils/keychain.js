/**
 * Keychain utility for secure credential storage
 * 
 * Provides cross-platform secure storage using:
 * - macOS: Keychain Services
 * - Windows: Windows Credential Manager  
 * - Linux: libsecret/keyring
 */

import { execSync } from 'child_process';
import os from 'os';
import crypto from 'crypto';

const SERVICE_NAME = 'ampgi-mcp';
const ENCRYPTION_KEY_SIZE = 32;

/**
 * Get encryption key for credential encryption
 * Uses machine-specific identifier for key derivation
 */
function getEncryptionKey() {
  const machineId = os.hostname() + os.userInfo().username;
  return crypto.pbkdf2Sync(machineId, 'ampgi-salt', 10000, ENCRYPTION_KEY_SIZE, 'sha256');
}

/**
 * Encrypt credential data
 */
function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt credential data
 */
function decrypt(encryptedText) {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * macOS Keychain implementation
 */
class MacOSKeychain {
  async store(account, password) {
    const encryptedPassword = encrypt(password);
    
    try {
      // First try to update existing entry
      execSync(`security add-generic-password -a "${account}" -s "${SERVICE_NAME}" -w "${encryptedPassword}" -U`, {
        stdio: 'pipe'
      });
    } catch (error) {
      // If update fails, create new entry
      try {
        execSync(`security add-generic-password -a "${account}" -s "${SERVICE_NAME}" -w "${encryptedPassword}"`, {
          stdio: 'pipe'
        });
      } catch (createError) {
        throw new Error(`Failed to store credential: ${createError.message}`);
      }
    }
  }

  async retrieve(account) {
    try {
      const encryptedPassword = execSync(`security find-generic-password -a "${account}" -s "${SERVICE_NAME}" -w`, {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      return decrypt(encryptedPassword);
    } catch (error) {
      if (error.message.includes('could not be found')) {
        return null;
      }
      throw new Error(`Failed to retrieve credential: ${error.message}`);
    }
  }

  async remove(account) {
    try {
      execSync(`security delete-generic-password -a "${account}" -s "${SERVICE_NAME}"`, {
        stdio: 'pipe'
      });
      return true;
    } catch (error) {
      if (error.message.includes('could not be found')) {
        return false;
      }
      throw new Error(`Failed to remove credential: ${error.message}`);
    }
  }

  async list() {
    try {
      // Use security find-generic-password with wildcard to list all entries
      // This is more reliable than dump-keychain
      const output = execSync(`security find-generic-password -s "${SERVICE_NAME}" -g 2>&1 | grep "acct" || true`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const accounts = [];
      const lines = output.split('\n');
      
      for (const line of lines) {
        const accountMatch = line.match(/"acct"<blob>="([^"]+)"/);
        if (accountMatch) {
          accounts.push(accountMatch[1]);
        }
      }
      
      return accounts;
    } catch (error) {
      // Fallback: try to find entries by testing known patterns
      // This is a workaround for the macOS keychain limitations
      return [];
    }
  }
}

/**
 * Windows Credential Manager implementation
 */
class WindowsCredentialManager {
  async store(account, password) {
    const encryptedPassword = encrypt(password);
    const target = `${SERVICE_NAME}:${account}`;
    
    try {
      execSync(`cmdkey /generic:"${target}" /user:"${account}" /pass:"${encryptedPassword}"`, {
        stdio: 'pipe'
      });
    } catch (error) {
      throw new Error(`Failed to store credential: ${error.message}`);
    }
  }

  async retrieve(account) {
    const target = `${SERVICE_NAME}:${account}`;
    
    try {
      const output = execSync(`cmdkey /list:"${target}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Windows cmdkey doesn't directly return passwords, we need to use a different approach
      // For now, we'll use a PowerShell approach
      const psScript = `
        $target = "${target}"
        $cred = Get-StoredCredential -Target $target -ErrorAction SilentlyContinue
        if ($cred) { $cred.Password | ConvertFrom-SecureString -AsPlainText }
      `;
      
      const encryptedPassword = execSync(`powershell -Command "${psScript}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      if (!encryptedPassword) {
        return null;
      }
      
      return decrypt(encryptedPassword);
    } catch (error) {
      return null;
    }
  }

  async remove(account) {
    const target = `${SERVICE_NAME}:${account}`;
    
    try {
      execSync(`cmdkey /delete:"${target}"`, {
        stdio: 'pipe'
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async list() {
    try {
      const output = execSync(`cmdkey /list | findstr "${SERVICE_NAME}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const targets = output.split('\n')
        .filter(line => line.includes(SERVICE_NAME))
        .map(line => line.match(/Target: (.+)/)?.[1])
        .filter(Boolean)
        .map(target => target.replace(`${SERVICE_NAME}:`, ''));
        
      return targets;
    } catch (error) {
      return [];
    }
  }
}

/**
 * Linux Secret Service implementation (using secret-tool)
 */
class LinuxSecretService {
  async store(account, password) {
    const encryptedPassword = encrypt(password);
    
    try {
      execSync(`echo "${encryptedPassword}" | secret-tool store --label="AmpGI MCP Credential" service "${SERVICE_NAME}" account "${account}"`, {
        stdio: 'pipe'
      });
    } catch (error) {
      throw new Error(`Failed to store credential: ${error.message}`);
    }
  }

  async retrieve(account) {
    try {
      const encryptedPassword = execSync(`secret-tool lookup service "${SERVICE_NAME}" account "${account}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      return decrypt(encryptedPassword);
    } catch (error) {
      return null;
    }
  }

  async remove(account) {
    try {
      execSync(`secret-tool clear service "${SERVICE_NAME}" account "${account}"`, {
        stdio: 'pipe'
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async list() {
    try {
      const output = execSync(`secret-tool search service "${SERVICE_NAME}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const accounts = [];
      const entries = output.split('\n\n');
      
      for (const entry of entries) {
        const accountMatch = entry.match(/account = (.+)/);
        if (accountMatch) {
          accounts.push(accountMatch[1]);
        }
      }
      
      return accounts;
    } catch (error) {
      return [];
    }
  }
}

/**
 * Get platform-appropriate keychain implementation
 */
function getKeychain() {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin':
      return new MacOSKeychain();
    case 'win32':
      return new WindowsCredentialManager();
    case 'linux':
      return new LinuxSecretService();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Store a credential securely
 */
export async function storeCredential(serverId, credentialType, value) {
  const keychain = getKeychain();
  const account = `${serverId}:${credentialType}`;
  await keychain.store(account, value);
}

/**
 * Retrieve a stored credential
 */
export async function getCredential(serverId, credentialType) {
  const keychain = getKeychain();
  const account = `${serverId}:${credentialType}`;
  return await keychain.retrieve(account);
}

/**
 * Remove a stored credential
 */
export async function removeCredential(serverId, credentialType) {
  const keychain = getKeychain();
  const account = `${serverId}:${credentialType}`;
  return await keychain.remove(account);
}

/**
 * List all stored credentials
 */
export async function listCredentials() {
  const keychain = getKeychain();
  const accounts = await keychain.list();
  
  return accounts.map(account => {
    const [serverId, credentialType] = account.split(':');
    return { serverId, credentialType };
  });
}

/**
 * Remove all credentials for a server
 */
export async function removeServerCredentials(serverId) {
  const credentials = await listCredentials();
  const serverCredentials = credentials.filter(cred => cred.serverId === serverId);
  
  const results = [];
  for (const { credentialType } of serverCredentials) {
    try {
      const removed = await removeCredential(serverId, credentialType);
      results.push({ credentialType, removed });
    } catch (error) {
      results.push({ credentialType, removed: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Check if keychain is available on current platform
 */
export async function isKeychainAvailable() {
  try {
    const platform = os.platform();
    
    switch (platform) {
      case 'darwin':
        // Check if security command exists
        execSync('which security', { stdio: 'pipe' });
        return true;
      case 'win32':
        // Check if cmdkey command exists
        execSync('where cmdkey', { stdio: 'pipe' });
        return true;
      case 'linux':
        // Check if secret-tool exists
        execSync('which secret-tool', { stdio: 'pipe' });
        return true;
      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}
