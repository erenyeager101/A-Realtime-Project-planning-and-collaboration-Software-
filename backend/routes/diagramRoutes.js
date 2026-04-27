/**
 * Diagram Routes - AI-Driven Code Generation from UML/Architecture Diagrams
 *
 * POST /api/diagrams/analyze - Analyze uploaded diagram
 * POST /api/github/projects/:projectId/generate-code - Full workflow:
 *   1. Analyze diagram
 *   2. Generate code plan
 *   3. Generate code files
 *   4. Push to GitHub branch
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { auth } = require('../middleware/auth');
const { requireProjectRoles } = require('../middleware/projectAccess');
const Project = require('../models/Project');
const gh = require('../services/githubService');

// Import new services
const diagramService = require('../services/diagramAnalysisService');
const codeGenService = require('../services/codeGenerationService');
const gitBranchService = require('../services/gitBranchService');

const router = express.Router();

function inferStatusFromErrorMessage(error) {
  const message = String(error?.message || '');
  const markerMatch = message.match(/\[HTTP_(\d{3})\]/i);
  if (markerMatch) return Number(markerMatch[1]);

  const statusMatch = message.match(/Status\s+(\d{3})/i);
  if (statusMatch) return Number(statusMatch[1]);

  return null;
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'diagrams');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `diagram-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (JPEG, PNG, WebP, GIF, SVG) are allowed.'));
    }
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC: Analyze diagram (users can upload and preview analysis)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/diagrams/analyze - Analyze a diagram without pushing to GitHub
router.post(
  '/analyze',
  auth,
  upload.single('diagram'),
  async (req, res) => {
    let tempFile = null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No diagram file uploaded' });
      }

      tempFile = req.file.path;
      const diagramType = req.body.diagramType || 'auto-detect';

      // Step 1: Analyze the diagram
      const analysis = await diagramService.analyzeDiagram(tempFile, diagramType);

      // Step 2: Generate code plan
      const codePlan = await diagramService.generateCodePlan(analysis, {
        targetLanguage: req.body.targetLanguage || 'javascript',
        targetFramework: req.body.targetFramework || 'express-react-mongodb',
        includeTests: req.body.includeTests !== 'false',
        includeDocs: req.body.includeDocs !== 'false'
      });

      // Step 3: Preview what would be generated
      const fileStructure = {
        projectName: codePlan.projectName,
        totalFiles: (
          (codePlan.backend?.models?.length || 0) +
          (codePlan.backend?.controllers?.length || 0) +
          (codePlan.backend?.services?.length || 0) +
          (codePlan.frontend?.components?.length || 0) +
          (codePlan.frontend?.pages?.length || 0) +
          (codePlan.frontend?.services?.length || 0) +
          10 // config files
        ),
        backendStructure: {
          models: codePlan.backend?.models?.map(m => m.name),
          controllers: codePlan.backend?.controllers?.map(c => c.name),
          services: codePlan.backend?.services || []
        },
        frontendStructure: {
          components: codePlan.frontend?.components?.map(c => c.name),
          pages: codePlan.frontend?.pages?.map(p => p.name),
          services: codePlan.frontend?.services || []
        },
        diagramAnalysis: {
          entities: analysis.entities?.length,
          relationships: analysis.relationships?.length,
          detectedPatterns: analysis.architecture?.patterns,
          suggestedTechStack: analysis.languages
        }
      };

      res.json({
        success: true,
        analysis,
        codePlan,
        fileStructure,
        message: 'Diagram analyzed successfully. Review the structure before generating code.'
      });
    } catch (error) {
      console.error('Diagram analysis error:', error);
      const isConfigurationError = typeof error.message === 'string'
        && error.message.includes('not configured');
      const providerStatus = inferStatusFromErrorMessage(error);
      const status = isConfigurationError
        ? 503
        : providerStatus === 400
          ? 400
          : providerStatus === 401 || providerStatus === 403
            ? providerStatus
            : providerStatus && providerStatus >= 500
              ? 502
              : 500;
      res.status(status).json({
        error: String(error.message || 'Failed to analyze diagram'),
        details: isConfigurationError
          ? 'AI provider is not configured on the server. Add MISTRAL_API_KEY_CODING and restart backend.'
          : status === 400
            ? 'The selected AI model rejected the image request. Set MISTRAL_VISION_MODEL to a vision-capable model (for example: pixtral-large-latest) and retry.'
            : 'Failed to analyze diagram. Please try again with a clearer image.'
      });
    } finally {
      // Clean up temp file
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT: Full workflow - Analyze diagram + Generate code + Push to GitHub
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/github/projects/:projectId/generate-code
router.post(
  '/projects/:projectId/generate-code',
  auth,
  upload.single('diagram'),
  requireProjectRoles(['manager', 'admin'], { source: 'params', key: 'projectId' }),
  async (req, res) => {
    let tempFile = null;
    const user = req.user;

    try {
      // === Validate inputs ===
      if (!req.file) {
        return res.status(400).json({ error: 'No diagram file uploaded' });
      }

      if (!user.github?.connected || !user.github?.accessToken) {
        return res.status(403).json({
          error: 'GitHub account not connected',
          message: 'Please connect your GitHub account in the GitHub settings page'
        });
      }

      const project = await Project.findById(req.params.projectId);
      if (!project?.github?.repoFullName) {
        return res.status(400).json({
          error: 'No GitHub repository linked to this project',
          message: 'Please link a GitHub repository to this project first'
        });
      }

      // === Parse options ===
      const options = {
        diagramType: req.body.diagramType || 'auto-detect',
        targetLanguage: req.body.targetLanguage || 'javascript',
        targetFramework: req.body.targetFramework || 'express-react-mongodb',
        includeTests: req.body.includeTests !== 'false',
        includeDocs: req.body.includeDocs !== 'false',
        createPR: req.body.createPR !== 'false',
        branchName: req.body.branchName || `feature/ai-generated-${Date.now()}`,
        skipGeneration: req.body.skipGeneration === 'true' // For retry
      };

      tempFile = req.file.path;
      const [owner, repoName] = project.github.repoFullName.split('/');

      // === STEP 1: Analyze Diagram ===
      const startTime = Date.now();
      let analysis, codePlan, files;

      if (!options.skipGeneration) {
        analysis = await diagramService.analyzeDiagram(tempFile, options.diagramType);

        // === STEP 2: Generate Code Plan ===
        codePlan = await diagramService.generateCodePlan(analysis, {
          targetLanguage: options.targetLanguage,
          targetFramework: options.targetFramework,
          includeTests: options.includeTests,
          includeDocs: options.includeDocs
        });

        // === STEP 3: Generate Actual Code Files ===
        files = await codeGenService.generateCodeFiles(codePlan, analysis, {
          includeTests: options.includeTests
        });
      } else {
        // If skipping generation, we need previous analysis from request body
        try {
          analysis = JSON.parse(req.body.previousAnalysis);
          codePlan = JSON.parse(req.body.previousCodePlan);
          files = JSON.parse(req.body.previousFiles);
        } catch {
          return res.status(400).json({ error: 'Invalid or missing previous analysis data' });
        }
      }

      // === STEP 4: Push to GitHub Branch ===
      const pushResult = await gitBranchService.pushGeneratedCode(
        user.github.accessToken,
        owner,
        repoName,
        options.branchName,
        files,
        {
          createPR: options.createPR,
          projectName: codePlan.projectName || 'Generated Project'
        }
      );

      const duration = Date.now() - startTime;

      // === Update project record ===
      await Project.findByIdAndUpdate(project._id, {
        $push: {
          generatedBranches: {
            branchName: options.branchName,
            codeGenerated: true,
            prUrl: pushResult.pullRequest?.url,
            prNumber: pushResult.pullRequest?.number,
            generatedAt: new Date(),
            generatedBy: user._id,
            diagramType: analysis.diagramType,
            entities: analysis.entities?.map(e => e.name) || [],
            fileCount: files.length
          }
        }
      });

      // === Respond with results ===
      res.json({
        success: true,
        duration: `${duration}ms`,
        diagramAnalysis: {
          type: analysis.diagramType,
          entities: analysis.entities?.map(e => ({
            name: e.name,
            type: e.type,
            attributes: e.attributes?.length
          })),
          relationships: analysis.relationships?.length,
          patterns: analysis.architecture?.patterns,
          techStack: analysis.languages
        },
        generatedCode: {
          projectName: codePlan.projectName,
          filesGenerated: files.length,
          backendFiles: files.filter(f => f.path.startsWith('backend/')).length,
          frontendFiles: files.filter(f => f.path.startsWith('frontend/')).length,
          structure: {
            backend: codePlan.backend
              ? {
                  models: codePlan.backend.models?.map(m => m.name),
                  controllers: codePlan.backend.controllers?.map(c => c.name),
                  services: codePlan.backend.services
                }
              : null,
            frontend: codePlan.frontend
              ? {
                  components: codePlan.frontend.components?.map(c => c.name),
                  pages: codePlan.frontend.pages?.map(p => p.name),
                  services: codePlan.frontend.services
                }
              : null
          }
        },
        gitHubResult: {
          branch: pushResult.branch.name,
          baseBranch: pushResult.branch.baseBranch,
          filesPushed: pushResult.files.total,
          pullRequest: pushResult.pullRequest,
          webUrl: `https://github.com/${project.github.repoFullName}/tree/${options.branchName}`
        },
        nextSteps: [
          'Review the generated code in the GitHub branch',
          'Check out the Pull Request for code review',
          'Run setup.sh to install dependencies',
          'Configure backend/.env with your MongoDB URI',
          'Run npm run dev to start the application'
        ]
      });
    } catch (error) {
      console.error('Code generation workflow error:', error);

      // Provide helpful error messages based on error type
      let status = 500;
      let errorDetails = error.message;

      if (error.message?.includes('GitHub API 401')) {
        status = 401;
        errorDetails = 'GitHub authentication failed. Please reconnect your GitHub account.';
      } else if (error.message?.includes('GitHub API 403')) {
        status = 403;
        errorDetails = 'GitHub permission denied. Ensure you have write access to the repository.';
      } else if (error.message?.includes('GitHub API 404')) {
        status = 404;
        errorDetails = 'Repository not found. Please check the GitHub link.';
      } else {
        const providerStatus = inferStatusFromErrorMessage(error);
        if (providerStatus === 400) {
          status = 400;
          errorDetails = 'AI provider rejected the diagram request. Configure MISTRAL_VISION_MODEL with a vision-capable model and retry.';
        } else if (providerStatus === 401 || providerStatus === 403) {
          status = providerStatus;
          errorDetails = 'AI provider authentication/permission issue. Verify Mistral API key and model access.';
        } else if (providerStatus && providerStatus >= 500) {
          status = 502;
          errorDetails = 'AI provider is temporarily unavailable. Please retry shortly.';
        }
      }

      res.status(status).json({
        error: 'Code generation failed',
        details: errorDetails,
        suggestion: 'You may retry the request with skipGeneration=true if you have previous analysis data'
      });
    } finally {
      // Clean up temp file
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY: Check if a repository can accept pushes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/generate-status
router.get(
  '/github/projects/:projectId/generate-status',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user.github?.connected) {
        return res.json({
          canGenerate: false,
          reason: 'GitHub not connected',
          action: 'Connect your GitHub account to enable code generation'
        });
      }

      const project = await Project.findById(req.params.projectId);
      if (!project?.github?.repoFullName) {
        return res.json({
          canGenerate: false,
          reason: 'No repository linked',
          action: 'Link a GitHub repository to this project'
        });
      }

      // Verify repo access
      const [owner, repoName] = project.github.repoFullName.split('/');
      try {
        await gh.getRepo(user.github.accessToken, owner, repoName);
      } catch (error) {
        return res.json({
          canGenerate: false,
          reason: 'Cannot access repository',
          action: 'Ensure you have permission to access this repository',
          error: error.message
        });
      }

      // Get previous generations
      const previousGenerations = project.generatedBranches?.slice(-5) || [];

      res.json({
        canGenerate: true,
        repository: project.github.repoFullName,
        repositoryUrl: project.github.repoUrl,
        previousGenerations: previousGenerations.map(g => ({
          branch: g.branchName,
          prUrl: g.prUrl,
          generatedAt: g.generatedAt,
          entityCount: g.entities?.length
        }))
      });
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR HANDLING: Clean up files on upload errors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.use((error, req, res, next) => {
  // Clean up uploaded file if there's an error
  if (req.file && req.file.path && fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  next();
});

module.exports = router;
