/**
 * Community Command
 * 
 * Manage community MCP servers - install from GitHub repositories,
 * validate community servers, and handle non-official packages.
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import { testServerCompatibility, TEST_LEVELS } from '../utils/compatibility.js';
import { addDynamicServer, saveDynamicRegistry } from '../registry.js';

const execAsync = promisify(exec);

/**
 * Install community server from GitHub repository
 */
export async function installCommunityServer(repoUrl, options = {}) {
  const { test = true, validate = true, force = false } = options;
  
  console.log(chalk.blue(`📦 Installing Community MCP Server\n`));
  console.log(chalk.gray(`Repository: ${repoUrl}\n`));

  try {
    // Parse and validate repository URL
    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      throw new Error('Invalid GitHub repository URL');
    }

    console.log(chalk.blue(`Repository: ${repoInfo.owner}/${repoInfo.repo}`));

    // Validate repository exists and get info
    const spinner = ora('Validating repository...').start();
    const repoData = await validateRepository(repoInfo);
    spinner.succeed('Repository validated');

    console.log(chalk.green(`✓ Repository found: ${repoData.description || 'No description'}`));
    console.log(chalk.gray(`  Stars: ${repoData.stargazers_count} | Forks: ${repoData.forks_count}`));
    console.log(chalk.gray(`  Last updated: ${new Date(repoData.updated_at).toLocaleDateString()}`));
    console.log();

    // Get package.json to understand installation method
    const packageInfo = await getPackageInfo(repoInfo);
    let installMethod = 'clone'; // Default to git clone

    if (packageInfo) {
      console.log(chalk.blue(`Package: ${packageInfo.name} v${packageInfo.version}`));
      if (packageInfo.bin || packageInfo.scripts?.start) {
        installMethod = 'npm';
      }
    }

    // Security validation
    if (validate && !force) {
      console.log(chalk.blue('🔒 Performing security validation...\n'));
      const securityResult = await performSecurityValidation(repoInfo, packageInfo);
      
      if (!securityResult.safe) {
        console.log(chalk.red('⚠️  Security concerns detected:'));
        securityResult.issues.forEach(issue => {
          console.log(chalk.red(`  • ${issue}`));
        });
        
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to proceed with installation despite security concerns?',
            default: false
          }
        ]);
        
        if (!proceed) {
          console.log(chalk.yellow('Installation cancelled for security reasons.'));
          return;
        }
      } else {
        console.log(chalk.green('✓ Security validation passed\n'));
      }
    }

    // Show installation plan
    console.log(chalk.blue('📋 Installation Plan:'));
    console.log(`  Method: ${installMethod === 'npm' ? 'NPM Package' : 'Git Clone'}`);
    if (installMethod === 'npm' && packageInfo) {
      console.log(`  Package: ${packageInfo.name}`);
      console.log(`  Command: npx ${packageInfo.name}`);
    } else {
      console.log(`  Repository: ${repoUrl}`);
      console.log(`  Local path: ./community-servers/${repoInfo.repo}`);
    }
    console.log();

    // Confirm installation
    const { confirmInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmInstall',
        message: 'Proceed with installation?',
        default: true
      }
    ]);

    if (!confirmInstall) {
      console.log(chalk.yellow('Installation cancelled.'));
      return;
    }

    // Perform installation
    const serverConfig = await performInstallation(repoInfo, packageInfo, installMethod);

    // Test compatibility if requested
    if (test) {
      console.log(chalk.blue('\n🧪 Testing server compatibility...\n'));
      const testResult = await testServerCompatibility(serverConfig, {
        level: TEST_LEVELS.BASIC,
        includeSecurity: true
      });

      if (testResult.passed) {
        console.log(chalk.green(`✓ Compatibility test passed (${testResult.score}/${testResult.maxScore})`));
      } else {
        console.log(chalk.yellow(`⚠️  Compatibility issues detected (${testResult.score}/${testResult.maxScore})`));
        console.log(chalk.gray('Server may not work correctly with current Amp version'));
      }
    }

    // Add to dynamic registry
    const serverId = `community_${repoInfo.owner}_${repoInfo.repo}`.replace(/[^a-zA-Z0-9_]/g, '_');
    addDynamicServer(serverId, {
      ...serverConfig,
      isCommunity: true,
      repository: repoUrl,
      installMethod,
      installedAt: new Date().toISOString()
    });

    // Save registry
    await saveDynamicRegistry();

    console.log(chalk.green(`\n✅ Community server installed successfully!`));
    console.log(chalk.blue(`Server ID: ${serverId}`));
    console.log(chalk.gray(`Use 'ampgi install -s ${serverId}' to add it to your Amp configuration`));

  } catch (error) {
    console.error(chalk.red(`Installation failed: ${error.message}`));
    throw error;
  }
}

