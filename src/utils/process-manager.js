import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createSandbox, applyResourceLimits, createSandboxedEnv, PERMISSION_TIERS } from './sandbox.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Global process manager for MCP servers
 */
class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // serverId -> ProcessInfo
    this.sandboxes = new Map(); // sandboxId -> Sandbox
    this.healthChecks = new Map(); // serverId -> interval
    this.maxConcurrentProcesses = 10;
    this.cleanupInterval = null;
    this.initialized = false;
    
    // Don't start cleanup automatically - wait for initialization
    
    // Handle process exit
    process.on('exit', () => this.killAllServers());
    process.on('SIGINT', () => this.killAllServers());
    process.on('SIGTERM', () => this.killAllServers());
  }
  
  /**
   * Initialize the process manager (call this before first use)
   */
  initialize() {
    if (!this.initialized) {
      this.startCleanup();
      this.initialized = true;
    }
  }
  
  /**
   * Start an MCP server in a sandbox
   */
  async startMCPServer(serverConfig, permissionTier = null, options = {}) {
    // Ensure process manager is initialized
    this.initialize();
    
    const serverId = serverConfig.id || serverConfig.name;
    
    // Check if server is already running
    if (this.processes.has(serverId)) {
      const existing = this.processes.get(serverId);
      if (existing.status === 'running') {
        throw new Error(`Server ${serverId} is already running`);
      }
    }
    
    // Check concurrent process limit
    const runningCount = Array.from(this.processes.values())
      .filter(p => p.status === 'running').length;
    
    if (runningCount >= this.maxConcurrentProcesses) {
      throw new Error(`Maximum concurrent processes (${this.maxConcurrentProcesses}) reached`);
    }
    
    // Determine permission tier
    if (!permissionTier) {
      permissionTier = this.getDefaultPermissionTier(serverConfig);
    }
    
    // Create sandbox
    const sandbox = createSandbox(serverConfig, permissionTier);
    this.sandboxes.set(sandbox.id, sandbox);
    
    // Prepare execution environment
    const env = createSandboxedEnv(sandbox, options.env);
    const args = this.prepareArgs(serverConfig, sandbox);
    
    // Create process info
    const processInfo = {
      serverId,
      sandboxId: sandbox.id,
      pid: null,
      status: 'starting',
      startTime: new Date(),
      lastHealthCheck: null,
      restartCount: 0,
      childProcess: null,
      stdout: '',
      stderr: '',
      config: serverConfig
    };
    
    this.processes.set(serverId, processInfo);
    
    try {
      // Spawn the process
      const childProcess = spawn(serverConfig.command, args, {
        env,
        stdio: options.stdio || ['pipe', 'pipe', 'pipe'],
        cwd: options.cwd || process.cwd(),
        detached: false
      });
      
      processInfo.childProcess = childProcess;
      processInfo.pid = childProcess.pid;
      sandbox.pid = childProcess.pid;
      
      // Apply resource limits
      const resourceControls = applyResourceLimits(childProcess, sandbox);
      processInfo.resourceControls = resourceControls;
      
      // Set up process event handlers
      this.setupProcessHandlers(childProcess, processInfo, sandbox);
      
      // Start health monitoring
      this.startHealthMonitoring(serverId);
      
      processInfo.status = 'running';
      this.emit('serverStarted', { serverId, sandbox, processInfo });
      
      return {
        success: true,
        serverId,
        sandboxId: sandbox.id,
        pid: childProcess.pid,
        permissionTier: sandbox.permissionTier
      };
      
    } catch (error) {
      processInfo.status = 'failed';
      this.processes.delete(serverId);
      this.sandboxes.delete(sandbox.id);
      
      throw new Error(`Failed to start server ${serverId}: ${error.message}`);
    }
  }
  
  /**
   * Stop an MCP server
   */
  async stopMCPServer(serverId, reason = 'manual') {
    const processInfo = this.processes.get(serverId);
    if (!processInfo) {
      return { success: false, error: 'Server not found' };
    }
    
    const { childProcess, sandboxId } = processInfo;
    
    try {
      // Update status
      processInfo.status = 'stopping';
      this.emit('serverStopping', { serverId, reason });
      
      // Stop health monitoring
      this.stopHealthMonitoring(serverId);
      
      // Graceful shutdown first
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
          
          childProcess.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
      // Clean up resource controls
      if (processInfo.resourceControls?.cleanup) {
        processInfo.resourceControls.cleanup();
      }
      
      // Remove from tracking
      this.processes.delete(serverId);
      this.sandboxes.delete(sandboxId);
      
      this.emit('serverStopped', { serverId, reason });
      
      return { success: true, reason };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Restart an MCP server
   */
  async restartMCPServer(serverId, options = {}) {
    const processInfo = this.processes.get(serverId);
    if (!processInfo) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    const serverConfig = processInfo.config;
    const sandbox = this.sandboxes.get(processInfo.sandboxId);
    const permissionTier = sandbox?.permissionTier;
    
    // Increment restart count
    processInfo.restartCount++;
    
    // Stop the current process
    await this.stopMCPServer(serverId, 'restart');
    
    // Start it again
    return await this.startMCPServer(serverConfig, permissionTier, options);
  }
  
  /**
   * Kill a server immediately
   */
  killServer(serverId, reason = 'killed') {
    const processInfo = this.processes.get(serverId);
    if (!processInfo || !processInfo.childProcess) {
      return false;
    }
    
    try {
      processInfo.childProcess.kill('SIGKILL');
      processInfo.status = 'killed';
      this.emit('serverKilled', { serverId, reason });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get server status
   */
  getServerStatus(serverId) {
    const processInfo = this.processes.get(serverId);
    if (!processInfo) {
      return { status: 'not_found' };
    }
    
    const sandbox = this.sandboxes.get(processInfo.sandboxId);
    
    return {
      status: processInfo.status,
      pid: processInfo.pid,
      startTime: processInfo.startTime,
      lastHealthCheck: processInfo.lastHealthCheck,
      restartCount: processInfo.restartCount,
      permissionTier: sandbox?.permissionTier,
      sandboxId: processInfo.sandboxId,
      uptime: Date.now() - processInfo.startTime.getTime()
    };
  }
  
  /**
   * Get all running servers
   */
  getAllServers() {
    const servers = {};
    for (const [serverId, processInfo] of this.processes) {
      servers[serverId] = this.getServerStatus(serverId);
    }
    return servers;
  }
  
  /**
   * Monitor server health
   */
  startHealthMonitoring(serverId) {
    this.stopHealthMonitoring(serverId); // Clear any existing monitoring
    
    const interval = setInterval(() => {
      this.performHealthCheck(serverId);
    }, 30000); // Check every 30 seconds
    
    this.healthChecks.set(serverId, interval);
  }
  
  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(serverId) {
    const interval = this.healthChecks.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(serverId);
    }
  }
  
  /**
   * Perform health check on a server
   */
  async performHealthCheck(serverId) {
    const processInfo = this.processes.get(serverId);
    if (!processInfo || !processInfo.childProcess) {
      return;
    }
    
    const { childProcess } = processInfo;
    
    // Check if process is still alive
    if (childProcess.killed || childProcess.exitCode !== null) {
      this.emit('serverUnhealthy', { 
        serverId, 
        reason: 'Process terminated unexpectedly',
        exitCode: childProcess.exitCode 
      });
      return;
    }
    
    // Update last health check
    processInfo.lastHealthCheck = new Date();
    
    // Emit health check event
    this.emit('healthCheck', { serverId, healthy: true });
  }
  
  /**
   * Clean up dead processes
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      for (const [serverId, processInfo] of this.processes) {
        if (processInfo.childProcess && 
            (processInfo.childProcess.killed || processInfo.childProcess.exitCode !== null)) {
          
          console.log(`Cleaning up dead process for server ${serverId}`);
          this.stopMCPServer(serverId, 'cleanup');
        }
      }
    }, 60000); // Cleanup every minute
  }
  
  /**
   * Kill all servers
   */
  killAllServers() {
    const serverIds = Array.from(this.processes.keys());
    for (const serverId of serverIds) {
      this.killServer(serverId, 'shutdown');
    }
    
    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    for (const interval of this.healthChecks.values()) {
      clearInterval(interval);
    }
  }
  
  /**
   * Set up process event handlers
   */
  setupProcessHandlers(childProcess, processInfo, sandbox) {
    const { serverId } = processInfo;
    
    childProcess.stdout.on('data', (data) => {
      processInfo.stdout += data.toString();
      this.emit('serverOutput', { serverId, type: 'stdout', data: data.toString() });
    });
    
    childProcess.stderr.on('data', (data) => {
      processInfo.stderr += data.toString();
      this.emit('serverOutput', { serverId, type: 'stderr', data: data.toString() });
    });
    
    childProcess.on('exit', (code, signal) => {
      processInfo.status = 'stopped';
      this.emit('serverExit', { serverId, code, signal });
      
      // Auto-restart on unexpected exit (up to 3 times)
      if (code !== 0 && processInfo.restartCount < 3) {
        console.log(`Server ${serverId} exited unexpectedly (code: ${code}), attempting restart...`);
        setTimeout(() => {
          this.restartMCPServer(serverId).catch(error => {
            console.error(`Failed to restart server ${serverId}:`, error.message);
          });
        }, 5000);
      }
    });
    
    childProcess.on('error', (error) => {
      processInfo.status = 'error';
      this.emit('serverError', { serverId, error });
    });
  }
  
  /**
   * Prepare command arguments for sandbox execution
   */
  prepareArgs(serverConfig, sandbox) {
    let args = [...(serverConfig.args || [])];
    
    // Replace placeholders
    args = args.map(arg => {
      return arg
        .replace('{username}', os.userInfo().username)
        .replace('{sandbox_id}', sandbox.id)
        .replace('{permission_tier}', sandbox.permissionTier);
    });
    
    return args;
  }
  
  /**
   * Get default permission tier (fallback method)
   */
  getDefaultPermissionTier(serverConfig) {
    // This should match the logic in sandbox.js
    if (serverConfig.permissions?.includes('high')) {
      return PERMISSION_TIERS.HIGH;
    }
    if (serverConfig.permissions?.includes('medium')) {
      return PERMISSION_TIERS.MEDIUM;
    }
    return PERMISSION_TIERS.LOW;
  }
}

// Global instance
const processManager = new ProcessManager();

export default processManager;

// Named exports for convenience
export const startMCPServer = (serverConfig, permissionTier, options) => 
  processManager.startMCPServer(serverConfig, permissionTier, options);

export const stopMCPServer = (serverId, reason) => 
  processManager.stopMCPServer(serverId, reason);

export const restartMCPServer = (serverId, options) => 
  processManager.restartMCPServer(serverId, options);

export const killServer = (serverId, reason) => 
  processManager.killServer(serverId, reason);

export const getServerStatus = (serverId) => 
  processManager.getServerStatus(serverId);

export const getAllServers = () => 
  processManager.getAllServers();

export { processManager };
