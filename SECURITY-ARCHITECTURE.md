# AmpGI Security Architecture

## Overview

AmpGI implements a comprehensive security sandboxing system that protects users while maintaining functionality. The system provides process isolation, permission enforcement, and safe mode capabilities to ensure MCP servers run with appropriate privilege restrictions.

## Core Components

### 1. Permission Tier System

Three distinct permission tiers provide granular control over server capabilities:

#### Low Privilege (`low`)
- **File Access**: Read-only access to user directories (Documents, Desktop, current working directory)
- **Network Access**: No network access permitted
- **Process Limits**: 256MB RAM, 25% CPU, 15s execution timeout
- **Use Cases**: Simple calculators, text processors, read-only tools

#### Medium Privilege (`medium`)
- **File Access**: Limited write access to user directories (Documents, Desktop, Downloads, cwd)
- **Network Access**: Restricted to whitelisted domains (GitHub, OpenAI, Google APIs, AWS)
- **Process Limits**: 512MB RAM, 50% CPU, 30s execution timeout
- **Use Cases**: API integrations, file management, development tools

#### High Privilege (`high`)
- **File Access**: Full file system access (with user consent)
- **Network Access**: Unrestricted network access
- **Process Limits**: 1GB RAM, 80% CPU, 60s execution timeout
- **Use Cases**: System administration, advanced file operations, unrestricted tools

### 2. Process Isolation

Each MCP server runs in a separate, monitored child process:

```javascript
// Process lifecycle management
- Start: Spawn server in sandbox with resource limits
- Monitor: Health checks every 30 seconds
- Control: Graceful shutdown with SIGTERM → SIGKILL escalation
- Cleanup: Automatic cleanup of dead processes
```

#### Resource Governance
- **Memory Limits**: Enforced per permission tier
- **CPU Throttling**: Process-level CPU percentage limits
- **Execution Timeouts**: Per-operation timeout enforcement
- **Concurrent Limits**: Maximum 10 servers running simultaneously

### 3. Safe Mode Protection

Safe mode provides additional protection for new users:

- **Default State**: Enabled for new installations
- **High Privilege Blocking**: Blocks high privilege servers by default
- **User Consent**: Requires explicit approval for privilege escalation
- **Override System**: Allows permanent permission overrides

### 4. File System Access Controls

Sophisticated path validation and sandboxing:

```javascript
// Blocked paths for low/medium privilege
const BLOCKED_PATHS = [
  '/etc',        // System configuration
  '/usr',        // System binaries
  '/bin',        // Core binaries
  '/sbin',       // System binaries
  '/var',        // System state
  '~/.ssh',      // SSH keys
  '~/.config'    // User configuration (medium only)
];
```

#### Path Validation
- Resolves relative paths to absolute paths
- Checks against blocked directories
- Validates read/write permissions by tier
- Provides escalation suggestions

### 5. Network Access Controls

Domain and port-based network restrictions:

#### Whitelisted Domains (Medium Privilege)
```javascript
const ALLOWED_DOMAINS = [
  'api.github.com',
  'api.openai.com', 
  'api.anthropic.com',
  '*.googleapis.com',
  '*.amazonaws.com'
];
```

#### Port Restrictions
- **Low**: No network access
- **Medium**: Ports 80, 443, 8080 only
- **High**: All ports allowed

### 6. Environment Variable Sanitization

Careful environment variable handling:

```javascript
// Always included (minimal environment)
const SAFE_VARS = ['NODE_ENV', 'PATH', 'HOME', 'USER', 'LANG', 'TZ'];

// Blocked patterns (sensitive data)
const BLOCKED_PATTERNS = [
  /^.*_TOKEN$/,
  /^.*_KEY$/,
  /^.*_SECRET$/,
  /^.*_PASSWORD$/,
  /^SSH_/,
  /^AWS_/,
  /^GITHUB_/
];
```

## Security Commands

### Status and Monitoring
```bash
# Show current security status
ampgi security status

# Perform comprehensive security audit
ampgi security audit
```

### Safe Mode Management
```bash
# Enable safe mode (blocks high privilege servers)
ampgi security safe-mode on

# Disable safe mode (allows all servers)
ampgi security safe-mode off
```

### Permission Management
```bash
# Show server permissions
ampgi security permissions filesystem

# Set server permission tier
ampgi security permissions filesystem high

# Install with safe mode
ampgi install --profile personal --safe-mode
```

## Runtime Permission Enforcement

The system enforces permissions at runtime through:

### File Operations
```javascript
const result = enforcePermissions(sandbox, 'file_write', '/path/to/file');
if (!result.allowed) {
  throw new Error(result.reason);
}
```