/**
 * List installed community servers
 */
export async function listCommunityServers() {
  console.log(chalk.blue('👥 Community MCP Servers\n'));

  const { getAllServers } = await import('../registry.js');
  const allServers = getAllServers();
  
  const communityServers = Object.entries(allServers)
    .filter(([_, config]) => config.isCommunity)
    .map(([id, config]) => ({ id, ...config }));

  if (communityServers.length === 0) {
    console.log(chalk.yellow('No community servers installed.'));
    console.log(chalk.gray('Use "ampgi community install <github-url>" to install community servers.'));
    return;
  }

  communityServers.forEach(server => {
    console.log(`${chalk.bold(server.name)} ${chalk.gray(`(${server.id})`)}`);
    console.log(`  ${server.description}`);
    console.log(`  ${chalk.gray('Repository:')} ${server.repository}`);
    console.log(`  ${chalk.gray('Method:')} ${server.installMethod}`);
    console.log(`  ${chalk.gray('Installed:')} ${new Date(server.installedAt).toLocaleDateString()}`);
    console.log();
  });
}

/**
 * Remove community server
 */
export async function removeCommunityServer(serverId, options = {}) {
  const { force = false } = options;

  const { getAllServers, removeDynamicServer, saveDynamicRegistry } = await import('../registry.js');
  const allServers = getAllServers();
  const server = allServers[serverId];

  if (!server) {
    throw new Error(`Server not found: ${serverId}`);
  }

  if (!server.isCommunity) {
    throw new Error(`Server ${serverId} is not a community server`);
  }

  console.log(chalk.blue(`🗑️  Removing Community Server: ${server.name}\n`));

  if (!force) {
    const { confirmRemove } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRemove',
        message: `Are you sure you want to remove ${server.name}?`,
        default: false
      }
    ]);

    if (!confirmRemove) {
      console.log(chalk.yellow('Removal cancelled.'));
      return;
    }
  }

  // Remove from dynamic registry
  removeDynamicServer(serverId);
  await saveDynamicRegistry();

  // TODO: Remove installed files if they exist
  // This would depend on the installation method

  console.log(chalk.green(`✅ Community server ${server.name} removed successfully.`));
}

/**
 * Parse GitHub URL to extract owner and repo
 */
