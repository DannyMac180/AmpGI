/**
 * Discovery System Test Suite
 * 
 * Tests the MCP server discovery functionality including:
 * - NPM registry discovery
 * - GitHub repository discovery  
 * - Search and filtering
 * - Compatibility testing
 * - Cache functionality
 */

import test from 'node:test';
import assert from 'node:assert';
import { discoverAllServers, searchServers, getServersByCategory, getCategories } from '../src/utils/discovery.js';
import { testServerCompatibility, TEST_LEVELS } from '../src/utils/compatibility.js';

test('Discovery System Tests', async (t) => {
  
  await t.test('NPM Discovery', async () => {
    const servers = await discoverAllServers({ 
      source: 'npm', 
      useCache: false, 
      limit: 5 
    });
    
    assert.ok(Array.isArray(servers), 'Should return an array of servers');
    assert.ok(servers.length > 0, 'Should discover at least one server');
    
    // Check server structure
    const server = servers[0];
    assert.ok(server.id, 'Server should have an id');
    assert.ok(server.name, 'Server should have a name');
    assert.ok(server.displayName, 'Server should have a display name');
    assert.ok(server.description, 'Server should have a description');
    assert.ok(server.source === 'npm', 'Server should have npm source');
    assert.ok(typeof server.official === 'boolean', 'Server should have official flag');
  });

  await t.test('GitHub Discovery', async () => {
    const servers = await discoverAllServers({ 
      source: 'github', 
      useCache: false, 
      limit: 5 
    });
    
    assert.ok(Array.isArray(servers), 'Should return an array of servers');
    
    if (servers.length > 0) {
      const server = servers[0];
      assert.ok(server.source === 'github', 'Server should have github source');
      assert.ok(server.official === true, 'GitHub servers should be marked as official');
    }
  });

  await t.test('Combined Discovery', async () => {
    const servers = await discoverAllServers({ 
      source: 'all', 
      useCache: false, 
      limit: 10 
    });
    
    assert.ok(Array.isArray(servers), 'Should return an array of servers');
    assert.ok(servers.length > 0, 'Should discover servers from multiple sources');
    
    const sources = [...new Set(servers.map(s => s.source))];
    assert.ok(sources.length >= 1, 'Should have at least one source');
  });

  await t.test('Search Functionality', async () => {
    const servers = await discoverAllServers({ 
      source: 'npm', 
      useCache: false, 
      limit: 10 
    });
    
    // Test text search
    const fileResults = searchServers(servers, 'file');
    assert.ok(Array.isArray(fileResults), 'Search should return an array');
    
    // Test that results contain the search term
    if (fileResults.length > 0) {
      const hasMatch = fileResults.some(server => 
        server.name.toLowerCase().includes('file') ||
        server.description.toLowerCase().includes('file') ||
        server.capabilities?.some(cap => cap.toLowerCase().includes('file'))
      );
      assert.ok(hasMatch, 'Search results should contain the search term');
    }
  });

  await t.test('Category Filtering', async () => {
    const servers = await discoverAllServers({ 
      source: 'npm', 
      useCache: false, 
      limit: 10 
    });
    
    const categories = getCategories(servers);
    assert.ok(Array.isArray(categories), 'Should return array of categories');
    
    if (categories.length > 0) {
      const category = categories[0];
      const categoryServers = getServersByCategory(servers, category);
      
      assert.ok(Array.isArray(categoryServers), 'Category filtering should return array');
      categoryServers.forEach(server => {
        assert.strictEqual(server.category, category, 'All servers should match the category');
      });
    }
  });

  await t.test('Cache Functionality', async () => {
    // First call without cache
    const startTime1 = Date.now();
    const servers1 = await discoverAllServers({ 
      source: 'npm', 
      useCache: false, 
      limit: 3 
    });
    const freshTime = Date.now() - startTime1;
    
    // Second call with cache
    const startTime2 = Date.now();
    const servers2 = await discoverAllServers({ 
      source: 'npm', 
      useCache: true, 
      limit: 3 
    });
    const cacheTime = Date.now() - startTime2;
    
    assert.ok(Array.isArray(servers1), 'Fresh discovery should return array');
    assert.ok(Array.isArray(servers2), 'Cached discovery should return array');
    
    // Cache should be significantly faster (allowing for some variance)
    if (servers1.length > 0 && servers2.length > 0) {
      assert.ok(cacheTime < freshTime, 'Cache should be faster than fresh discovery');
    }
  });

  await t.test('Compatibility Testing', async () => {
    const servers = await discoverAllServers({ 
      source: 'npm', 
      useCache: false, 
      limit: 5 
    });
    
    // Find an official server with a package
    const testServer = servers.find(s => s.official && s.package);
    
    if (testServer) {
      const result = await testServerCompatibility(testServer, {
        level: TEST_LEVELS.BASIC
      });
      
      assert.ok(result.serverId, 'Result should have server ID');
      assert.ok(result.serverName, 'Result should have server name');
      assert.ok(typeof result.passed === 'boolean', 'Result should have passed flag');
      assert.ok(typeof result.score === 'number', 'Result should have numeric score');
      assert.ok(typeof result.maxScore === 'number', 'Result should have max score');
      assert.ok(result.recommendation, 'Result should have recommendation');
      assert.ok(result.tests, 'Result should have test details');
      
      // Official servers should generally pass basic tests
      if (result.tests.basic && result.tests.basic.installation) {
        assert.ok(result.tests.basic.installation.passed, 'Installation test should pass for official servers');
      }
    }
  });

  await t.test('Server Data Validation', async () => {
    const servers = await discoverAllServers({ 
      source: 'npm', 
      useCache: false, 
      limit: 5 
    });
    
    servers.forEach(server => {
      // Required fields
      assert.ok(server.id, 'Server must have ID');
      assert.ok(server.name, 'Server must have name');
      assert.ok(server.displayName, 'Server must have display name');
      assert.ok(server.description, 'Server must have description');
      assert.ok(server.source, 'Server must have source');
      assert.ok(server.category, 'Server must have category');
      
      // Type validation
      assert.ok(typeof server.id === 'string', 'ID should be string');
      assert.ok(typeof server.name === 'string', 'Name should be string');
      assert.ok(typeof server.displayName === 'string', 'Display name should be string');
      assert.ok(typeof server.description === 'string', 'Description should be string');
      assert.ok(typeof server.official === 'boolean', 'Official should be boolean');
      
      // Array fields
      if (server.capabilities) {
        assert.ok(Array.isArray(server.capabilities), 'Capabilities should be array');
      }
      if (server.keywords) {
        assert.ok(Array.isArray(server.keywords), 'Keywords should be array');
      }
    });
  });

  await t.test('Error Handling', async () => {
    // Test with invalid source
    try {
      await discoverAllServers({ source: 'invalid-source', limit: 1 });
      assert.fail('Should throw error for invalid source');
    } catch (error) {
      // Expected to fail
      assert.ok(error instanceof Error, 'Should throw proper Error object');
    }
    
    // Test search with invalid input
    const result = searchServers([], 'test');
    assert.ok(Array.isArray(result), 'Search should handle empty input gracefully');
    assert.strictEqual(result.length, 0, 'Search should return empty array for empty input');
  });
});
