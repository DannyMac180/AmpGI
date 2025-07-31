# AmpGI - Amp General Intelligence Extension

Transform Amp into a general-purpose agent through end-user extensibility using MCP servers and configuration.

## 🚀 Complete Onboarding Guide

Welcome to AmpGI! This guide will walk you through everything you need to get started, even if you're new to coding or command-line tools.

### Step 1: Check Prerequisites

Before installing AmpGI, you need these tools installed on your computer:

#### Install Node.js (JavaScript Runtime)
1. **Visit** [nodejs.org](https://nodejs.org/)
2. **Download** the "LTS" version (recommended for most users)
3. **Run** the installer and follow the setup wizard
4. **Verify** installation by opening your terminal and typing:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers for both commands.

#### Install Amp (AI Assistant)
Choose one option:

**Option A: VS Code Extension (Easiest)**
1. **Open** Visual Studio Code
2. **Click** the Extensions icon (puzzle piece) in the sidebar
3. **Search** for "Amp" 
4. **Click** "Install" on the official Amp extension

**Option B: Command Line Tool**
1. **Visit** [ampcode.com](https://ampcode.com) for installation instructions
2. **Follow** the setup guide for your operating system

### Step 2: Install AmpGI

Open your terminal (Command Prompt on Windows, Terminal on Mac/Linux) and run:

```bash
npm install -g ampgi
```

**What this does:** Downloads and installs AmpGI globally on your computer, making the `ampgi` command available anywhere.

### Step 3: Choose Your Setup Profile

AmpGI comes with pre-configured profiles for different use cases. Pick the one that best matches your needs:

#### 🏠 Personal Assistant (Recommended for beginners)
File management, memory, and productivity tools with Notion integration.
```bash
ampgi install --profile personal
```

#### 💻 Developer Toolkit
Complete development environment with Git, database, and testing tools.
```bash
ampgi install --profile developer
```

#### 🔬 Research Assistant  
Web research, data collection, and knowledge management with search capabilities.
```bash
ampgi install --profile researcher
```

#### 🧠 Enhanced Reasoning
Advanced problem-solving with structured thinking and time awareness.
```bash
ampgi install --profile thinker
```

### Step 4: Set Up Authentication (If Required)

Some servers require API keys or authentication. AmpGI will guide you through this:

```bash
ampgi auth setup <server-name>
```

**Common servers requiring authentication:**
- **Notion**: Requires Notion Integration Token
- **Brave Search**: Requires Brave Search API Key  
- **GitHub**: Requires Personal Access Token (for developer profile)

### Step 5: Verify Your Installation

Test that everything is working correctly:

```bash
ampgi test --all
```

**What this does:** Checks that all your installed MCP servers are running properly.

### Step 6: Restart Amp

**For VS Code Users:**
1. **Close** VS Code completely
2. **Reopen** VS Code
3. **Check** that Amp shows new capabilities

**For CLI Users:**
1. **Close** your terminal
2. **Open** a new terminal session
3. **Test** Amp commands

### Step 7: Start Using Your Enhanced Amp!

You can now use Amp for advanced tasks. Here are some examples:

#### File Management Examples
```
"Create a folder called 'Project Notes' in my Documents and organize my files by date"

"Find all PDF files on my desktop and move them to a new folder"

"Make a backup copy of my important documents"
```

#### Memory & Organization Examples  
```
"Remember that my team meeting is every Wednesday at 2 PM"

"Save this information about the new project requirements"

"What did I save about John's contact information?"
```

#### Web & Research Examples
```
"Take a screenshot of this webpage and save it to my research folder"

"Search for the latest news about AI and summarize the key points"

"Visit this website and extract the main contact information"
```

### 📋 Command Reference

Here are the main AmpGI commands you'll use:

```bash
# See all available profiles and servers
ampgi list

# Install a specific profile
ampgi install --profile personal

# Set up authentication for servers
ampgi auth setup <server-name>
ampgi auth list

# Test your installation
ampgi test --all

# Discover additional MCP servers
ampgi discover
ampgi search "database"

# Security and configuration
ampgi security status
ampgi security safe-mode on

# See what's currently installed
ampgi list --installed

# Get help with any command
ampgi --help
```

### 🔧 Troubleshooting Common Issues

#### "Command not found: ampgi"
**Solution:** Make sure you installed with the `-g` flag:
```bash
npm install -g ampgi
```

#### "Amp installation not found"
**Solution:** Install Amp first (see Step 1), then restart your terminal.

#### "Server connection failed"
**Solution:** 
1. Make sure Node.js is installed: `node --version`
2. Test individual servers: `ampgi test --server filesystem`
3. Check if authentication is needed: `ampgi auth list`
4. Restart Amp after installation

#### "Permission denied" errors
**Solution:** Some servers need permission to access files. This is normal and secure - Amp will ask before accessing sensitive data.

#### "Authentication required" errors
**Solution:** Set up authentication for the server:
```bash
ampgi auth setup <server-name>
```

#### "Safe mode blocked installation"
**Solution:** AmpGI protects new users by blocking high-privilege servers. To allow:
```bash
ampgi security safe-mode off
```

### 🛡️ Security & Safety

AmpGI is designed with enterprise-grade security:

- **Process Isolation**: Each MCP server runs in a separate, sandboxed process
- **Permission Tiers**: Low/Medium/High privilege levels with runtime enforcement
- **Safe Mode**: High-privilege servers blocked by default for new users
- **Secure Credentials**: OS keychain integration for encrypted credential storage
- **File System Controls**: Restricted directory access and path validation
- **Network Controls**: Domain whitelisting and port restrictions
- **Audit Trail**: Complete security monitoring with `ampgi security audit`

### 🆘 Getting Help

If you run into issues:

1. **Check the status**: `ampgi test --all`
2. **View detailed information**: `ampgi list --servers`
3. **Check our documentation**: Visit the [GitHub repository](https://github.com/DannyMac180/AmpGI)
4. **Report issues**: Use GitHub Issues for bugs or feature requests

### 🎯 What's Next?

Once you're comfortable with the basics:

1. **Discover More Servers**: Use `ampgi discover` to find additional MCP servers
2. **Try Different Profiles**: Experiment with developer or research profiles
3. **Set Up Authentication**: Connect to services like Notion, GitHub, or Brave Search
4. **Explore Security Features**: Learn about safe mode and permission controls
5. **Customize Your Setup**: Modify configurations to fit your workflow  
6. **Contribute**: Help improve AmpGI by sharing feedback or contributing code

---

## Quick Start (For Experienced Users)

```bash
npm install -g ampgi
ampgi install --profile personal
```

## What is AmpGI?

AmpGI extends Amp's capabilities by leveraging the existing MCP (Model Context Protocol) server ecosystem. Instead of requiring changes to Amp itself, users can configure their installation to add capabilities like:

- **Email & Calendar** - Send emails, schedule meetings, manage calendars
- **File Management** - Organize files, sync to cloud storage, process documents
- **Development Tools** - Enhanced Git operations, database queries, API integrations
- **Communication** - Slack, Teams, and other messaging platforms
- **Automation** - Web scraping, data analysis, system administration

## Installation Methods

### 1. NPM Package (Recommended)

```bash
npm install -g ampgi
ampgi install --profile personal
```

### 2. Configuration Templates

```bash
curl -s https://raw.githubusercontent.com/DannyMac180/AmpGI/main/examples/personal-assistant.json > ~/.ampgi-config.json
ampgi apply ~/.ampgi-config.json
```

### 3. Manual Configuration

Add MCP servers directly to your Amp settings:

```json
{
  "amp.mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "--allowed-directory", "/Users/username/Documents"]
    },
    "gmail": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-gmail"],
      "env": { "GMAIL_CREDENTIALS": "~/.ampgi/gmail-oauth.json" }
    }
  }
}
```

## Pre-built Profiles

- **Personal Assistant**: Email, calendar, documents, notes
- **Business Productivity**: Project management, CRM, analytics
- **Developer Plus**: Enhanced coding tools + deployment, monitoring
- **Research Assistant**: Knowledge management, data analysis
- **Content Creator**: Social media, content planning, publishing

## Example Usage

Once configured, you can use Amp for tasks like:

```
User: "Schedule a meeting with John next Tuesday at 2pm and send him the agenda"
Amp: [uses calendar MCP + email MCP to schedule and notify]

User: "Analyze my project's GitHub issues and create a status report"
Amp: [uses GitHub MCP + document MCP to fetch data and generate report]

User: "Backup my important documents to Dropbox and organize them by date"
Amp: [uses cloud MCP + file organization MCP]
```

## Security & Safety

- **Sandboxed Execution**: Each MCP server runs in isolation
- **Permission Controls**: Granular scopes and runtime consent
- **Secure Credentials**: OS keychain integration
- **Safe Mode**: Disable high-privilege operations for new users

## Contributing

See our [Contributing Guide](docs/CONTRIBUTING.md) for how to:
- Report bugs and request features
- Contribute to the MCP server registry
- Develop new MCP servers
- Improve documentation

## License

MIT License - see [LICENSE](LICENSE) for details.
