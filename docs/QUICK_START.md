# AmpGI Quick Start Guide

This guide will help you get started with AmpGI - transforming your Amp installation into a general-purpose agent using MCP servers.

## Prerequisites

- **Amp**: Either VS Code extension or CLI installation
- **Node.js**: Version 18 or higher
- **npm**: For installing MCP server packages

## Installation

### Option 1: Quick Install

```bash
# Clone the repository
git clone https://github.com/DannyMac180/AmpGI.git
cd AmpGI

# Install dependencies
npm install

# Install a profile (dry run first)
node src/cli.js install --profile personal --dry-run

# Install for real
node src/cli.js install --profile personal
```

### Option 2: Use Configuration File

```bash
# Apply a pre-built configuration
node src/cli.js apply examples/personal-assistant.json

# Or create your own configuration
node src/cli.js apply path/to/your/config.json
```

## Available Profiles

### Personal Assistant
- **Description**: File management, memory, and web automation
- **Servers**: filesystem, memory, puppeteer
- **Use Cases**: Document management, remembering information, web browsing automation

### Developer Plus
- **Description**: Enhanced development tools and testing
- **Servers**: filesystem, memory, everything
- **Use Cases**: File operations, persistent memory, MCP protocol testing

### Research Assistant
- **Description**: Web research and knowledge management
- **Servers**: filesystem, memory, crawler, puppeteer
- **Use Cases**: Web scraping, knowledge graphs, document analysis

### Sequential Thinker
- **Description**: Enhanced reasoning and problem solving
- **Servers**: memory, sequential, filesystem
- **Use Cases**: Complex problem solving, step-by-step analysis

## Basic Usage

### 1. List Available Options

```bash
# See all profiles
node src/cli.js list --profiles

# See all MCP servers
node src/cli.js list --servers
```

### 2. Install a Profile

```bash
# Install interactively
node src/cli.js install

# Install specific profile
node src/cli.js install --profile personal

# Install specific servers
node src/cli.js install --servers filesystem memory
```

### 3. Test Your Installation

```bash
# Test all configured servers
node src/cli.js test --all

# Test specific server
node src/cli.js test --server filesystem
```

### 4. Apply Configuration

```bash
# Apply from file
node src/cli.js apply examples/personal-assistant.json

# Dry run first
node src/cli.js apply examples/personal-assistant.json --dry-run
```

## After Installation

1. **Restart Amp**: Restart your VS Code or CLI client
2. **Test functionality**: Use `node src/cli.js test --all`
3. **Start using**: Your Amp now has enhanced capabilities!

## Example Tasks

Once installed, you can use your enhanced Amp for tasks like:

```
"Create a new document in my Documents folder and save my research notes"
(Uses: filesystem server)

"Remember that John's birthday is next month"
(Uses: memory server)

"Take a screenshot of this webpage and save it to my project folder"
(Uses: puppeteer + filesystem servers)

"Search for information about AI research and organize it in my knowledge base"
(Uses: crawler + memory + filesystem servers)
```

## Configuration Files

All configuration is stored in your Amp settings:

- **VS Code**: `~/Library/Application Support/Code/User/settings.json`
- **CLI**: `~/.config/amp/config.json`

The MCP servers are configured in the `amp.mcpServers` section.

## Troubleshooting

### Common Issues

1. **"Amp installation not found"**
   - Install Amp VS Code extension or CLI first
   - Verify installation with `amp --version` (CLI) or check VS Code extensions

2. **"Server connection failed"**
   - Check if Node.js is installed and available
   - Verify MCP server packages are installed
   - Use `node src/cli.js test --server <name>` to debug

3. **"High privilege server warning"**
   - Some servers (like filesystem) require explicit permission
   - These warnings are normal for security-sensitive operations

### Getting Help

1. Check the [documentation](docs/)
2. Test your setup with `node src/cli.js test --all`
3. View detailed server information with `node src/cli.js list --servers`

## Next Steps

- Explore the [examples](examples/) directory for more configurations
- Check out the [registry](src/registry.js) to see all available servers
- Contribute to the project by adding new MCP servers or profiles