### Network Operations
```javascript
const result = enforcePermissions(sandbox, 'network_access', 'api.example.com', {
  domain: 'api.example.com',
  port: 443
});
```

### Subprocess Execution
```javascript
const result = enforcePermissions(sandbox, 'subprocess_spawn', 'command');
// Low privilege: Always blocked
// Medium/High: Allowed with monitoring
```

## Installation Security

### Permission Validation
Before installation, the system:

1. **Analyzes server configurations** for permission requirements
2. **Checks safe mode status** and blocks high privilege servers if enabled
3. **Presents security warnings** for high privilege operations
4. **Requests user consent** for privilege escalation
5. **Stores permission overrides** for future use

### Installation Flow
```javascript
// 1. Validate permissions
const validation = await validateInstallationPermissions(serverIds);

// 2. Separate allowed and blocked servers
const { allowedServers, blockedServers } = validation;

// 3. Request user consent for blocked servers
if (blockedServers.length > 0) {
  const consent = await requestPermissionEscalation(...);
  if (consent.granted) {
    // Store permanent override
    await setPermissionOverride(serverId, requestedTier);
  }
}
```

## Process Monitoring and Health Checks

### Health Monitoring
- **Periodic Checks**: Every 30 seconds
- **Process Validation**: Verify process is alive and responsive
- **Resource Monitoring**: Track memory and CPU usage
- **Auto-restart**: Up to 3 restart attempts on unexpected exit

### Process Lifecycle Events
```javascript
processManager.on('serverStarted', ({ serverId, sandbox }) => {
  console.log(`Server ${serverId} started with ${sandbox.permissionTier} privilege`);
});

processManager.on('serverUnhealthy', ({ serverId, reason }) => {
  console.log(`Server ${serverId} unhealthy: ${reason}`);
});
```

## Security Auditing

The system provides comprehensive security auditing:

### Audit Report Contents
- **Safe mode status** and configuration
- **Permission overrides** and their creation dates
- **Running servers** with permission tiers and resource usage
- **Security issues** and recommendations
- **Overall security score** (0-100)

### Security Recommendations
- Automatic detection of overprivileged servers
- Suggestions for permission tier reductions
- Missing authentication warnings
- Safe mode compliance checks

## User Experience

### Security Warnings
Clear, informative security warnings for high privilege operations:

```
⚠️  Security Warning:
  • Full file system access
  • Unrestricted network access  
  • Ability to execute system commands
  • Access to sensitive environment variables

Grant permission escalation? (yes/no):
```

### Visual Indicators
- **🟢 Low privilege**: Green indicators for safe operations
- **🟡 Medium privilege**: Yellow indicators for limited access
- **🔴 High privilege**: Red indicators requiring attention

### Progressive Disclosure
- Basic security status for everyday users
- Detailed audit information for power users
- Technical recommendations for developers

## Platform Considerations

### Unix-like Systems (macOS, Linux)
- **Process Groups**: Proper process group management
- **Signal Handling**: Graceful SIGTERM → SIGKILL shutdown
- **ulimit Integration**: Memory and resource limit enforcement
- **File Permissions**: Native file permission respect

### Windows Support
- **Job Objects**: Windows process control mechanism
- **Resource Limits**: Windows-specific resource management
- **Path Handling**: Proper Windows path resolution
- **Graceful Degradation**: Fallback when advanced features unavailable

## Testing and Validation

### Comprehensive Test Suite
- **Permission Enforcement**: Validate all permission tier restrictions
- **File Access Control**: Test path validation and blocking
- **Network Restrictions**: Verify domain and port filtering
- **Safe Mode Operation**: Ensure proper blocking behavior
- **Process Isolation**: Validate resource limits and cleanup

### Security Testing
```bash
# Run security test suite
node --test test/security.test.js

# Run security demonstration
node demo-security.js
```

## Future Enhancements

### Planned Security Features
- **Container Integration**: Docker/Podman container isolation
- **Capability-based Security**: Linux capabilities support
- **Audit Logging**: Comprehensive operation logging
- **Policy Management**: Centralized security policy configuration
- **Real-time Monitoring**: Live security event monitoring

### Advanced Sandboxing
- **syscall Filtering**: seccomp/BPF on Linux
- **Namespace Isolation**: Linux namespace integration
- **macOS Sandbox**: Native macOS sandbox API integration
- **Windows Security**: Advanced Windows security features

This security architecture provides robust protection while maintaining usability, ensuring that AmpGI can safely extend Amp's capabilities without compromising system security.
