import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { checkPackageExists, installMCPServer, verifyMCPServer, uninstallMCPServer } from '../src/utils/mcp.js';
import { getServerConfig } from '../src/registry.js';

test('package existence checking works', async () => {
  // Test with a known MCP server package
  const result = await checkPackageExists('@modelcontextprotocol/server-everything');
  
  assert.strictEqual(result.available, true);
  assert.ok(result.version);
});

test('package existence checking handles non-existent packages', async () => {
  // Test with a non-existent package
  const result = await checkPackageExists('non-existent-mcp-package-12345');
  
  assert.strictEqual(result.available, false);
  assert.ok(result.error.includes('not found'));
});

test('MCP server installation end-to-end', async () => {
  // Test with the sequential thinking server (small and reliable)
  const serverConfig = getServerConfig('sequential');
  
  // Install the server
  const installResult = await installMCPServer(serverConfig);
  assert.strictEqual(installResult.success, true);
  
  // Verify it was installed correctly
  const verifyResult = await verifyMCPServer(serverConfig);
  assert.strictEqual(verifyResult.success, true);
  
  console.log(`✓ Successfully installed and verified: ${serverConfig.name}`);
});

test('MCP server verification detects working packages', async () => {
  // Test verification of the everything server
  const serverConfig = getServerConfig('everything');
  
  const result = await verifyMCPServer(serverConfig);
  assert.strictEqual(result.success, true);
  assert.ok(result.message);
});

test('installation handles pre-installed packages', async () => {
  // Test installing a package that's already installed
  const serverConfig = getServerConfig('memory');
  
  const result = await installMCPServer(serverConfig);
  assert.strictEqual(result.success, true);
  
  // Should either be "already installed" or "installed successfully"
  assert.ok(result.message.includes('installed') || result.message.includes('verified'));
});
