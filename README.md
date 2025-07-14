# AmpGI - Amp General Intelligence Extension

Transform Amp into a general-purpose agent through end-user extensibility using MCP servers and configuration.

## Quick Start

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
