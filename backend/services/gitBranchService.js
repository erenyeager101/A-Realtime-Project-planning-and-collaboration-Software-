/**
 * GitHub Branch Service
 * Handles creation of GitHub branches and pushing generated code
 */

const crypto = require('crypto');

const GITHUB_API = 'https://api.github.com';

/**
 * Helper: Authenticated GitHub fetch
 */
async function ghFetch(endpoint, token, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': options['_contentType'] || 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`GitHub API ${res.status}: ${body}`);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

/**
 * Get the default branch SHAs for creating new branches
 */
async function getDefaultBranchSha(token, owner, repo) {
  // First, get the default branch name
  const repoData = await ghFetch(`/repos/${owner}/${repo}`, token);
  const defaultBranch = repoData.default_branch;

  // Then get the SHA of the latest commit on default branch
  const refData = await ghFetch(
    `/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
    token
  );

  return {
    sha: refData.object.sha,
    branch: defaultBranch
  };
}

/**
 * Create a new branch from the default branch
 */
async function createBranch(token, owner, repo, branchName) {
  const { sha, branch: baseBranch } = await getDefaultBranchSha(token, owner, repo);

  try {
    // Create the new branch (ref)
    const result = await ghFetch(`/repos/${owner}/${repo}/git/refs`, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: sha
      })
    });

    return {
      branchName,
      baseBranch,
      sha: result.object.sha,
      created: true
    };
  } catch (error) {
    // Branch might already exist
    if (error.status === 422 && error.message.includes('already exists')) {
      // Get existing branch SHA
      const existing = await ghFetch(
        `/repos/${owner}/${repo}/git/ref/heads/${branchName}`,
        token
      );
      return {
        branchName,
        baseBranch,
        sha: existing.object.sha,
        created: false,
        message: 'Branch already exists, using existing'
      };
    }
    throw error;
  }
}

/**
 * Create or update a file on a branch
 */
async function pushFile(token, owner, repo, branch, path, content, message) {
  // First, get the current file (if exists) to get its SHA for update
  let currentSha = null;
  try {
    const fileData = await ghFetch(
      `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      token
    );
    currentSha = fileData.sha;
  } catch {
    // File doesn't exist, which is fine for new files
  }

  // Create/update the file
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch
  };

  if (currentSha) {
    body.sha = currentSha;
  }

  return ghFetch(`/repos/${owner}/${repo}/contents/${path}`, token, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

/**
 * Push multiple files to a branch in a single commit using the Git Trees API
 * More efficient than pushing files individually
 */
async function pushFilesBatch(token, owner, repo, branch, files, commitMessage) {
  try {
    // 1. Get the current branch reference
    const branchRef = await ghFetch(
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      token
    );
    const baseTreeSha = branchRef.object.sha;

    // 2. Create a new tree with all the files
    const treeItems = files.map(file => ({
      path: file.path,
      mode: '100644', // Regular file
      type: 'blob',
      content: file.content
    }));

    const newTree = await ghFetch(`/repos/${owner}/${repo}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });

    // 3. Create a commit with the new tree
    const commit = await ghFetch(`/repos/${owner}/${repo}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage,
        tree: newTree.sha,
        parents: [baseTreeSha]
      })
    });

    // 4. Update the branch reference to point to the new commit
    await ghFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        sha: commit.sha,
        force: false
      })
    });

    return {
      branch,
      commitSha: commit.sha,
      filesPushed: files.length,
      treeSha: newTree.sha
    };
  } catch (error) {
    console.error('Batch push failed:', error);
    // Fall back to individual file pushes
    return pushFilesIndividually(token, owner, repo, branch, files, commitMessage);
  }
}

/**
 * Fallback: Push files one by one
 */
