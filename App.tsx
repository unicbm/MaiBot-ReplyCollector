import React, { useState, useCallback, useEffect } from 'react';

// Define the type for a single log entry for type safety
interface LogEntry {
  logger_name: string;
  event: string;
  level: string;
  timestamp: string;
}

// Define the type for an extracted message
interface SenderMessage {
    message: string;
    timestamp: string;
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
  const [senderMessages, setSenderMessages] = useState<SenderMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for export functionality
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'md' | 'txt'>('md');
  const [exportStyle, setExportStyle] = useState<'timeline' | 'plaintext'>('timeline');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    // When format is md, style must be timeline
    if (exportFormat === 'md') {
      setExportStyle('timeline');
    }
  }, [exportFormat]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    if (selectedFiles.length > 0) {
        const validFiles = selectedFiles.filter(file => file.name.endsWith('.jsonl'));
        
        if (validFiles.length < selectedFiles.length) {
            setError("部分文件不是有效的 .jsonl 格式，已被忽略。");
        } else {
            setError(null);
        }
        
        if (validFiles.length > 0) {
            setFiles(validFiles);
            setSenderMessages([]);
        } else if (selectedFiles.length > 0) {
             setError("请上传一个有效的 .jsonl 文件。");
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

    setIsProcessing(true);
    setError(null);
    setSenderMessages([]);

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
        
        const allExtractedMessages: SenderMessage[] = [];
        const messageRegex = /已将消息\s+'(.*?)'\s+发往平台/;

        contents.forEach(content => {
             if (!content) return;
             const lines = content.split('\n');
             lines.forEach((line) => {
                if (line.trim() === '') return;
                try {
                    const log: LogEntry = JSON.parse(line);
                    if (log.logger_name === 'sender' && log.event) {
                        const match = log.event.match(messageRegex);
                        if (match && match[1]) {
                            allExtractedMessages.push({ message: match[1], timestamp: log.timestamp });
                        }
                    }
                } catch (parseError) {
                    console.warn(`无法解析某行:`, line, parseError);
                }
            });
        });
        
        allExtractedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setSenderMessages(allExtractedMessages);

    } catch (err) {
        setError(`处理文件时出错: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setIsProcessing(false);
    }
  }, [files]);
  
  const generatePreviewContent = () => {
    if (senderMessages.length === 0) return;
    
    const fileNames = files.map(f => f.name).join(', ');
    let content = "";
    
    if (exportStyle === 'plaintext') { // Only for TXT
        content = senderMessages.map(item => item.message).join('\n');
    } else { // Timeline style
        if (exportFormat === 'md') {
            content += `# Sender 消息时间线\n\n`;
            content += `> 从文件 **${fileNames}** 中提取的消息记录。\n\n`;
            content += "---\n\n";
            senderMessages.forEach(item => {
                content += `### ${item.timestamp}\n\n`;
                content += `${item.message.replace(/\n/g, '\n\n')}\n\n`;
                content += "---\n\n";
            });
        } else { // TXT timeline
            content += `Sender 消息时间线\n`;
            content += `从文件 ${fileNames} 中提取的消息记录。\n\n`;
            senderMessages.forEach(item => {
                content += `[${item.timestamp}]\n${item.message}\n\n`;
            });
        }
    }
    setPreviewContent(content);
    setShowExportModal(true);
  };
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(previewContent).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownloadFile = () => {
    const mimeType = exportFormat === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([previewContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const exportTimestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
    link.download = `sender-logs-batch-${exportTimestamp}.${exportFormat}`;
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
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">JSONL 日志分析器</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
              上传一个或多个麦麦的日志文件以提取 Sender 的回复内容
            </p>
          </header>

          <div className="space-y-6">
            <label htmlFor="file-upload" className="group cursor-pointer w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-lg flex flex-col items-center justify-center transition-all duration-300 bg-gray-50 dark:bg-gray-700/50">
                <UploadIcon className="w-12 h-12 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">点击此处上传</span> 或拖放文件
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">支持多个 .jsonl 文件</p>
            </label>
            <input id="file-upload" type="file" className="hidden" accept=".jsonl" onChange={handleFileChange} multiple />
            
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
            
            <button
              onClick={processLogFile}
              disabled={files.length === 0 || isProcessing}
              className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-lg px-5 py-3 text-center disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-transform transform active:scale-95 duration-150"
            >
              {isProcessing ? '正在处理...' : `开始处理 ${files.length} ${files.length > 1 ? '个文件' : '个文件'}`}
            </button>
          </div>
          
          {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-center" role="alert">{error}</div>}

          {senderMessages.length > 0 && (
            <div className="space-y-6 pt-6">
                <div className="border-b-2 border-gray-200 dark:border-gray-600 pb-2 mb-2">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                        提取的消息 ({senderMessages.length}条)
                    </h2>
                </div>
              
                <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                    {senderMessages.map((item, index) => (
                    <div key={index} className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono">{item.timestamp}</p>
                        <p className="text-gray-800 dark:text-gray-200 break-words whitespace-pre-wrap">{item.message}</p>
                    </div>
                    ))}
                </div>

                {/* Export Options */}
                <div className="pt-4 space-y-4 bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">导出选项</h3>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                         <div className="space-y-2">
                            <label className="font-medium text-gray-700 dark:text-gray-300">导出格式</label>
                            <div className="flex gap-4">
                                <button onClick={() => setExportFormat('md')} className={`px-4 py-2 rounded-md transition-colors ${exportFormat === 'md' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>Markdown</button>
                                <button onClick={() => setExportFormat('txt')} className={`px-4 py-2 rounded-md transition-colors ${exportFormat === 'txt' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>TXT</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="font-medium text-gray-700 dark:text-gray-300">导出风格</label>
                            <div className="flex gap-4">
                                <button onClick={() => setExportStyle('timeline')} className={`px-4 py-2 rounded-md transition-colors ${exportStyle === 'timeline' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>时间线</button>
                                <button onClick={() => setExportStyle('plaintext')} disabled={exportFormat === 'md'} className={`px-4 py-2 rounded-md transition-colors ${exportStyle === 'plaintext' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}>纯文本</button>
                            </div>
                        </div>
                    </div>
                     <button
                        onClick={generatePreviewContent}
                        className="w-full sm:w-auto text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-md px-5 py-2.5 text-center transition-transform transform active:scale-95 duration-150"
                    >
                        生成预览与导出
                    </button>
                </div>
            </div>
          )}
          { !isProcessing && files.length > 0 && senderMessages.length === 0 &&
             <div className="text-center text-gray-500 dark:text-gray-400 pt-4">
                 <p>处理完成，在所选文件中未找到 "sender" 的消息。</p>
             </div>
          }
          
          <footer className="text-center text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
             <p>作者:un1 powered by Gemini</p>
             <p className="mt-1">本站完全开源，不会浏览或分发您的任何数据，请放心使用。</p>
          </footer>
        </div>
      </div>
      
      {/* Export Preview Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b dark:border-gray-600">
                    <h2 id="export-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">导出预览</h2>
                    <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="关闭">
                       <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="p-4 flex-grow overflow-y-auto">
                    <textarea 
                        readOnly 
                        value={previewContent}
                        className="w-full h-full min-h-[40vh] p-3 font-mono text-sm bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        aria-label="导出内容预览"
                    ></textarea>
                </main>
                <footer className="flex flex-col sm:flex-row justify-end items-center gap-3 p-4 border-t dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                    <button 
                        onClick={handleCopyToClipboard}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-150"
                    >
                       <ClipboardIcon className="w-5 h-5" />
                       <span>{isCopied ? '已复制!' : '复制内容'}</span>
                    </button>
                    <button 
                        onClick={handleDownloadFile}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-150"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        <span>下载文件</span>
                    </button>
                </footer>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