function parseGitHubUrl(url) {
  const patterns = [
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
    /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
    /^([^\/]+)\/([^\/]+)$/ // owner/repo format
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        url: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, '')}`
      };
    }
  }

  return null;
}

/**
 * Validate repository exists and get information
 */
async function validateRepository(repoInfo) {
  const response = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`, {
    headers: {
      'User-Agent': 'AmpGI-Community/1.0.0',
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository not found: ${repoInfo.owner}/${repoInfo.repo}`);
    }
    throw new Error(`Failed to access repository: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get package.json information from repository
 */
async function getPackageInfo(repoInfo) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/package.json`,
      {
        headers: {
          'User-Agent': 'AmpGI-Community/1.0.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString();
      return JSON.parse(content);
    }
  } catch (error) {
    // Package.json not found or invalid
  }

  return null;
}

/**
 * Perform security validation on community server
 */
async function performSecurityValidation(repoInfo, packageInfo) {
  const issues = [];
  let safe = true;

  // Check repository age and activity
  try {
    const repoData = await validateRepository(repoInfo);
    const created = new Date(repoData.created_at);
    const updated = new Date(repoData.updated_at);
    const daysSinceCreated = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceUpdated = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreated < 30) {
      issues.push('Repository is very new (less than 30 days old)');
      safe = false;
    }

    if (daysSinceUpdated > 365) {
      issues.push('Repository has not been updated in over a year');
    }

    if (repoData.stargazers_count < 5) {
      issues.push('Repository has very few stars (low community trust)');
    }
  } catch (error) {
    issues.push(`Failed to validate repository: ${error.message}`);
    safe = false;
  }

  // Check package.json for suspicious patterns
  if (packageInfo) {
    // Check for preinstall/postinstall scripts
    if (packageInfo.scripts?.preinstall || packageInfo.scripts?.postinstall) {
      issues.push('Package has preinstall/postinstall scripts (potential security risk)');
      safe = false;
    }

    // Check dependencies for known malicious packages
    const suspiciousDeps = ['eval', 'vm2', 'serialize-javascript'];
    const deps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };
    
    for (const dep of suspiciousDeps) {
      if (deps[dep]) {
        issues.push(`Package uses potentially dangerous dependency: ${dep}`);
      }
    }
  }

  return { safe, issues };
}

/**
 * Perform the actual installation
 */
async function performInstallation(repoInfo, packageInfo, installMethod) {
  const spinner = ora('Installing server...').start();

  try {
    let serverConfig = {
      name: packageInfo?.name || repoInfo.repo,
      description: packageInfo?.description || `Community server from ${repoInfo.owner}/${repoInfo.repo}`,
      category: 'community',
      capabilities: ['community:server'],
      auth: 'none',
      permissions: ['medium'],
      verified: false,
      official: false
    };

    if (installMethod === 'npm' && packageInfo) {
      // Install as NPM package
      spinner.text = 'Installing NPM package...';
      
      // Check if package exists on npm
      try {
        const npmResponse = await fetch(`https://registry.npmjs.org/${packageInfo.name}`);
        if (npmResponse.ok) {
          serverConfig = {
            ...serverConfig,
            package: packageInfo.name,
            command: 'npx',
            args: ['-y', packageInfo.name]
          };
        } else {
          throw new Error('Package not found on npm');
        }
      } catch (error) {
        // Fallback to git clone
        installMethod = 'clone';
      }
    }

    if (installMethod === 'clone') {
      // Clone repository
      spinner.text = 'Cloning repository...';
      
      const communityDir = path.join(process.cwd(), 'community-servers');
      await fs.ensureDir(communityDir);
      
      const localPath = path.join(communityDir, repoInfo.repo);
      
      // Remove existing directory if it exists
      if (await fs.pathExists(localPath)) {
        await fs.remove(localPath);
      }

      // Clone repository
      await execAsync(`git clone ${repoInfo.url} ${localPath}`);
      
      // Check if it has package.json and install dependencies
      const packageJsonPath = path.join(localPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        spinner.text = 'Installing dependencies...';
        await execAsync('npm install', { cwd: localPath });
        
        // Try to determine start command
        const pkg = await fs.readJson(packageJsonPath);
        if (pkg.bin) {
          const binName = Object.keys(pkg.bin)[0];
          serverConfig.command = 'node';
          serverConfig.args = [path.join(localPath, pkg.bin[binName])];
        } else if (pkg.scripts?.start) {
          serverConfig.command = 'npm';
          serverConfig.args = ['start'];
          serverConfig.cwd = localPath;
        } else {
          serverConfig.command = 'node';
          serverConfig.args = [path.join(localPath, 'index.js')];
        }
      }
      
      serverConfig.localPath = localPath;
    }

    spinner.succeed('Server installed');
    return serverConfig;

  } catch (error) {
    spinner.fail('Installation failed');
    throw error;
  }
}

/**
 * Validate community server before adding to registry
 */
export async function validateCommunityServer(serverInfo) {
  const validationResult = {
    valid: true,
    issues: [],
    warnings: [],
    score: 100
  };

  // Check required fields
  if (!serverInfo.name) {
    validationResult.issues.push('Server name is required');
    validationResult.valid = false;
    validationResult.score -= 20;
  }

  if (!serverInfo.description) {
    validationResult.warnings.push('Server description is missing');
    validationResult.score -= 5;
  }

  // Check if it's a valid MCP server (has proper capabilities or structure)
  if (!serverInfo.capabilities || serverInfo.capabilities.length === 0) {
    validationResult.warnings.push('No capabilities defined');
    validationResult.score -= 10;
  }

  // Check installation method
  if (!serverInfo.command && !serverInfo.package) {
    validationResult.issues.push('No valid installation method found');
    validationResult.valid = false;
    validationResult.score -= 30;
  }

  // Security checks
  if (!serverInfo.official) {
    validationResult.warnings.push('Community server - manual review recommended');
    validationResult.score -= 5;
  }

  return validationResult;
}
