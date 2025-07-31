import { test } from 'node:test';
import assert from 'node:assert';
import { 
  getServerConfig, 
  getProfileConfig, 
  listServers, 
  listProfiles, 
  generateAmpConfig 
} from '../src/registry.js';

test('getServerConfig returns valid server configuration', () => {
  const config = getServerConfig('filesystem');
  
  assert.strictEqual(config.name, 'Filesystem');
  assert.strictEqual(config.category, 'storage');
  assert.strictEqual(config.package, '@modelcontextprotocol/server-filesystem');
  assert.ok(config.capabilities.includes('file:read'));
  assert.ok(config.capabilities.includes('file:write'));
});

test('getServerConfig throws error for unknown server', () => {
  assert.throws(() => {
    getServerConfig('unknown-server');
  }, /Unknown MCP server/);
});

test('getProfileConfig returns valid profile configuration', () => {
  const config = getProfileConfig('personal');
  
  assert.strictEqual(config.name, 'Personal Assistant');
  assert.ok(config.servers.includes('filesystem'));
  assert.ok(config.servers.includes('memory'));
  assert.ok(config.features.length > 0);
});

test('getProfileConfig throws error for unknown profile', () => {
  assert.throws(() => {
    getProfileConfig('unknown-profile');
  }, /Unknown profile/);
});

test('listServers returns all available servers', () => {
  const servers = listServers();
  
  assert.ok(servers.length > 0);
  assert.ok(servers.some(s => s.id === 'filesystem'));
  assert.ok(servers.some(s => s.id === 'memory'));
  assert.ok(servers.some(s => s.id === 'git'));
  assert.ok(servers.some(s => s.id === 'sqlite'));
  assert.ok(servers.some(s => s.id === 'notion'));
});

test('listProfiles returns all available profiles', () => {
  const profiles = listProfiles();
  
  assert.ok(profiles.length > 0);
  assert.ok(profiles.some(p => p.id === 'personal'));
  assert.ok(profiles.some(p => p.id === 'developer'));
  assert.ok(profiles.some(p => p.id === 'researcher'));
});

test('generateAmpConfig creates valid Amp configuration', async () => {
  const config = await generateAmpConfig(['filesystem', 'memory']);
  
  assert.ok(config['amp.mcpServers']);
  assert.ok(config['amp.mcpServers']['filesystem']);
  assert.ok(config['amp.mcpServers']['memory']);
  
  const filesystemConfig = config['amp.mcpServers']['filesystem'];
  assert.strictEqual(filesystemConfig.command, 'npx');
  assert.ok(filesystemConfig.args.includes('@modelcontextprotocol/server-filesystem'));
});

test('server configurations have required fields', () => {
  const servers = listServers();
  
  for (const server of servers) {
    assert.ok(server.name, `Server ${server.id} missing name`);
    assert.ok(server.description, `Server ${server.id} missing description`);
    assert.ok(server.capabilities, `Server ${server.id} missing capabilities`);
    assert.ok(server.category, `Server ${server.id} missing category`);
    assert.ok(server.command, `Server ${server.id} missing command`);
    assert.ok(server.args, `Server ${server.id} missing args`);
    assert.ok(server.permissions, `Server ${server.id} missing permissions`);
  }
});

test('profile configurations have required fields', () => {
  const profiles = listProfiles();
  
  for (const profile of profiles) {
    assert.ok(profile.name, `Profile ${profile.id} missing name`);
    assert.ok(profile.description, `Profile ${profile.id} missing description`);
    assert.ok(profile.servers, `Profile ${profile.id} missing servers`);
    assert.ok(profile.features, `Profile ${profile.id} missing features`);
    assert.ok(profile.servers.length > 0, `Profile ${profile.id} has no servers`);
  }
});
