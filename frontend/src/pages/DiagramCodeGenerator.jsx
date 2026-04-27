import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Navbar from '../components/Navbar';
import { getProjects } from '../services/projectService';
import {
  analyzeDiagram,
  generateCodeFromDiagram,
  getCodeGenerationStatus
} from '../services/diagramService';

// File size formatter
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Generate default branch name
const generateBranchName = () => `feature/ai-generated-${Date.now().toString(36)}`;

export default function DiagramCodeGenerator() {
  const { id: routeProjectId, projectId: legacyProjectId } = useParams();
  const paramProjectId = routeProjectId || legacyProjectId || null;
  const [selectedProjectId, setSelectedProjectId] = useState(paramProjectId || '');
  const activeProjectId = paramProjectId || selectedProjectId || null;
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  // Status check
  const [canGenerate, setCanGenerate] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Options
  const [options, setOptions] = useState({
    diagramType: 'auto-detect',
    targetLanguage: 'javascript',
    targetFramework: 'express-react-mongodb',
    includeTests: true,
    includeDocs: true,
    createPR: true,
    branchName: ''
  });

  // Check generation status on mount
  useEffect(() => {
    if (!activeProjectId) {
      setCanGenerate({
        canGenerate: false,
        reason: 'No project selected',
        action: 'Choose a project below (or open this page from a project) to enable GitHub code generation.'
      });
      setIsCheckingStatus(false);
      return;
    }

    checkStatus(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const res = await getProjects();
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    if (paramProjectId) {
      setSelectedProjectId(paramProjectId);
    }
  }, [paramProjectId]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const checkStatus = async (activeProjectId) => {
    if (!activeProjectId) return;

    setIsCheckingStatus(true);
    try {
      const response = await getCodeGenerationStatus(activeProjectId);
      setCanGenerate(response.data);
    } catch (err) {
      console.error('Failed to check status:', err);
      setCanGenerate({ canGenerate: false, reason: 'Failed to check status' });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Dropzone setup
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      // Cleanup previous preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysisResult(null);
      setGenerationResult(null);
      setAnalysisError(null);
      setGenerationError(null);
    }
  }, [previewUrl]);

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1
  });

  // Analyze diagram without generating
  const handleAnalyze = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await analyzeDiagram(uploadedFile, options);
      setAnalysisResult(response.data);
    } catch (err) {
      setAnalysisError(err.response?.data?.error || err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate code and push to GitHub
  const handleGenerate = async () => {
    if (!uploadedFile) return;
    if (!activeProjectId) {
      setGenerationError('Project ID is required. Select a project before generating code.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await generateCodeFromDiagram(activeProjectId, uploadedFile, {
        ...options,
        branchName: options.branchName || generateBranchName()
      });
      setGenerationResult(response.data);
    } catch (err) {
      setGenerationError(err.response?.data?.error || err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle option changes
  const handleOptionChange = (key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  // Reset everything
  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setGenerationResult(null);
    setAnalysisError(null);
    setGenerationError(null);
    setOptions(prev => ({ ...prev, branchName: '' }));
  };

  const fileRejectionErrors = fileRejections.map(({ file, errors }) =>
    errors.map(e => `${file.name}: ${e.message}`).join(', ')
  );

  return (
    <div className="diagram-codegen-page min-h-screen bg-slate-950">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 mb-3 text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full">
            <span>✨</span>
            Diagram to GitHub Workflow
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            AI Code Generator from Diagrams
          </h1>
          <p className="text-gray-400 max-w-2xl">
            Upload UML, architecture, or ER diagrams to generate template code and push to GitHub
          </p>
        </div>

        {/* Status Check Loading */}
        {isCheckingStatus && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 text-gray-300">
              <LoadingSpinner />
              <span>Checking project configuration...</span>
            </div>
          </div>
        )}

        {/* Project Selection */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Project</h2>
          <p className="text-sm text-gray-400 mb-3">
            Choose the project where generated code should be pushed.
          </p>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={Boolean(paramProjectId) || isLoadingProjects}
            className="w-full border border-white/10 bg-white/5 text-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none disabled:bg-white/[0.03] disabled:text-gray-500"
          >
            <option value="">{isLoadingProjects ? 'Loading projects...' : 'Select a project'}</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
          {paramProjectId && (
            <p className="text-xs text-gray-500 mt-2">
              Project is locked by URL context.
            </p>
          )}
        </div>

        {!isCheckingStatus && canGenerate && !canGenerate.canGenerate && (
          <div className="bg-amber-500/10 border border-amber-400/25 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-amber-300">Code Generation Not Available</h3>
                <p className="text-amber-200/90 text-sm mt-1">{canGenerate.reason}</p>
                {canGenerate.action && (
                  <p className="text-amber-200/80 text-sm mt-2">{canGenerate.action}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">1. Upload Diagram</h2>
            {uploadedFile && (
              <button
                onClick={handleReset}
                className="text-sm text-rose-300 hover:text-rose-200 font-medium"
              >
                Remove & Reset
              </button>
            )}
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-indigo-400 bg-indigo-500/10'
                : isDragReject
                ? 'border-rose-400 bg-rose-500/10'
                : uploadedFile
                ? 'border-emerald-400 bg-emerald-500/5'
                : 'border-white/15 bg-white/[0.02] hover:border-indigo-400/60'
            }`}
          >
            <input {...getInputProps()} />

            {previewUrl ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Diagram preview"
                    className="max-h-64 mx-auto rounded-lg shadow-sm"
                  />
                  <div className="absolute top-2 right-2">
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      ✓ Ready
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-100">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-400">{formatFileSize(uploadedFile.size)}</p>
                </div>
                <p className="text-sm text-indigo-300">
                  Click or drag to replace
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-gray-300">
                  {isDragActive
                    ? 'Drop the diagram here...'
                    : 'Drag & drop a diagram image here, or click to select'}
                </p>
                <p className="text-sm text-gray-500">
                  Supports PNG, JPG, GIF, WebP, SVG (max 10MB)
                </p>
              </div>
            )}
          </div>

          {/* File Rejection Errors */}
          {fileRejectionErrors.length > 0 && (
            <div className="mt-4 p-4 bg-rose-500/10 border border-rose-400/25 rounded-xl">
              <p className="text-sm font-semibold text-rose-300 mb-1">Upload rejected:</p>
              {fileRejectionErrors.map((error, i) => (
                <p key={i} className="text-sm text-rose-200">{error}</p>
              ))}
            </div>
          )}
        </div>

        {/* Options Section */}
        {uploadedFile && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">2. Configure Options</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Diagram Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Diagram Type
                </label>
                <select
                  value={options.diagramType}
                  onChange={(e) => handleOptionChange('diagramType', e.target.value)}
                  className="w-full border border-white/10 bg-white/5 text-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="auto-detect">Auto-detect</option>
                  <option value="uml-class">UML Class Diagram</option>
                  <option value="uml-sequence">UML Sequence Diagram</option>
                  <option value="er">Entity-Relationship Diagram</option>
                  <option value="architecture">Architecture Diagram</option>
                  <option value="component">Component Diagram</option>
                </select>
              </div>

              {/* Target Language */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Target Language
                </label>
                <select
                  value={options.targetLanguage}
                  onChange={(e) => handleOptionChange('targetLanguage', e.target.value)}
                  className="w-full border border-white/10 bg-white/5 text-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                </select>
              </div>

              {/* Target Framework */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Target Framework
                </label>
                <select
                  value={options.targetFramework}
                  onChange={(e) => handleOptionChange('targetFramework', e.target.value)}
                  className="w-full border border-white/10 bg-white/5 text-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="express-react-mongodb">Express + React + MongoDB</option>
                  <option value="express-angular-mongodb">Express + Angular + MongoDB</option>
                  <option value="nestjs-react-postgres">NestJS + React + PostgreSQL</option>
                </select>
              </div>

              {/* Branch Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Branch Name
                  <span className="text-xs text-gray-500 ml-1">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={options.branchName}
                    onChange={(e) => handleOptionChange('branchName', e.target.value)}
                    placeholder="feature/ai-generated-..."
                    className="flex-1 border border-white/10 bg-white/5 text-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleOptionChange('branchName', generateBranchName())}
                    className="px-3 py-2 text-sm bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-4">
              <Toggle
                id="includeTests"
                checked={options.includeTests}
                onChange={(checked) => handleOptionChange('includeTests', checked)}
                label="Include tests"
              />
              <Toggle
                id="includeDocs"
                checked={options.includeDocs}
                onChange={(checked) => handleOptionChange('includeDocs', checked)}
                label="Include documentation"
              />
              <Toggle
                id="createPR"
                checked={options.createPR}
                onChange={(checked) => handleOptionChange('createPR', checked)}
                label="Create Pull Request"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || isGenerating}
                className="px-6 py-2.5 bg-white/5 border border-white/10 text-gray-200 rounded-xl hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    Analyzing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🔍 Analyze Diagram
                  </span>
                )}
              </button>

              <button
                onClick={handleGenerate}
                disabled={isAnalyzing || isGenerating || !canGenerate?.canGenerate}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    Generating & Pushing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🚀 Generate Code & Push
                  </span>
                )}
              </button>
            </div>

            {/* Errors */}
            <ErrorMessage
              error={analysisError}
              title="Analysis Error"
            />
            <ErrorMessage
              error={generationError}
              title="Generation Error"
              suggestion={generationError?.includes('GitHub') ? 'Make sure your GitHub account is connected and you have a repository linked to this project.' : null}
            />
          </div>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Analysis Results</h2>
              <span className="text-sm text-emerald-300 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Analysis Complete
              </span>
            </div>

            <AnalysisStats
              diagramType={analysisResult.analysis?.diagramType}
              entities={analysisResult.analysis?.entities}
              relationships={analysisResult.analysis?.relationships}
              totalFiles={analysisResult.fileStructure?.totalFiles}
            />

            {/* Detected Entities Detail */}
            {analysisResult.analysis?.entities?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <span>🔷</span> Detected Entities
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {analysisResult.analysis.entities.map((entity) => (
                    <EntityCard
                      key={entity.name}
                      name={entity.name}
                      type={entity.type}
                      description={entity.description}
                      attributes={entity.attributes?.length}
                      methods={entity.methods?.length}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Detected Patterns */}
            {analysisResult.analysis?.architecture?.patterns?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <span>🎨</span> Detected Patterns
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.analysis.architecture.patterns.map((pattern) => (
                    <Badge key={pattern} color="green">{pattern}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tech Stack Preview */}
            {analysisResult.analysis?.languages?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <span>🛠️</span> Detected Languages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.analysis.languages.map((lang) => (
                    <Badge key={lang} color="blue">{lang}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Generation Hint */}
            <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-400/20 rounded-xl">
              <p className="text-sm text-indigo-200">
                <strong>👍 Looking good?</strong> Click "Generate Code & Push" above to create the full codebase and push it to GitHub.
              </p>
            </div>
          </div>
        )}

        {/* Generation Results */}
        {generationResult && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-400/25 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">✅</span>
              <h2 className="text-lg font-semibold text-emerald-200">
                Code Generated Successfully!
              </h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ResultCard
                  label="Branch Created"
                  value={generationResult.gitHubResult?.branch?.name}
                  icon="🌿"
                />
                <ResultCard
                  label="Files Pushed"
                  value={generationResult.generatedCode?.filesGenerated}
                  icon="📄"
                />
                <ResultCard
                  label="Duration"
                  value={generationResult.duration}
                  icon="⏱️"
                />
              </div>

              {/* Detailed Summary */}
              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
                <h3 className="font-medium text-white mb-2">Generated Project: {generationResult.generatedCode?.projectName}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Backend Files:</span>
                    <span className="ml-2 font-medium text-gray-100">{generationResult.generatedCode?.backendFiles}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Frontend Files:</span>
                    <span className="ml-2 font-medium text-gray-100">{generationResult.generatedCode?.frontendFiles}</span>
                  </div>
                </div>
              </div>

              {generationResult.gitHubResult?.pullRequest && (
                <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
                  <p className="text-sm text-gray-300 mb-2">Pull Request Created:</p>
                  <a
                    href={generationResult.gitHubResult.pullRequest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-300 hover:text-indigo-200 hover:underline font-medium flex items-center gap-2"
                  >
                    <span>🔀</span>
                    #{generationResult.gitHubResult.pullRequest.number}: {generationResult.gitHubResult.pullRequest.title}
                  </a>
                </div>
              )}

              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
                <p className="text-sm text-gray-300 mb-2">View on GitHub:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generationResult.gitHubResult?.webUrl}
                    className="flex-1 text-sm bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-gray-100"
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generationResult.gitHubResult?.webUrl);
                      // Could add toast notification here
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 text-gray-200 rounded-xl hover:bg-white/10 transition-colors text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-xl p-4">
                <h3 className="font-medium text-indigo-200 mb-2 flex items-center gap-2">
                  <span>📋</span> Next Steps:
                </h3>
                <ol className="text-sm text-indigo-100/90 space-y-2 list-decimal list-inside">
                  {generationResult.nextSteps?.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap gap-3 pt-4">
                <a
                  href={generationResult.gitHubResult?.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors flex items-center gap-2"
                >
                  <span>🔗</span> View Branch on GitHub
                </a>
                {generationResult.gitHubResult?.pullRequest?.url && (
                  <a
                    href={generationResult.gitHubResult.pullRequest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-colors flex items-center gap-2"
                  >
                    <span>🔀</span> View Pull Request
                  </a>
                )}
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-gray-200 rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <span>🔄</span> Generate Another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== UI Components ====================

// Loading Spinner
function LoadingSpinner({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={`animate-spin text-current ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Toggle Switch
function Toggle({ id, checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-white/15 peer-focus:ring-2 peer-focus:ring-indigo-400/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
      </div>
      <span className="text-sm text-gray-300 group-hover:text-white">{label}</span>
    </label>
  );
}

// Error Message
function ErrorMessage({ error, title, suggestion }) {
  if (!error) return null;
  return (
    <div className="mt-4 p-4 bg-rose-500/10 border border-rose-400/25 rounded-xl animate-fade-in">
      <p className="font-semibold text-rose-300 flex items-center gap-2">
        <span>⚠️</span> {title}
      </p>
      <p className="text-sm text-rose-200 mt-1">{error}</p>
      {suggestion && (
        <p className="text-xs mt-2 text-rose-200/80 border-t border-rose-300/20 pt-2">{suggestion}</p>
      )}
    </div>
  );
}

// Badge
function Badge({ children, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-300 border-blue-400/20',
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
    purple: 'bg-violet-500/10 text-violet-300 border-violet-400/20',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-400/20',
    red: 'bg-rose-500/10 text-rose-300 border-rose-400/20',
    gray: 'bg-white/5 text-gray-300 border-white/10'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}

// Entity Card
function EntityCard({ name, type, description, attributes, methods }) {
  const typeIcons = {
    class: '🏗️',
    interface: '📐',
    enum: '📋',
    component: '🧩',
    service: '⚙️'
  };
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/10 hover:border-indigo-400/30 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{typeIcons[type] || '📦'}</span>
        <span className="font-medium text-white">{name}</span>
      </div>
      {description && (
        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{description}</p>
      )}
      <div className="flex gap-2 text-xs">
        {attributes !== undefined && (
          <span className="text-gray-400 flex items-center gap-1">
            <span>📊</span> {attributes} attrs
          </span>
        )}
        {methods !== undefined && (
          <span className="text-gray-400 flex items-center gap-1">
            <span>⚡</span> {methods} methods
          </span>
        )}
      </div>
    </div>
  );
}

// Analysis Stats
function AnalysisStats({ diagramType, entities, relationships, totalFiles }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Diagram Type"
        value={diagramType || 'Unknown'}
        icon="📊"
      />
      <StatCard
        label="Entities"
        value={entities?.length || 0}
        icon="🔷"
      />
      <StatCard
        label="Relationships"
        value={relationships?.length || 0}
        icon="🔗"
      />
      <StatCard
        label="Files to Generate"
        value={totalFiles || 0}
        icon="📄"
      />
    </div>
  );
}

// Stat Card
function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center hover:bg-white/[0.06] transition-colors">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-white truncate" title={value}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

// Result Card
function ResultCard({ label, value, icon }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-white truncate">{value}</div>
    </div>
  );
}

// ==================== Styles ====================
// Add these styles to your global CSS or CSS module:
/*
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
*/