async function pushFilesIndividually(token, owner, repo, branch, files, commitMessage) {
  const results = [];
  const errors = [];

  for (const file of files) {
    try {
      const result = await pushFile(
        token,
        owner,
        repo,
        branch,
        file.path,
        file.content,
        commitMessage
      );
      results.push({ path: file.path, status: 'success' });
    } catch (error) {
      console.error(`Failed to push ${file.path}:`, error.message);
      errors.push({ path: file.path, error: error.message });
    }
  }

  return {
    branch,
    filesPushed: results.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Create a Pull Request for the generated branch
 */
async function createPullRequest(token, owner, repo, branch, baseBranch, title, body) {
  return ghFetch(`/repos/${owner}/${repo}/pulls`, token, {
    method: 'POST',
    body: JSON.stringify({
      title,
      body,
      head: branch,
      base: baseBranch
    })
  });
}

/**
 * Generate installation/setup scripts for the generated code
 */
function generateSetupScripts(projectName) {
  const safeName = projectName.toLowerCase().replace(/\s+/g, '-');

  return [
    {
      path: 'setup.sh',
      content: `#!/bin/bash
# Setup script for ${projectName}
# Generated from UML diagrams

set -e

echo "Setting up ${projectName}..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }

echo "Installing root dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend
npm install
cd ..

echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy backend/.env.example to backend/.env and configure"
echo "2. Start MongoDB locally or update MONGO_URI in .env"
echo "3. Run 'npm run dev' to start development servers"
`,
      message: 'Add setup script for easy project initialization'
    },
    {
      path: 'setup.bat',
      content: `@echo off
REM Setup script for ${projectName}
REM Generated from UML diagrams

echo Setting up ${projectName}...

REM Check prerequisites
node --version >nul 2>&1 || (
  echo Node.js is required but not installed. Aborting.
  exit /b 1
)

echo Installing root dependencies...
call npm install

echo Installing backend dependencies...
cd backend
call npm install
cd ..

echo Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Copy backend/.env.example to backend/.env and configure
echo 2. Start MongoDB locally or update MONGO_URI in .env
echo 3. Run 'npm run dev' to start development servers
pause
`,
      message: 'Add Windows setup script'
    },
    {
      path: 'Makefile',
      content: `# Makefile for ${projectName}
# Generated from UML diagrams

.PHONY: install dev build test clean

# Install all dependencies
install:
\tcd backend && npm install
\tcd ../frontend && npm install

# Start development servers
dev:
\tnpm run dev

# Build frontend
build:
\tcd frontend && npm run build

# Run tests
test:
\tcd backend && npm test
\tcd ../frontend && npm test

# Clean build artifacts
clean:
\trm -rf frontend/dist
\trm -rf backend/node_modules
\trm -rf frontend/node_modules
`,
      message: 'Add Makefile for convenience'
    }
  ];
}

/**
 * Validate that a generated file structure is valid
 */
function validateGeneratedFiles(files) {
  const required = ['backend/package.json', 'frontend/package.json', 'README.md'];
  const present = new Set(files.map(f => f.path));

  const missing = required.filter(r => !present.has(r));

  return {
    valid: missing.length === 0,
    missing,
    fileCount: files.length
  };
}

/**
 * Main function: Push generated code to GitHub branch
 */
async function pushGeneratedCode(token, owner, repo, branchName, files, options = {}) {
  const {
    createPR = true,
    projectName = 'Generated Project'
  } = options;

  // 1. Create the branch
  const branch = await createBranch(token, owner, repo, branchName);

  // 2. Add setup scripts
  const setupScripts = generateSetupScripts(projectName);
  const filesWithScripts = [...files, ...setupScripts];

  // 3. Validate structure
  const validation = validateGeneratedFiles(filesWithScripts);
  if (!validation.valid) {
    console.warn('Missing recommended files:', validation.missing);
  }

  // 4. Push files in batch
  const pushResult = await pushFilesBatch(
    token,
    owner,
    repo,
    branchName,
    filesWithScripts,
    `feat: Add ${projectName} - Generated from UML diagrams\n\nThis commit includes:\n- Backend API with Express and Mongoose\n- Frontend with React and Tailwind CSS\n- Configuration files\n- Documentation\n\nGenerated by EnterprisePM AI Code Generator`
  );

  // 5. Get base branch for PR
  const { branch: baseBranch } = await getDefaultBranchSha(token, owner, repo);

  // 6. Create Pull Request if requested
  let prResult = null;
  if (createPR) {
    try {
      prResult = await createPullRequest(
        token,
        owner,
        repo,
        branchName,
        baseBranch,
        `Generated: ${projectName}`,
        `This PR contains code generated from UML/architecture diagrams.

## Generated Files
- ${filesWithScripts.length} files total
- Backend models, controllers, and services
- Frontend components and pages
- Configuration and documentation

## How to Review
1. Check out this branch
2. Run \`bash setup.sh\` (Linux/Mac) or \`setup.bat\` (Windows)
3. Configure \`backend/.env\` with your MongoDB URI
4. Run \`npm run dev\` to test the application

## Notes
This is auto-generated code. You may want to:
- Add authentication
- Customize business logic
- Write tests
- Update styling`
      );
    } catch (prError) {
      console.warn('Failed to create PR (non-critical):', prError.message);
    }
  }

  return {
    success: true,
    branch: {
      name: branchName,
      baseBranch,
      sha: branch.sha,
      isNew: branch.created
    },
    files: {
      total: filesWithScripts.length,
      pushed: pushResult.filesPushed,
      errors: pushResult.errors || []
    },
    pullRequest: prResult ? {
      number: prResult.number,
      url: prResult.html_url,
      title: prResult.title
    } : null,
    validation
  };
}

module.exports = {
  // Branch operations
  createBranch,
  getDefaultBranchSha,

  // File operations
  pushFile,
  pushFilesBatch,
  pushFilesIndividually,

  // PR operations
  createPullRequest,

  // Code generation helpers
  generateSetupScripts,
  validateGeneratedFiles,

  // Main workflow
  pushGeneratedCode
};
