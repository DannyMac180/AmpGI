# AGENT.md - AmpGI Development Guide

## Commands
- `npm test` - Run all tests using Node.js test runner
- `node --test test/registry.test.js` - Run a single test file
- `npm run dev` - Start development with file watching
- `npm start` - Run the CLI tool
- `npm run install-example` - Install example personal assistant config

## Security Commands
- `node src/cli.js security status` - Show current security settings
- `node src/cli.js security safe-mode [on|off]` - Toggle safe mode
- `node src/cli.js security permissions <server> [tier]` - Manage server permissions
- `node src/cli.js security audit` - Perform security audit
- `node demo-security.js` - Run security system demonstration

## Architecture
- **CLI Tool**: Commander.js-based CLI with subcommands (install, list, test, apply, security)
- **Registry System**: Central registry for MCP server configs and profiles in `src/registry.js`
- **Profile System**: Pre-built configurations (personal, developer, researcher) in `examples/`
- **Amp Integration**: Updates Amp settings file with MCP server configurations
- **MCP Servers**: External Model Context Protocol servers for extending Amp capabilities
- **Security Sandboxing**: Process isolation, permission tiers, and safe mode protection
- **Process Management**: Secure MCP server lifecycle management with resource limits

## Code Style
- **ES Modules**: Use `import/export` syntax, `"type": "module"` in package.json
- **Async/Await**: All async operations use async/await pattern
- **Error Handling**: Try/catch blocks with chalk.red() for user-facing errors
- **CLI UX**: Use chalk for colors, ora for spinners, inquirer for prompts
- **Naming**: camelCase for functions/variables, kebab-case for CLI options
- **Imports**: Group external imports first, then relative imports with `.js` extensions
- **Testing**: Node.js built-in test runner with descriptive test names and assert module
