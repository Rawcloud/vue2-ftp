# FTP 文件管理器

一个基于 Vue 2.7 + Element UI + basic-ftp 的 FTP 文件管理工具，支持目录浏览、文件上传、下载、删除等功能。

## 功能特性

- ✅ **FTP 连接管理** - 支持主机、端口、用户名、密码配置
- ✅ **目录浏览** - 以表格形式展示文件列表，支持文件夹下钻
- ✅ **目录导航** - 面包屑导航和上级目录返回功能
- ✅ **文件操作** - 支持下载、删除文件
- ✅ **文件上传** - 支持拖拽上传、点击选择、多文件上传
- ✅ **上传进度** - 显示上传进度条
- ✅ **精美 UI** - 渐变背景、卡片式设计、动画效果

## 技术栈

- **前端**：Vue 2.7 + Element UI 2.15（CDN 引入）
- **后端**：Node.js + basic-ftp 5.3.0
- **架构**：前端通过 HTTP API 与 Node.js 代理服务器通信，代理服务器处理 FTP 协议

## 安装步骤

### 1. 克隆项目

```bash
git clone <repository-url> ftp-vue2
cd ftp-vue2
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动 FTP 服务器（可选）

如果需要本地测试，推荐安装 [FileZilla Server](https://filezilla-project.org/download.php?type=server)：

1. 下载并安装 FileZilla Server
2. 打开 FileZilla Server Interface
3. 点击 **Edit** → **Users** → **Add** 创建用户
4. 设置用户名和密码
5. 点击 **Shared folders** 添加共享目录
6. 确保用户有 **Read + Write** 权限

## 使用方法

### 1. 启动代理服务器

```bash
node server.js
```

服务器会在 `http://localhost:3000` 运行，前端页面和 API 都由同一个服务器统一提供。

### 2. 打开前端页面

浏览器访问：

```text
http://localhost:3000/
```

### 3. 连接 FTP

- 输入 FTP 服务器地址（默认 `127.0.0.1:21`）
- 输入用户名和密码
- 点击“连接服务器”

### 4. 文件操作
- **浏览目录**：点击文件夹进入，使用面包屑导航
- **返回上级**：点击“⬆ 上级目录”
- **刷新列表**：点击“🔄 刷新”
- **下载文件**：点击文件右侧的“下载”按钮
- **删除文件**：点击文件右侧的“删除”按钮
- **上传文件**：拖拽文件到上传区域，或点击上传区域选择文件

## 项目结构

```
ftp-vue2/
├── index.html      # 前端页面
├── server.js       # Node.js FTP 代理服务器
├── package.json    # 项目配置
└── node_modules/   # 依赖包
```

## 配置说明

### 服务器配置

修改 `server.js` 文件中的配置：

```javascript
const PORT = 3000;  // 服务器端口
```

### 前端配置

前端已使用同域访问方式，并自动通过当前页面路径调用接口，无需手动修改 `API_BASE`。

## 部署到服务器

### 1. 上传项目文件

将项目目录上传到服务器，包括：

- `index.html`
- `server.js`
- `package.json`
- `README.md`

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
npm start
```

### 4. 访问页面

浏览器访问：

```text
http://<服务器IP>:3000/
```

如果您希望让服务在后台常驻运行，可使用 `pm2`、`systemd` 或其他进程管理工具。

## 常见问题

### 1. 连接失败
- 检查 FTP 服务器是否运行
- 确认端口号是否正确（默认 21）
- 检查用户名和密码是否正确
- 检查防火墙是否允许连接

### 2. 上传失败
- 确认用户有写权限
- 检查文件大小是否超过服务器限制
- 检查网络连接

### 3. 下载失败
- 确认用户有读权限
- 检查文件是否存在
- 检查网络连接

## 浏览器兼容性

- Chrome / Edge (推荐)
- Firefox
- Safari

## 许可证

MIT License

### MIT 许可证说明

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 作者

- 项目维护者：[rawcloud]
- 联系邮箱：[ha48002010@163.com]