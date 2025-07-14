# Contributing to AmpGI

We welcome contributions to AmpGI! This document explains how to contribute to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/AmpGI.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature`

## Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test the CLI
node src/cli.js --help
```

## Project Structure

```
AmpGI/
├── src/
│   ├── cli.js              # Main CLI entry point
│   ├── registry.js         # MCP server registry
│   ├── commands/           # CLI commands
│   │   ├── install.js      # Install command
│   │   ├── list.js         # List command
│   │   ├── test.js         # Test command
│   │   └── apply.js        # Apply command
│   └── utils/              # Utility functions
│       ├── amp.js          # Amp detection and config
│       └── mcp.js          # MCP server utilities
├── test/                   # Test files
├── examples/               # Example configurations
├── docs/                   # Documentation
└── package.json
```

## How to Contribute

### Adding New MCP Servers

1. **Research the server**: Make sure it's available as an npm package
2. **Add to registry**: Update `src/registry.js` with server details
3. **Test the server**: Verify it works with `npx <package-name>`
4. **Update examples**: Add example configurations if needed
5. **Update tests**: Add test cases for the new server

Example server entry:
```javascript
newserver: {
  name: 'New Server',
  description: 'Description of what it does',
  capabilities: ['capability1', 'capability2'],
  package: 'npm-package-name',
  command: 'npx',
  args: ['npm-package-name', 'arg1', 'arg2'],
  category: 'category-name',
  auth: 'none', // or 'oauth', 'api-key', 'connection-string'
  permissions: ['low'], // or 'medium', 'high'
  documentation: 'https://link-to-docs'
}
```

### Adding New Profiles

1. **Define the profile**: Think about the use case and which servers it needs
2. **Add to registry**: Update the `PROFILES` section in `src/registry.js`
3. **Create example config**: Add a JSON file in `examples/`
4. **Update documentation**: Document the new profile

Example profile entry:
```javascript
newprofile: {
  name: 'New Profile',
  description: 'What this profile is for',
  servers: ['server1', 'server2', 'server3'],
  features: [
    'Feature 1 description',
    'Feature 2 description',
    'Feature 3 description'
  ]
}
```

### Improving Documentation

- Update README.md for major changes
- Add to docs/ for detailed guides
- Include examples in code comments
- Update QUICK_START.md for user-facing changes

### Bug Fixes

1. **Reproduce the bug**: Create a test case that demonstrates the issue
2. **Fix the issue**: Make the minimal change necessary
3. **Test thoroughly**: Ensure the fix doesn't break existing functionality
4. **Update tests**: Add test cases to prevent regression

## Code Style

- Use ES modules (import/export)
- Use `const` and `let` instead of `var`
- Include JSDoc comments for functions
- Use descriptive variable names
- Follow existing code patterns

## Testing

- Run `npm test` before submitting changes
- Add tests for new features
- Update existing tests if changing functionality
- Test with actual MCP servers when possible

## Commit Guidelines

- Use clear, descriptive commit messages
- Start with a verb in present tense ("Add", "Fix", "Update")
- Reference issues when applicable
- Keep commits focused on a single change

Examples:
- `Add support for new MCP server`
- `Fix configuration file detection on Windows`
- `Update documentation for installation process`

## Pull Request Process

1. **Fork and branch**: Create a feature branch from main
2. **Make changes**: Implement your feature or fix
3. **Test**: Run tests and manual testing
4. **Document**: Update documentation as needed
5. **Submit PR**: Create a pull request with clear description

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Tests pass
- [ ] Manual testing completed
- [ ] New tests added (if applicable)

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

## Security Considerations

- Never commit API keys or credentials
- Be cautious with file system operations
- Review server permissions carefully
- Test with minimal privileges first

## Community Guidelines

- Be respectful and inclusive
- Help others learn and contribute
- Focus on constructive feedback
- Follow our Code of Conduct

## Questions?

- Check existing issues and discussions
- Ask in GitHub issues for bugs
- Use discussions for questions and ideas
- Tag maintainers for urgent issues

Thank you for contributing to AmpGI!
