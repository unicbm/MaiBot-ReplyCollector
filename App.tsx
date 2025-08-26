import React, { useState, useCallback, useMemo } from 'react';

// Define the types for our processed log lines for type safety
interface SimpleMatch {
  type: 'simple';
  content: string;
  fileName: string;
}

interface ParsedMatch {
  type: 'parsed';
  groups: { [key: string]: string };
  fileName: string;
  rawContent: string;
}

type ProcessedLine = SimpleMatch | ParsedMatch;

interface ExportConfig {
    elements: { [key: string]: boolean };
    template: string;
    format: 'md' | 'txt';
}

// Icon Components
const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const ClipboardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
    </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [keyword, setKeyword] = useState<string>('');
  const [processedLines, setProcessedLines] = useState<ProcessedLine[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchCompleted, setLastSearchCompleted] = useState<boolean>(false);

  // Advanced parsing state
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const [parsingRegex, setParsingRegex] = useState<string>('');
  const [regexError, setRegexError] = useState<string | null>(null);

  // State for export functionality
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    if (selectedFiles.length > 0) {
        const validFiles = selectedFiles.filter(file => /\.(jsonl|txt|log)$/i.test(file.name));
        
        if (validFiles.length < selectedFiles.length) {
            setError("部分文件格式不被支持 (仅支持 .jsonl, .txt, .log)，已被忽略。");
        } else {
            setError(null);
        }
        
        if (validFiles.length > 0) {
            setFiles(validFiles);
            setProcessedLines([]);
            setLastSearchCompleted(false);
        } else if (selectedFiles.length > 0) {
             setError("请上传有效的 .jsonl, .txt, 或 .log 文件。");
             setFiles([]);
        }
    }
    event.target.value = '';
  };

  const processLogFile = useCallback(async () => {
    if (files.length === 0) {
      setError("请先选择一个或多个文件。");
      return;
    }
    if (!keyword.trim()) {
        setError("请输入要检索的关键字。");
        return;
    }

    setIsProcessing(true);
    setError(null);
    setRegexError(null);
    setProcessedLines([]);
    setLastSearchCompleted(false);

    let regex: RegExp | null = null;
    if (isAdvancedMode) {
        if (!parsingRegex.trim()) {
            setRegexError('高级模式已启用，请输入一个正则表达式。');
            setIsProcessing(false);
            return;
        }
        try {
            // Basic validation for named capture groups
            if (!/\(\?<.*?>/.test(parsingRegex)) {
                throw new Error("正则表达式必须包含至少一个命名捕获组, e.g., (?<name>...).");
            }
            regex = new RegExp(parsingRegex);
        } catch (e) {
            setRegexError(`正则表达式无效: ${e instanceof Error ? e.message : String(e)}`);
            setIsProcessing(false);
            return;
        }
    }

    try {
        const fileReadPromises = files.map(file => {
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result as string);
                reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败。`));
                reader.readAsText(file);
            });
        });

        const contents = await Promise.all(fileReadPromises);
        
        const allProcessedLines: ProcessedLine[] = [];

        contents.forEach((content, fileIndex) => {
             if (!content) return;
             const lines = content.split('\n');
             lines.forEach((line) => {
                if (regex) { // Advanced Mode
                    const match = line.match(regex);
                    if (match && match.groups && line.includes(keyword)) {
                        allProcessedLines.push({
                            type: 'parsed',
                            groups: match.groups,
                            fileName: files[fileIndex].name,
                            rawContent: line,
                        });
                    }
                } else { // Simple Mode
                    if (line.includes(keyword)) {
                        allProcessedLines.push({
                            type: 'simple',
                            content: line,
                            fileName: files[fileIndex].name
                        });
                    }
                }
            });
        });
        
        setProcessedLines(allProcessedLines);

    } catch (err) {
        setError(`处理文件时出错: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setIsProcessing(false);
        setLastSearchCompleted(true);
    }
  }, [files, keyword, isAdvancedMode, parsingRegex]);
  
  const generatePreviewAndShowModal = () => {
    if (processedLines.length === 0) return;

    const firstResult = processedLines[0];
    let initialConfig: ExportConfig;

    if (firstResult.type === 'parsed') {
        const elements = Object.keys(firstResult.groups).reduce((acc, key) => {
            acc[key] = true;
            return acc;
        }, {} as { [key: string]: boolean });

        const template = Object.keys(firstResult.groups).map(key => `{${key}}`).join(' ');
        
        initialConfig = { elements, template, format: 'md' };
    } else {
        // Simple mode config
        initialConfig = { elements: {}, template: '', format: 'md' };
    }
    
    setExportConfig(initialConfig);
    setShowExportModal(true);
  };

  const previewContent = useMemo(() => {
    if (!exportConfig || processedLines.length === 0) return '';
    
    const fileNames = files.map(f => f.name).join(', ');
    let content = "";
    
    const body = processedLines.map(item => {
        if (item.type === 'simple') {
            return item.content;
        }
        // Parsed item
        let lineContent = exportConfig.template;
        for (const [key, value] of Object.entries(item.groups)) {
            if (exportConfig.elements[key]) {
                // FIX: Replaced `replaceAll` with `split/join` for wider JS environment compatibility.
                lineContent = lineContent.split(`{${key}}`).join(value || '');
            }
        }
         // Clean up placeholders for disabled elements
        for (const key of Object.keys(exportConfig.elements)) {
            if (!exportConfig.elements[key]) {
                // FIX: Replaced `replaceAll` with `split/join` for wider JS environment compatibility.
                lineContent = lineContent.split(`{${key}}`).join('');
            }
        }
        return lineContent.replace(/\s\s+/g, ' ').trim(); // Clean up extra spaces
    }).join('\n');

    if (exportConfig.format === 'md') {
        content += `# 日志检索结果\n\n`;
        content += `> 关键字: **${keyword}**\n`;
        if (isAdvancedMode) content += `> 解析规则: \`${parsingRegex}\`\n`;
        content += `> 从文件 **${fileNames}** 中提取的记录。\n\n`;
        content += "---\n\n";
        content += "```\n" + body + "\n```\n";
    } else { // TXT 
        content += `日志检索结果\n`;
        content += `关键字: ${keyword}\n`;
        if (isAdvancedMode) content += `解析规则: ${parsingRegex}\n`;
        content += `从文件 ${fileNames} 中提取的记录。\n\n`;
        content += "---\n" + body;
    }
    
    return content;
  }, [processedLines, exportConfig, files, keyword, isAdvancedMode, parsingRegex]);

  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(previewContent).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownloadFile = () => {
    if (!exportConfig) return;
    const mimeType = exportConfig.format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([previewContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const exportTimestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
    link.download = `logs-retrieval-${exportTimestamp}.${exportConfig.format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  return (
    <div className="min-h-screen text-gray-800 dark:text-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-8">
          
          <header className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">通用日志检索与解析器</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
              通过关键字检索或使用正则表达式解析日志
            </p>
          </header>

          <div className="space-y-6">
            <label htmlFor="file-upload" className="group cursor-pointer w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-lg flex flex-col items-center justify-center transition-all duration-300 bg-gray-50 dark:bg-gray-700/50">
                <UploadIcon className="w-12 h-12 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">点击此处上传</span> 或拖放文件
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">支持多个 .jsonl, .txt, .log 文件</p>
            </label>
            <input id="file-upload" type="file" className="hidden" accept=".jsonl,.txt,.log" onChange={handleFileChange} multiple />
            
            {files.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg flex flex-col items-start" role="status">
                    <div className="flex items-center mb-2 font-semibold">
                        <CheckCircleIcon className="w-5 h-5 mr-3 flex-shrink-0"/>
                        <span>已选择 {files.length} 个文件:</span>
                    </div>
                    <ul className="list-disc list-inside pl-2 text-sm max-h-24 overflow-y-auto w-full">
                        {files.map((file, index) => (
                            <li key={index} className="truncate" title={file.name}>{file.name}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div>
                 <label htmlFor="keyword-input" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">关键字</label>
                 <input
                    type="text"
                    id="keyword-input"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    placeholder="输入要检索的关键字..."
                 />
            </div>
            
            {/* Advanced Parsing Section */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-4">
                 <div className="flex items-center">
                    <input id="advanced-mode-toggle" type="checkbox" checked={isAdvancedMode} onChange={() => setIsAdvancedMode(!isAdvancedMode)} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                    <label htmlFor="advanced-mode-toggle" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">启用高级解析 (正则表达式)</label>
                </div>
                {isAdvancedMode && (
                     <div>
                         <label htmlFor="regex-input" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">解析规则 (Regex)</label>
                         <textarea
                            id="regex-input"
                            value={parsingRegex}
                            onChange={(e) => setParsingRegex(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-mono dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                            placeholder="e.g., \[(?<timestamp>.*?)\] \[(?<level>\w+)\] (?<message>.*)"
                            rows={2}
                         />
                         {regexError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{regexError}</p>}
                    </div>
                )}
            </div>

            <button
              onClick={processLogFile}
              disabled={files.length === 0 || !keyword.trim() || isProcessing}
              className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-lg px-5 py-3 text-center disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-transform transform active:scale-95 duration-150"
            >
              {isProcessing ? '正在处理...' : `开始处理 ${files.length} ${files.length > 1 ? '个文件' : '个文件'}`}
            </button>
          </div>
          
          {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-center" role="alert">{error}</div>}

          {lastSearchCompleted && processedLines.length > 0 && (
            <div className="space-y-6 pt-6">
                <div className="border-b-2 border-gray-200 dark:border-gray-600 pb-2 mb-2 flex justify-between items-center">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                        提取的记录 ({processedLines.length}条)
                    </h2>
                    <button
                        onClick={generatePreviewAndShowModal}
                        className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-transform transform active:scale-95 duration-150"
                    >
                        导出选项
                    </button>
                </div>
              
                <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                    {processedLines.map((item, index) => (
                    <div key={index} className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm font-mono text-sm">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{item.fileName}</p>
                        {item.type === 'simple' ? (
                             <p className="text-gray-800 dark:text-gray-200 break-words whitespace-pre-wrap">{item.content}</p>
                        ) : (
                            <div className="space-y-1">
                                {Object.entries(item.groups).map(([key, value]) => (
                                    <div key={key} className="flex">
                                        <span className="text-blue-500 dark:text-blue-400 font-semibold w-24 flex-shrink-0">{key}:</span>
                                        <span className="text-gray-800 dark:text-gray-200 break-all">{value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    ))}
                </div>
            </div>
          )}
          { lastSearchCompleted && processedLines.length === 0 &&
             <div className="text-center text-gray-500 dark:text-gray-400 pt-4">
                 <p>处理完成，在所选文件中未找到包含关键字 "{keyword}" 的行。</p>
             </div>
          }
          
          <footer className="text-center text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
             <p>作者:un1 powered by Gemini Build</p>
             <p className="mt-1">本站完全开源，不会浏览或分发您的任何数据，请放心使用。</p>
          </footer>
        </div>
      </div>
      
      {/* Export Preview Modal */}
      {showExportModal && exportConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b dark:border-gray-600">
                    <h2 id="export-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">导出选项与预览</h2>
                    <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="关闭">
                       <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="p-6 flex-grow overflow-y-auto space-y-6">
                    {/* Export Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                             <label className="font-medium text-gray-700 dark:text-gray-300">导出格式</label>
                             <div className="flex gap-4">
                                <button onClick={() => setExportConfig(c => c ? {...c, format: 'md'} : null)} className={`px-4 py-2 rounded-md transition-colors text-sm ${exportConfig.format === 'md' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>Markdown</button>
                                <button onClick={() => setExportConfig(c => c ? {...c, format: 'txt'} : null)} className={`px-4 py-2 rounded-md transition-colors text-sm ${exportConfig.format === 'txt' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>TXT</button>
                             </div>
                        </div>
                        {isAdvancedMode && Object.keys(exportConfig.elements).length > 0 && (
                            <div className="space-y-2">
                                <label className="font-medium text-gray-700 dark:text-gray-300">包含的元素</label>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {Object.keys(exportConfig.elements).map(key => (
                                        <div key={key} className="flex items-center">
                                            <input
                                                id={`export-el-${key}`}
                                                type="checkbox"
                                                checked={exportConfig.elements[key]}
                                                onChange={(e) => setExportConfig(c => c ? {...c, elements: {...c.elements, [key]: e.target.checked}} : null)}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <label htmlFor={`export-el-${key}`} className="ml-2 text-sm text-gray-800 dark:text-gray-200">{key}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {isAdvancedMode && (
                         <div>
                             <label htmlFor="template-input" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">导出格式模板</label>
                             <input
                                type="text"
                                id="template-input"
                                value={exportConfig.template}
                                onChange={(e) => setExportConfig(c => c ? {...c, template: e.target.value} : null)}
                                className="block w-full p-2.5 font-mono text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                placeholder="e.g., [{timestamp}] {message}"
                             />
                         </div>
                    )}
                    
                    {/* Preview Area */}
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">预览</label>
                        <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm whitespace-pre-wrap break-all h-64 overflow-y-auto">
                           {previewContent}
                        </pre>
                    </div>

                </main>
                <footer className="flex justify-end items-center p-4 border-t dark:border-gray-600 space-x-4">
                    <button onClick={handleCopyToClipboard} className="relative flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                        {isCopied ? <CheckCircleIcon className="w-5 h-5 mr-2 text-green-500" /> : <ClipboardIcon className="w-5 h-5 mr-2" />}
                        {isCopied ? '已复制!' : '复制到剪贴板'}
                    </button>
                    <button onClick={handleDownloadFile} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:ring-4 focus:ring-blue-300">
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        下载文件
                    </button>
                </footer>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
