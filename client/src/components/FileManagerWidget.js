// client/src/components/FileManagerWidget.js
import React, { useState, useEffect, useCallback } from 'react';
import { FiRefreshCw, FiEdit2, FiTrash2, FiPlayCircle, FiSave, FiX } from 'react-icons/fi'; // Import new icons
import { getUserFiles, renameUserFile, deleteUserFile, analyzeDocument } from '../services/api';
import { LLM_OPTIONS } from '../config/constants';

// Helper Functions (Unchanged)
const getFileIcon = (type) => {
  switch (type) {
    case 'docs': return '📄'; case 'images': return '🖼️'; case 'code': return '💻'; default: return '📁';
  }
};
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'; const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; if (typeof bytes !== 'number' || bytes < 0) return 'N/A'; const i = Math.floor(Math.log(bytes) / Math.log(k)); const index = Math.max(0, Math.min(i, sizes.length - 1)); return parseFloat((bytes / Math.pow(k, index)).toFixed(1)) + ' ' + sizes[index];
};

const FileManagerWidget = ({ refreshTrigger, onAnalysisComplete }) => {
  // State hooks remain the same
  const [userFiles, setUserFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [renamingFile, setRenamingFile] = useState(null);
  const [newName, setNewName] = useState('');
  const [analyzingFile, setAnalyzingFile] = useState(null);
  const [selectedAnalysisType, setSelectedAnalysisType] = useState('faq');
  const defaultAnalysisProvider = 'groq_llama3';
  const [analysisLlmProvider, setAnalysisLlmProvider] = useState(defaultAnalysisProvider);
  const [analysisLlmModel, setAnalysisLlmModel] = useState(LLM_OPTIONS[defaultAnalysisProvider]?.models[0] || '');
  const [isAnalyzingInProgress, setIsAnalyzingInProgress] = useState(false);
  const [currentAnalysisError, setCurrentAnalysisError] = useState('');

  // All handler functions (fetchUserFiles, handleRename, etc.) remain unchanged
  const fetchUserFiles = useCallback(async () => { setIsLoading(true); setError(''); try { const response = await getUserFiles(); setUserFiles(response.data || []); } catch (err) { setError(err.response?.data?.message || 'Failed to load files.'); setUserFiles([]); } finally { setIsLoading(false); } }, []);
  useEffect(() => { fetchUserFiles(); }, [refreshTrigger, fetchUserFiles]);
  const handleRenameClick = (file) => { setRenamingFile(file.serverFilename); setNewName(file.originalName); setError(''); };
  const handleRenameCancel = () => { setRenamingFile(null); setNewName(''); setError(''); };
  const handleRenameSave = async () => { if (!renamingFile || !newName.trim()) { setError('New name cannot be empty.'); return; } if (newName.includes('/') || newName.includes('\\')) { setError('New name cannot contain slashes.'); return; } setError(''); try { await renameUserFile(renamingFile, newName.trim()); setRenamingFile(null); setNewName(''); fetchUserFiles(); } catch (err) { setError(err.response?.data?.message || 'Failed to rename file.'); } };
  const handleRenameInputKeyDown = (e) => { if (e.key === 'Enter') handleRenameSave(); else if (e.key === 'Escape') handleRenameCancel(); };
  const handleDeleteFile = async (serverFilename, originalName) => { if (!window.confirm(`Are you sure you want to delete "${originalName}"?`)) return; setError(''); try { await deleteUserFile(serverFilename); fetchUserFiles(); } catch (err) { setError(err.response?.data?.message || 'Failed to delete file.'); } };
  const handleAnalyzeClick = (file) => { setAnalyzingFile({ serverFilename: file.serverFilename, originalName: file.originalName }); setSelectedAnalysisType('faq'); setCurrentAnalysisError(''); setAnalysisLlmProvider(defaultAnalysisProvider); setAnalysisLlmModel(LLM_OPTIONS[defaultAnalysisProvider]?.models[0] || ''); };
  const handleAnalysisTypeChange = (e) => setSelectedAnalysisType(e.target.value);
  const handleAnalysisProviderChange = (e) => { const newProvider = e.target.value; setAnalysisLlmProvider(newProvider); setAnalysisLlmModel(LLM_OPTIONS[newProvider]?.models[0] || ''); };
  const handleAnalysisModelChange = (e) => setAnalysisLlmModel(e.target.value);
  const handleRunAnalysis = async () => { if (!analyzingFile) return; setIsAnalyzingInProgress(true); setCurrentAnalysisError(''); try { const payload = { documentName: analyzingFile.originalName, serverFilename: analyzingFile.serverFilename, analysisType: selectedAnalysisType, llmProvider: analysisLlmProvider, llmModelName: analysisLlmModel || null, }; const response = await analyzeDocument(payload); if (response.data && response.data.status === 'success') { if (onAnalysisComplete) { onAnalysisComplete({ type: response.data.analysisType || selectedAnalysisType, result: response.data.analysisResult, thinking: response.data.thinkingContent || null, documentName: response.data.documentName || analyzingFile.originalName }); } setAnalyzingFile(null); } else { throw new Error(response.data?.message || "Analysis API call did not return expected success status."); } } catch (err) { const errorMsg = err.response?.data?.message || err.message || "Failed to perform analysis."; setCurrentAnalysisError(errorMsg); } finally { setIsAnalyzingInProgress(false); } };

  return (
    // MODIFICATION: Added 'sidebar-panel' class for consistent padding
    <div className="file-manager-widget sidebar-panel">
      <div className="fm-header">
        {/* MODIFICATION: Changed h4 to h3 for consistency */}
        <h3 className="sidebar-header">Your Uploaded Files</h3>
        <button onClick={fetchUserFiles} disabled={isLoading || isAnalyzingInProgress} className="fm-refresh-btn" title="Refresh File List">
          <FiRefreshCw size={16} />
        </button>
      </div>

      {error && <div className="fm-error">{error}</div>}

      <div className="fm-file-list-container">
        {isLoading && userFiles.length === 0 ? ( <p className="fm-loading">Loading files...</p> ) :
         userFiles.length === 0 && !isLoading ? ( <p className="fm-empty">No files uploaded yet.</p> ) : (
          <ul className="fm-file-list">
            {userFiles.map((file) => (
              <li key={file.serverFilename} className="fm-file-item">
                <span className="fm-file-icon">{getFileIcon(file.type)}</span>
                <div className="fm-file-details">
                  {renamingFile === file.serverFilename ? (
                    <div className="fm-rename-section">
                      <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={handleRenameInputKeyDown} autoFocus className="fm-rename-input"/>
                      <button onClick={handleRenameSave} disabled={!newName.trim()} className="fm-action-btn fm-save-btn" title="Save"><FiSave size={16} /></button>
                      <button onClick={handleRenameCancel} className="fm-action-btn fm-cancel-btn" title="Cancel"><FiX size={16} /></button>
                    </div>
                  ) : (
                    <>
                      <span className="fm-file-name" title={file.originalName}>{file.originalName}</span>
                      <span className="fm-file-size">{formatFileSize(file.size)}</span>
                    </>
                  )}
                </div>

                {renamingFile !== file.serverFilename && (
                  <div className="fm-file-actions">
                    <button onClick={() => handleAnalyzeClick(file)} disabled={!!renamingFile || isAnalyzingInProgress} className="fm-action-btn fm-analyze-btn" title="Analyze Document"><FiPlayCircle size={16} /></button>
                    <button onClick={() => handleRenameClick(file)} disabled={!!renamingFile || isAnalyzingInProgress} className="fm-action-btn fm-rename-btn" title="Rename"><FiEdit2 size={16} /></button>
                    <button onClick={() => handleDeleteFile(file.serverFilename, file.originalName)} disabled={!!renamingFile || isAnalyzingInProgress} className="fm-action-btn fm-delete-btn" title="Delete"><FiTrash2 size={16} /></button>
                  </div>
                )}

                {analyzingFile && analyzingFile.serverFilename === file.serverFilename && (
                    <div className="fm-analysis-options">
                        {currentAnalysisError && <div className="fm-analysis-error">{currentAnalysisError}</div>}
                        <select value={selectedAnalysisType} onChange={handleAnalysisTypeChange} disabled={isAnalyzingInProgress}>
                            <option value="faq">Generate FAQ</option>
                            <option value="topics">Identify Topics</option>
                            <option value="mindmap">Create Mindmap Outline</option>
                        </select>
                        <select value={analysisLlmProvider} onChange={handleAnalysisProviderChange} disabled={isAnalyzingInProgress}>
                            {Object.keys(LLM_OPTIONS).map(key => (<option key={key} value={key}>{LLM_OPTIONS[key].name}</option>))}
                        </select>
                        {LLM_OPTIONS[analysisLlmProvider] && LLM_OPTIONS[analysisLlmProvider].models.length > 0 && (
                            <select value={analysisLlmModel} onChange={handleAnalysisModelChange} disabled={isAnalyzingInProgress}>
                                {LLM_OPTIONS[analysisLlmProvider].models.map(model => (<option key={model} value={model}>{model}</option>))}
                                <option value="">Provider Default</option>
                            </select>
                        )}
                        {/* MODIFICATION: Button container and new classes for styling */}
                        <div className="fm-analysis-actions">
                            <button onClick={() => setAnalyzingFile(null)} disabled={isAnalyzingInProgress} className="fm-secondary-btn">Cancel</button>
                            <button onClick={handleRunAnalysis} disabled={isAnalyzingInProgress} className="fm-primary-btn">
                                {isAnalyzingInProgress ? 'Analyzing...' : 'Run'}
                            </button>
                        </div>
                    </div>
                )}
              </li>
            ))}
          </ul>
        )}
         {isLoading && userFiles.length > 0 && <p className="fm-loading fm-loading-bottom">Processing...</p>}
      </div>
    </div>
  );
};

// --- CSS for FileManagerWidget ---
// MODIFICATION: All CSS rules have been updated to use theme variables.
const FileManagerWidgetCSS = `
.file-manager-widget {
  /* Padding is now inherited from sidebar-panel class */
  display: flex;
  flex-direction: column;
}
.fm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.fm-header .sidebar-header { /* Target the h3 for consistency */
    margin: 0;
    flex-grow: 1;
}
.fm-refresh-btn {
    background: none; border: none;
    color: var(--text-secondary);
    cursor: pointer; padding: 5px;
    border-radius: 50%;
    display: flex;
    transition: all 0.2s ease;
}
.fm-refresh-btn:hover:not(:disabled) {
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
}

.fm-error, .fm-analysis-error {
    color: var(--error-color, #e53e3e);
    background-color: var(--error-bg, rgba(229, 62, 62, 0.1));
    border: 1px solid var(--error-color, #e53e3e);
    border-radius: 6px;
    margin: 5px 0 10px 0;
    padding: 8px 12px;
    font-size: 0.85rem;
}
.fm-empty, .fm-loading {
    color: var(--text-secondary);
    text-align: center;
    padding: 20px 0;
    font-size: 0.9rem;
}

.fm-file-list { list-style: none; padding: 0; margin: 0; }
.fm-file-item {
    display: flex;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-primary);
    flex-wrap: wrap; /* Allows analysis options to appear below */
}
.fm-file-item:last-child { border-bottom: none; }
.fm-file-icon { margin-right: 12px; font-size: 1.2em; color: var(--text-secondary); }
.fm-file-details { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; gap: 2px; }
.fm-file-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); font-weight: 500; font-size: 0.95rem; }
.fm-file-size { font-size: 0.8rem; color: var(--text-secondary); }
.fm-file-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.fm-action-btn {
    background: none; border: none;
    color: var(--text-secondary);
    cursor: pointer; padding: 6px;
    border-radius: 50%;
    display: flex;
    transition: all 0.2s ease;
}
.fm-action-btn:hover:not(:disabled) { color: var(--text-primary); background-color: var(--bg-tertiary); }
.fm-analyze-btn:hover:not(:disabled) { color: var(--accent-active); }
.fm-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.fm-rename-section { display: flex; align-items: center; width: 100%; gap: 5px; }
.fm-rename-input {
    flex-grow: 1; padding: 6px 10px;
    border: 1px solid var(--border-primary);
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    border-radius: 6px; font-size: 0.9rem;
}
.fm-save-btn:hover:not(:disabled) { color: #27ae60; }
.fm-cancel-btn:hover:not(:disabled) { color: #e53e3e; }


/*
  START OF ANALYSIS PANEL REFACTOR
*/
.fm-analysis-options {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-primary);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    padding: 1rem;
    margin-top: 12px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    animation: fadeIn 0.3s ease; /* Add fade-in animation */
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

.fm-analysis-options select {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--border-primary);
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 0.9rem;
    transition: all 0.2s ease;
}
.fm-analysis-options select:focus {
    outline: none;
    border-color: var(--accent-active);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-active) 25%, transparent);
}
.fm-analysis-actions {
    display: flex;
    gap: 10px;
    margin-top: 5px;
}
.fm-primary-btn, .fm-secondary-btn {
    flex-grow: 1; /* Make buttons share space */
    padding: 10px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}
.fm-primary-btn {
    background-color: var(--accent-active);
    color: var(--text-on-accent);
    border-color: var(--accent-active);
}
.fm-primary-btn:hover:not(:disabled) { background-color: var(--accent-hover); border-color: var(--accent-hover); }
.fm-secondary-btn {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    border-color: var(--border-primary);
}
.fm-secondary-btn:hover:not(:disabled) { border-color: var(--text-secondary); }
.fm-primary-btn:disabled, .fm-secondary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
/*
  END OF ANALYSIS PANEL REFACTOR
*/
`;

// --- Inject CSS (Unchanged) ---
const styleTagFileManagerId = 'file-manager-widget-styles';
if (!document.getElementById(styleTagFileManagerId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagFileManagerId;
    styleTag.type = "text/css";
    styleTag.innerText = FileManagerWidgetCSS;
    document.head.appendChild(styleTag);
}

export default FileManagerWidget;