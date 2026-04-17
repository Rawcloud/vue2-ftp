const http = require('http');
const url = require('url');
const { Client } = require('basic-ftp');
const path = require('path');
const fs = require('fs');
const os = require('os');
const querystring = require('querystring');
const { Readable } = require('stream');

const PORT = 3000;

let ftpClient = null;

// 清理旧的临时文件
function cleanupTempFiles() {
    try {
        const tempDir = path.join(os.tmpdir(), 'ftp-upload-temp');
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                if (file.endsWith('.part')) {
                    try {
                        fs.unlinkSync(path.join(tempDir, file));
                        console.log(`Cleaned up old temp file: ${file}`);
                    } catch (err) {
                        console.error(`Failed to cleanup ${file}:`, err);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error during temp file cleanup:', error);
    }
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function serveStaticFile(res, filePath) {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });

    fs.createReadStream(filePath).pipe(res);
    return true;
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function parseRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function sendJson(res, data, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-Remote-Path, X-Chunk-Index, X-Total-Chunks, X-Is-Last'
    });
    res.end(JSON.stringify(data));
}

function sendError(res, message, statusCode = 500) {
    sendJson(res, { error: message }, statusCode);
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-Remote-Path, X-Chunk-Index, X-Total-Chunks, X-Is-Last'
        });
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (req.method === 'GET' && !pathname.startsWith('/api')) {
        const requestPath = pathname === '/' ? '/index.html' : pathname;
        const filePath = path.join(__dirname, requestPath);
        if (serveStaticFile(res, filePath)) {
            return;
        }
    }

    try {
        if (pathname === '/api/connect' && req.method === 'POST') {
            const body = await parseBody(req);
            const data = JSON.parse(body);
            
            if (ftpClient) {
                try {
                    ftpClient.close();
                } catch (e) {}
            }
            
            ftpClient = new Client();
            ftpClient.ftp.verbose = false;
            ftpClient.ftp.timeout = 30000;
            ftpClient.ftp.secure = false;
            ftpClient.ftp.secureOptions = { rejectUnauthorized: false };
            
            await ftpClient.connect(data.host, parseInt(data.port) || 21);
            await ftpClient.login(data.user || 'anonymous', data.password || '');
            
            sendJson(res, { success: true, message: 'Connected successfully' });
        }
        else if (pathname === '/api/disconnect' && req.method === 'POST') {
            if (ftpClient) {
                ftpClient.close();
                ftpClient = null;
            }
            sendJson(res, { success: true, message: 'Disconnected' });
        }
        else if (pathname === '/api/list' && req.method === 'POST') {
            if (!ftpClient) {
                return sendError(res, 'Not connected', 400);
            }
            
            const body = await parseBody(req);
            const data = JSON.parse(body);
            const ftpPath = data.path || '/';
            
            await ftpClient.cd(ftpPath);
            const list = await ftpClient.list();
            
            const files = list.map(item => {
                let modifyTime = null;
                try {
                    if (item.modifiedAt) {
                        modifyTime = item.modifiedAt.toISOString();
                    } else if (item.date) {
                        // 某些FTP服务器可能使用date字段
                        const date = new Date(item.date);
                        if (!isNaN(date.getTime())) {
                            modifyTime = date.toISOString();
                        }
                    } else if (item.time) {
                        // 尝试其他可能的字段
                        const date = new Date(item.time);
                        if (!isNaN(date.getTime())) {
                            modifyTime = date.toISOString();
                        }
                    }
                } catch (error) {
                    console.log(`Error parsing date for ${item.name}:`, error.message);
                }

                return {
                    name: item.name,
                    isDirectory: item.isDirectory,
                    size: item.size,
                    modifyTime: modifyTime
                };
            });
            
            sendJson(res, { success: true, files, path: ftpPath });
        }
        else if (pathname === '/api/upload' && req.method === 'POST') {
            if (!ftpClient) {
                return sendError(res, 'Not connected', 400);
            }
            
            const body = await parseBody(req);
            const data = JSON.parse(body);
            
            const remotePath = data.remotePath;
            const localFilePath = data.localPath;
            
            await ftpClient.uploadFrom(localFilePath, remotePath);
            sendJson(res, { success: true, message: 'Upload successful' });
        }
        else if (pathname === '/api/download' && req.method === 'POST') {
            if (!ftpClient) {
                return sendError(res, 'Not connected', 400);
            }
            
            const body = await parseBody(req);
            const data = JSON.parse(body);
            
            const remotePath = data.remotePath;
            
            let headersSent = false;
            
            try {
                // 先尝试获取文件信息，检查文件是否存在
                await ftpClient.list(path.dirname(remotePath));
                
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${path.basename(remotePath)}"`);
                headersSent = true;
                
                await ftpClient.downloadTo(res, remotePath);
            } catch (error) {
                console.error('Download error:', error);
                // 只有当头部未发送时才发送错误响应
                if (!headersSent) {
                    sendError(res, error.message || 'Download failed');
                } else {
                    // 头部已发送，无法发送错误响应，静默处理
                    console.log('Download error after headers sent, client may have canceled');
                }
            }
        }
        else if (pathname === '/api/delete' && req.method === 'POST') {
            if (!ftpClient) {
                return sendError(res, 'Not connected', 400);
            }
            
            const body = await parseBody(req);
            const data = JSON.parse(body);
            
            const remotePath = data.remotePath;
            const isDirectory = data.isDirectory;
            
            if (isDirectory) {
                await ftpClient.removeDir(remotePath);
            } else {
                await ftpClient.remove(remotePath);
            }
            
            sendJson(res, { success: true, message: 'Delete successful' });
        }
        else if (pathname === '/api/status' && req.method === 'GET') {
            sendJson(res, { 
                connected: ftpClient !== null,
                status: ftpClient ? 'connected' : 'disconnected'
            });
        }
        else if (pathname === '/api/upload-multipart' && req.method === 'POST') {
            if (!ftpClient) {
                return sendError(res, 'Not connected', 400);
            }

            const contentType = req.headers['content-type'] || '';
            let fileName;
            let remotePath;
            let chunkIndex;
            let totalChunks;
            let isLast;
            let fileBuffer;

            if (contentType.includes('application/json')) {
                const body = await parseBody(req);
                const data = JSON.parse(body);
                fileName = data.fileName;
                remotePath = data.remotePath;
                chunkIndex = data.chunkIndex;
                totalChunks = data.totalChunks;
                isLast = data.isLast;
                fileBuffer = Buffer.from(data.fileData || '', 'base64');
            } else {
                fileName = req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name']) : undefined;
                remotePath = req.headers['x-remote-path'] ? decodeURIComponent(req.headers['x-remote-path']) : undefined;
                chunkIndex = req.headers['x-chunk-index'] !== undefined ? parseInt(req.headers['x-chunk-index'], 10) : undefined;
                totalChunks = req.headers['x-total-chunks'] !== undefined ? parseInt(req.headers['x-total-chunks'], 10) : undefined;
                isLast = req.headers['x-is-last'] === 'true' || req.headers['x-is-last'] === '1';
                fileBuffer = await parseRawBody(req);
            }

            if (!fileName || !remotePath || !fileBuffer || fileBuffer.length === 0) {
                return sendError(res, 'Missing required parameters', 400);
            }

            const sanitizedPath = remotePath === '/' ? '' : remotePath.replace(/\\/g, '/');
            const fullRemotePath = `${sanitizedPath}/${fileName}`.replace(/\\/g, '/');

            try {
                if (chunkIndex !== undefined && totalChunks !== undefined) {
                    const tempDir = path.join(os.tmpdir(), 'ftp-upload-temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }

                    const tempFile = path.join(tempDir, `${fileName}.part`);
                    fs.appendFileSync(tempFile, fileBuffer);

                    if (isLast) {
                        const stream = fs.createReadStream(tempFile);
                        try {
                            await ftpClient.uploadFrom(stream, fullRemotePath);
                            // 上传成功后删除临时文件
                            fs.unlinkSync(tempFile);
                            sendJson(res, { success: true, message: 'Upload successful', path: fullRemotePath });
                        } catch (uploadError) {
                            // 上传失败时也要清理临时文件
                            try {
                                fs.unlinkSync(tempFile);
                            } catch (cleanupError) {
                                console.error('Failed to cleanup temp file:', cleanupError);
                            }
                            throw uploadError;
                        }
                    } else {
                        sendJson(res, { success: true, message: 'Chunk uploaded', chunkIndex: chunkIndex });
                    }
                } else {
                    const stream = Readable.from(fileBuffer);
                    await ftpClient.uploadFrom(stream, fullRemotePath);
                    sendJson(res, { success: true, message: 'Upload successful', path: fullRemotePath });
                }
            } catch (error) {
                console.error('Upload error:', error);
                return sendError(res, 'Failed to process file data', 400);
            }
        }
        else {
            sendJson(res, { error: 'Unknown endpoint' }, 404);
        }
    } catch (error) {
        console.error('FTP Error:', error);
        sendError(res, error.message);
    }
});

server.listen(PORT, () => {
    cleanupTempFiles(); // 启动时清理旧的临时文件
    console.log(`FTP Proxy Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  POST /api/connect - Connect to FTP server');
    console.log('  POST /api/disconnect - Disconnect from FTP server');
    console.log('  POST /api/list - List directory contents');
    console.log('  POST /api/upload - Upload file');
    console.log('  POST /api/download - Download file');
    console.log('  POST /api/delete - Delete file or directory');
    console.log('  GET  /api/status - Check connection status');
});

process.on('exit', () => {
    if (ftpClient) {
        ftpClient.close();
    }
});
