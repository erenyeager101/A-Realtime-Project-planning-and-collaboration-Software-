/**
 * Diagram Service - API calls for diagram code generation
 * Handles UML diagram analysis and code generation workflows
 */

import api from './api';

/**
 * Configuration for API requests
 */
const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  TIMEOUT_MS: 120000, // 2 minutes for AI processing
  MAX_FILE_SIZE_MB: 10
};

/**
 * Custom error class for diagram service errors
 */
export class DiagramServiceError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'DiagramServiceError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Get error message from API response
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
const getErrorMessage = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    switch (status) {
      case 400:
        return data?.error || data?.details || 'Invalid request. Please check your file and try again.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return data?.error || 'You do not have permission to perform this action.';
      case 404:
        return data?.error || 'Project or resource not found.';
      case 413:
        return `File too large. Maximum size is ${CONFIG.MAX_FILE_SIZE_MB}MB.`;
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
        return data?.error || data?.details || 'Server error occurred. Please try again later.';
      default:
        return data?.error || data?.details || `Request failed (${status})`;
    }
  }
  if (error.request) {
    return 'Network error. Please check your connection and try again.';
  }
  return error.message || 'An unexpected error occurred.';
};

/**
 * Validate file before upload
 * @param {File} file - The file to validate
 * @throws {DiagramServiceError} If validation fails
 */
const validateFile = (file) => {
  if (!file) {
    throw new DiagramServiceError('No file provided', 'FILE_MISSING');
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    throw new DiagramServiceError(
      `Invalid file type: ${file.type}. Supported: PNG, JPG, GIF, WebP, SVG`,
      'INVALID_FILE_TYPE'
    );
  }

  const maxSize = CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxSize) {
    throw new DiagramServiceError(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${CONFIG.MAX_FILE_SIZE_MB}MB`,
      'FILE_TOO_LARGE'
    );
  }
};

/**
 * Delay utility for retries
 * @param {number} ms - Milliseconds to delay
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Analyze a diagram without pushing to GitHub (preview)
 * @param {File} diagramFile - The diagram image file
 * @param {Object} options - Analysis options
 * @param {string} options.diagramType - Type of diagram ('uml-class', 'er', etc.)
 * @param {string} options.targetLanguage - Target language ('javascript', 'typescript')
 * @param {string} options.targetFramework - Target framework ('express-react-mongodb')
 * @param {boolean} options.includeTests - Whether to include tests
 * @param {boolean} options.includeDocs - Whether to include documentation
 * @returns {Promise} Analysis result
 * @throws {DiagramServiceError}
 */
export const analyzeDiagram = async (diagramFile, options = {}) => {
  // Validate file before sending
  validateFile(diagramFile);

  const formData = new FormData();
  formData.append('diagram', diagramFile);
  formData.append('diagramType', options.diagramType || 'auto-detect');
  formData.append('targetLanguage', options.targetLanguage || 'javascript');
  formData.append('targetFramework', options.targetFramework || 'express-react-mongodb');
  formData.append('includeTests', options.includeTests !== false);
  formData.append('includeDocs', options.includeDocs !== false);

  try {
    const response = await api.post('/diagrams/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: CONFIG.TIMEOUT_MS
    });
    return response;
  } catch (error) {
    throw new DiagramServiceError(
      getErrorMessage(error),
      error.response?.status || 'UNKNOWN',
      error.response?.data
    );
  }
};

/**
 * Generate code from diagram and push to GitHub
 * @param {string} projectId - The project ID
 * @param {File} diagramFile - The diagram image file
 * @param {Object} options - Generation options
 * @param {string} options.diagramType - Type of diagram
 * @param {string} options.targetLanguage - Target language
 * @param {string} options.targetFramework - Target framework
 * @param {boolean} options.includeTests - Include tests
 * @param {boolean} options.includeDocs - Include documentation
 * @param {boolean} options.createPR - Create pull request
 * @param {string} options.branchName - Custom branch name
 * @returns {Promise} Generation result with branch info
 * @throws {DiagramServiceError}
 */
export const generateCodeFromDiagram = async (projectId, diagramFile, options = {}) => {
  if (!projectId) {
    throw new DiagramServiceError('Project ID is required', 'PROJECT_ID_MISSING');
  }

  validateFile(diagramFile);

  const formData = new FormData();
  formData.append('diagram', diagramFile);
  formData.append('diagramType', options.diagramType || 'auto-detect');
  formData.append('targetLanguage', options.targetLanguage || 'javascript');
  formData.append('targetFramework', options.targetFramework || 'express-react-mongodb');
  formData.append('includeTests', options.includeTests !== false);
  formData.append('includeDocs', options.includeDocs !== false);
  formData.append('createPR', options.createPR !== false);
  formData.append('branchName', options.branchName || `feature/ai-generated-${Date.now()}`);

  try {
    const response = await api.post(`/diagrams/projects/${projectId}/generate-code`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: CONFIG.TIMEOUT_MS * 2 // Allow longer for code generation
    });
    return response;
  } catch (error) {
    throw new DiagramServiceError(
      getErrorMessage(error),
      error.response?.status || 'UNKNOWN',
      error.response?.data
    );
  }
};

/**
 * Get code generation status for a project
 * @param {string} projectId - The project ID
 * @returns {Promise} Status including canGenerate and previous generations
 * @throws {DiagramServiceError}
 */
export const getCodeGenerationStatus = async (projectId) => {
  if (!projectId) {
    throw new DiagramServiceError('Project ID is required', 'PROJECT_ID_MISSING');
  }

  try {
    const response = await api.get(`/diagrams/github/projects/${projectId}/generate-status`);
    return response;
  } catch (error) {
    throw new DiagramServiceError(
      getErrorMessage(error),
      error.response?.status || 'UNKNOWN',
      error.response?.data
    );
  }
};

/**
 * Retry code generation with previous analysis (if generation failed)
 * @param {string} projectId - The project ID
 * @param {Object} previousData - Previous analysis and code plan
 * @param {Object} previousData.analysis - Previous diagram analysis
 * @param {Object} previousData.codePlan - Previous code generation plan
 * @param {Array} previousData.files - Previously generated files
 * @returns {Promise} Generation result
 * @throws {DiagramServiceError}
 */
export const retryCodeGeneration = async (projectId, previousData) => {
  if (!projectId) {
    throw new DiagramServiceError('Project ID is required', 'PROJECT_ID_MISSING');
  }

  if (!previousData?.analysis || !previousData?.codePlan) {
    throw new DiagramServiceError(
      'Previous analysis and code plan are required for retry',
      'MISSING_RETRY_DATA'
    );
  }

  const formData = new FormData();
  formData.append('skipGeneration', 'true');
  formData.append('previousAnalysis', JSON.stringify(previousData.analysis));
  formData.append('previousCodePlan', JSON.stringify(previousData.codePlan));
  formData.append('previousFiles', JSON.stringify(previousData.files || []));

  try {
    const response = await api.post(`/diagrams/projects/${projectId}/generate-code`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: CONFIG.TIMEOUT_MS
    });
    return response;
  } catch (error) {
    throw new DiagramServiceError(
      getErrorMessage(error),
      error.response?.status || 'UNKNOWN',
      error.response?.data
    );
  }
};

/**
 * Cancel an ongoing request (if using AbortController)
 * @returns {AbortController} New abort controller
 */
export const createAbortController = () => new AbortController();

export default {
  CONFIG,
  DiagramServiceError,
  analyzeDiagram,
  generateCodeFromDiagram,
  getCodeGenerationStatus,
  retryCodeGeneration,
  createAbortController
};
