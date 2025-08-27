# 通用日志检索与解析器 (General Log Search & Parser)

一个通用的、纯前端的日志文件分析工具。支持关键字检索，或使用正则表达式解析日志结构，并自定义导出格式。

<!-- 建议您部署后替换成应用的真实截图 -->
<!-- ![App Screenshot](path/to/your/screenshot.png) -->

## ✨ 主要功能

- **批量文件处理**: 支持一次性上传并处理多个 `.jsonl`, `.txt`, `.log` 文件。
- **灵活的检索与解析**:
    - **关键字模式**: 快速从海量日志中筛选出包含指定关键字的行。
    - **高级解析模式**: 使用带命名捕获组 (`(?<name>...)`) 的正则表达式来提取、结构化日志数据。
- **上下文查看器**: 点击任意一条检索结果，即可在下方即时查看其在原始文件中的上下文（前后日志），便于问题追溯。
- **自定义导出**:
    - 支持将检索或解析的结果导出为 Markdown (`.md`) 或纯文本 (`.txt`) 文件。
    - 在高级解析模式下，可以自定义导出内容的模板，自由组合提取出的数据字段。
- **纯客户端运行**: 所有文件处理都在用户的浏览器中完成，您的数据和日志绝对安全，不会上传到任何服务器。
- **现代化界面**: 简洁美观的UI，支持拖放上传和深色模式。

## 🛠️ 技术栈

- **[React](https://react.dev/)**: 用于构建用户界面的核心库。
- **[TypeScript](https://www.typescriptlang.org/)**: 为代码提供类型安全，增强项目健壮性。
- **[Vite](https://vitejs.dev/)**: 下一代前端开发与构建工具，提供极速的开发体验。
- **[Tailwind CSS](https://tailwindcss.com/)**: 一个功能类优先的 CSS 框架，用于快速构建现代化界面。

## 🚀 本地开发与运行

如果您想在本地运行或继续开发此项目，请遵循以下步骤。

### 前提条件

- [Node.js](https://nodejs.org/) (推荐 `v18` 或更高版本)
- [npm](https://www.npmjs.com/) (通常随 Node.js 一起安装)

### 安装与启动

1.  **克隆仓库** (如果您还没有)
    ```bash
    git clone https://github.com/unicbm/MaiBot-ReplyCollector.git
    cd MaiBot-ReplyCollector
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    应用将在本地启动，通常地址为 `http://localhost:5173`。

## ☁️ 部署到 Cloudflare Pages

本项目已配置为可以轻松部署到 [Cloudflare Pages](https://pages.cloudflare.com/)。

1.  **推送到 GitHub**: 将您的代码推送到一个 GitHub 仓库。

2.  **连接到 Cloudflare**:
    - 登录 Cloudflare 仪表板。
    - 导航到 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
    - 选择您的项目仓库。

3.  **配置构建设置**:
    - 在 "Build settings" 步骤中，Cloudflare 可能会自动识别为 Vite 项目。请确认或手动输入以下配置：
      - **Build command**: `npm run build`
      - **Build output directory**: `dist`
      - **Root directory**: `/` (保持默认)
    - 点击 **Save and Deploy**。

Cloudflare 将自动构建并部署您的应用。完成后，您将获得一个公开的网址。
