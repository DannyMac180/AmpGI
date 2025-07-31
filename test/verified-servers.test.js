import { test } from 'node:test';
import assert from 'node:assert';
import { getServerConfig, getProfileConfig } from '../src/registry.js';

test('git server configuration', () => {
  const gitConfig = getServerConfig('git');
  
  assert.strictEqual(gitConfig.name, 'Git Operations');
  assert.strictEqual(gitConfig.description, 'LLM-friendly interface to git command-line operations');
  assert.strictEqual(gitConfig.package, '@cyanheads/git-mcp-server');
  assert.strictEqual(gitConfig.command, 'npx');
  assert.strictEqual(gitConfig.category, 'development');
  assert.strictEqual(gitConfig.auth, 'none');
  assert.deepStrictEqual(gitConfig.permissions, ['medium']);
  assert.strictEqual(gitConfig.verified, true);
  
  // Check capabilities
  const expectedCapabilities = [
    'git:status',
    'git:log', 
    'git:diff',
    'git:commit',
    'git:branch',
    'git:remote'
  ];
  assert.deepStrictEqual(gitConfig.capabilities, expectedCapabilities);
  
  // Check args
  assert.deepStrictEqual(gitConfig.args, [
    '-y', '@cyanheads/git-mcp-server'
  ]);
});

test('sqlite server configuration', () => {
  const sqliteConfig = getServerConfig('sqlite');
  
  assert.strictEqual(sqliteConfig.name, 'SQLite Database');
  assert.strictEqual(sqliteConfig.description, 'Interact with SQLite databases - read, write, and query data');
  assert.strictEqual(sqliteConfig.package, 'mcp-server-sqlite-npx');
  assert.strictEqual(sqliteConfig.command, 'npx');
  assert.strictEqual(sqliteConfig.category, 'database');
  assert.strictEqual(sqliteConfig.auth, 'none');
  assert.deepStrictEqual(sqliteConfig.permissions, ['high']);
  assert.strictEqual(sqliteConfig.verified, true);
  
  // Check capabilities
  const expectedCapabilities = [
    'db:query',
    'db:read',
    'db:write',
    'db:schema'
  ];
  assert.deepStrictEqual(sqliteConfig.capabilities, expectedCapabilities);
});

test('researcher profile uses verified servers', () => {
  const researcherProfile = getProfileConfig('researcher');
  
  assert.strictEqual(researcherProfile.name, 'Research Assistant');
  assert.strictEqual(researcherProfile.description, 'Web research, data collection, and knowledge management');
  
  // Check that all servers are verified
  assert.deepStrictEqual(researcherProfile.servers, [
    'filesystem', 'memory', 'brave_search', 'notion'
  ]);
  
  // Verify each server exists and is verified
  for (const serverId of researcherProfile.servers) {
    const serverConfig = getServerConfig(serverId);
    assert.strictEqual(serverConfig.verified, true, `Server ${serverId} should be verified`);
  }
});

test('developer profile includes new verified servers', () => {
  const developerProfile = getProfileConfig('developer');
  
  assert.strictEqual(developerProfile.name, 'Developer Toolkit');
  assert.strictEqual(developerProfile.description, 'Complete development environment with Git and database access');
  
  // Check that Git and SQLite are included
  assert.ok(developerProfile.servers.includes('git'));
  assert.ok(developerProfile.servers.includes('sqlite'));
  assert.deepStrictEqual(developerProfile.servers, [
    'filesystem', 'memory', 'git', 'sqlite', 'everything'
  ]);
});

test('all verified servers have verification flag', () => {
  const verifiedServers = ['filesystem', 'memory', 'everything', 'sequential', 'sqlite', 'git', 'brave_search', 'notion', 'cloudflare', 'time'];
  
  for (const serverId of verifiedServers) {
    const serverConfig = getServerConfig(serverId);
    assert.strictEqual(serverConfig.verified, true, `Server ${serverId} should be marked as verified`);
    assert.ok(serverConfig.args.includes('-y'), `Server ${serverId} should use -y flag for npx`);
  }
});

test('notion server configuration', () => {
  const notionConfig = getServerConfig('notion');
  
  assert.strictEqual(notionConfig.name, 'Notion');
  assert.strictEqual(notionConfig.package, '@notionhq/notion-mcp-server');
  assert.strictEqual(notionConfig.auth, 'api_key');
  assert.strictEqual(notionConfig.verified, true);
  
  // Check env variable requirement
  assert.ok(notionConfig.env);
  assert.strictEqual(notionConfig.env.NOTION_API_KEY, 'your_notion_integration_token');
});
