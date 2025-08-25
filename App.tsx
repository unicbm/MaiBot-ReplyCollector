import React, { useState, useCallback } from 'react';

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


const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [senderMessages, setSenderMessages] = useState<SenderMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
        } else if (selectedFiles.length > 0) { // If user selected files but none were valid
             setError("请上传一个有效的 .jsonl 文件。");
             setFiles([]);
        }
    }
    // Reset file input value to allow re-uploading the same file
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
             lines.forEach((line, index) => {
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
        
        // Sort all messages by timestamp chronologically
        allExtractedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        setSenderMessages(allExtractedMessages);

    } catch (err) {
        setError(`处理文件时出错: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setIsProcessing(false);
    }
  }, [files]);
  
  const handleExportMarkdown = () => {
    if (senderMessages.length === 0) return;
    
    const fileNames = files.map(f => f.name).join(', ');

    let markdownContent = "# Sender 消息时间线\n\n";
    markdownContent += `> 从文件 **${fileNames}** 中提取的消息记录。\n\n`;
    markdownContent += "---\n\n";

    senderMessages.forEach(item => {
        markdownContent += `### ${item.timestamp}\n\n`;
        markdownContent += `${item.message.replace(/\n/g, '\n\n')}\n\n`;
        markdownContent += "---\n\n";
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const exportTimestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
    link.download = `sender-logs-batch-${exportTimestamp}.md`;
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
              上传一个或多个日志文件以提取 Sender 的回复内容
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
            <div className="space-y-4 pt-6">
              <div className="flex justify-between items-center border-b-2 border-gray-200 dark:border-gray-600 pb-2 mb-2">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                    提取的消息 ({senderMessages.length}条)
                </h2>
                <button
                    onClick={handleExportMarkdown}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-transform transform active:scale-95 duration-150"
                    aria-label="导出为Markdown"
                >
                    <DownloadIcon className="w-5 h-5" />
                    <span>导出Markdown</span>
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                {senderMessages.map((item, index) => (
                  <div key={index} className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono">{item.timestamp}</p>
                    <p className="text-gray-800 dark:text-gray-200 break-words whitespace-pre-wrap">{item.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          { !isProcessing && files.length > 0 && senderMessages.length === 0 &&
             <div className="text-center text-gray-500 dark:text-gray-400 pt-4">
                 <p>处理完成，在所选文件中未找到 "sender" 的消息。</p>
             </div>
          }
        </div>
      </div>
    </div>
  );
};

export default App;