import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { 
  createSandbox, 
  validateFileAccess, 
  validateNetworkAccess,
  getDefaultPermissionTier,
  PERMISSION_TIERS 
} from '../src/utils/sandbox.js';
import { 
  isSafeModeEnabled, 
  setSafeMode, 
  validateInstallationPermissions 
} from '../src/utils/permissions.js';

describe('Security Sandbox Tests', () => {
  let testDir;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ampgi-test-'));
  });
  
  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });

  describe('Sandbox Creation', () => {
    it('should create sandbox with correct permission tier', async () => {
      const serverConfig = {
        id: 'test-server',
        name: 'Test Server',
        permissions: ['medium']
      };
      
      const sandbox = createSandbox(serverConfig, PERMISSION_TIERS.MEDIUM);
      
      assert.strictEqual(sandbox.permissionTier, PERMISSION_TIERS.MEDIUM);
      assert.ok(sandbox.id);
      assert.strictEqual(sandbox.serverId, 'test-server');
      assert.ok(sandbox.resourceLimits);
      assert.ok(sandbox.filePermissions);
      assert.ok(sandbox.networkPermissions);
    });
    
    it('should apply correct resource limits for each tier', async () => {
      const serverConfig = { id: 'test', name: 'Test' };
      
      const lowSandbox = createSandbox(serverConfig, PERMISSION_TIERS.LOW);
      const mediumSandbox = createSandbox(serverConfig, PERMISSION_TIERS.MEDIUM);
      const highSandbox = createSandbox(serverConfig, PERMISSION_TIERS.HIGH);
      
      assert.ok(lowSandbox.resourceLimits.maxMemory < mediumSandbox.resourceLimits.maxMemory);
      assert.ok(mediumSandbox.resourceLimits.maxMemory < highSandbox.resourceLimits.maxMemory);
      
      assert.ok(lowSandbox.resourceLimits.maxExecutionTime <= mediumSandbox.resourceLimits.maxExecutionTime);
      assert.ok(mediumSandbox.resourceLimits.maxExecutionTime <= highSandbox.resourceLimits.maxExecutionTime);
    });
  });

  describe('File Access Validation', () => {
    it('should allow read access to permitted directories', async () => {
      const sandbox = createSandbox({ id: 'test' }, PERMISSION_TIERS.MEDIUM);
      const documentsPath = path.join(os.homedir(), 'Documents', 'test.txt');
      
      const result = validateFileAccess(sandbox, documentsPath, 'read');
      assert.strictEqual(result.allowed, true);
    });
    
    it('should block read access to system directories for low privilege', async () => {
      const sandbox = createSandbox({ id: 'test' }, PERMISSION_TIERS.LOW);
      const systemPath = '/etc/passwd';
      
      const result = validateFileAccess(sandbox, systemPath, 'read');
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason);
    });
    
    it('should block write access for low privilege tier', async () => {
      const sandbox = createSandbox({ id: 'test' }, PERMISSION_TIERS.LOW);
      const testFile = path.join(testDir, 'test.txt');
      
      const result = validateFileAccess(sandbox, testFile, 'write');
      assert.strictEqual(result.allowed, false);
      assert.ok(result.requiresEscalation);
    });
    
    it('should allow high privilege servers full access', async () => {
      const sandbox = createSandbox({ id: 'test' }, PERMISSION_TIERS.HIGH);
      const systemPath = '/tmp/test.txt';
      
      const readResult = validateFileAccess(sandbox, systemPath, 'read');
      const writeResult = validateFileAccess(sandbox, systemPath, 'write');
      
      assert.strictEqual(readResult.allowed, true);
      assert.strictEqual(writeResult.allowed, true);
    });
  });

  describe('Network Access Validation', () => {
    it('should block all network access for low privilege', async () => {
      const sandbox = createSandbox({ id: 'test' }, PERMISSION_TIERS.LOW);
      
      const result = validateNetworkAccess(sandbox, 'api.github.com', 443);
      assert.strictEqual(result.allowed, false);
      assert.ok(result.requiresEscalation);
    });
    
    it('should allow whitelisted domains for medium privilege', async () => {
      const sandbox = createSandbox({ id: 'test' }, PERMISSION_TIERS.MEDIUM);
      
      const githubResult = validateNetworkAccess(sandbox, 'api.github.com', 443);
      const randomResult = validateNetworkAccess(sandbox, 'evil.com', 443);
      
      assert.strictEqual(githubResult.allowed, true);
      assert.strictEqual(randomResult.allowed, false);
    });
    
    it('should allow all domains for high privilege', async () => {
      const sandbox = createSandbox({ id: 'test' }, PERMISSION_TIERS.HIGH);
      
      const result = validateNetworkAccess(sandbox, 'any-domain.com', 8080);
      assert.strictEqual(result.allowed, true);
    });
  });

  describe('Permission Tier Detection', () => {
    it('should detect high privilege requirements from server config', async () => {
      const serverConfig = {
        name: 'Filesystem Server',
        permissions: ['high'],
        package: 'filesystem-server'
      };
      
      const tier = getDefaultPermissionTier(serverConfig);
      assert.strictEqual(tier, PERMISSION_TIERS.HIGH);
    });
    
    it('should detect medium privilege from package name', async () => {
      const serverConfig = {
        name: 'Git Server',
        package: 'mcp-git-server'
      };
      
      const tier = getDefaultPermissionTier(serverConfig);
      assert.strictEqual(tier, PERMISSION_TIERS.MEDIUM);
    });
    
    it('should default to low privilege for unknown servers', async () => {
      const serverConfig = {
        name: 'Simple Calculator',
        package: 'calculator-mcp'
      };
      
      const tier = getDefaultPermissionTier(serverConfig);
      assert.strictEqual(tier, PERMISSION_TIERS.LOW);
    });
  });
});

describe('Safe Mode Tests', () => {
  afterEach(async () => {
    // Reset safe mode after each test
    await setSafeMode(true);
  });

  describe('Safe Mode Configuration', () => {
    it('should enable and disable safe mode', async () => {
      await setSafeMode(true);
      assert.strictEqual(await isSafeModeEnabled(), true);
      
      await setSafeMode(false);
      assert.strictEqual(await isSafeModeEnabled(), false);
    });
    
    it('should default to safe mode enabled', async () => {
      // Clear any existing config
      const configPath = path.join(process.cwd(), '.ampgi-config.json');
      if (await fs.pathExists(configPath)) {
        await fs.remove(configPath);
      }
      
      const enabled = await isSafeModeEnabled();
      assert.strictEqual(enabled, true);
    });
  });

  describe('Installation Validation', () => {
    it('should block high privilege servers in safe mode', async () => {
      await setSafeMode(true);
      
      const results = await validateInstallationPermissions(['filesystem']);
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].allowed, false);
      assert.ok(results[0].requiresEscalation);
      assert.ok(results[0].reason.includes('safe mode'));
    });
    
    it('should allow medium and low privilege servers in safe mode', async () => {
      await setSafeMode(true);
      
      const results = await validateInstallationPermissions(['memory', 'everything']);
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].allowed, true);
      assert.strictEqual(results[1].allowed, true);
    });
    
    it('should allow all servers when safe mode is disabled', async () => {
      await setSafeMode(false);
      
      const results = await validateInstallationPermissions(['filesystem', 'memory']);
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].allowed, true);
      assert.strictEqual(results[1].allowed, true);
    });
  });
});
