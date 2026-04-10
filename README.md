
# 見だ (Mida) — Spaced Repetition Vocabulary Engine

<div align="center">

**一款极简主义的多语种单词记忆系统**

基于 FSRS 算法 · DeepSeek AI 赋能 · 3D 卡片交互

[快速开始](#部署与运行) · [功能一览](#核心功能) · [技术架构](#技术架构) · [为什么做这个](#为什么开发見だ)

</div>

---

## ✨ 项目简介

**見だ (Mida)** 是一款专为语言学习者打造的现代化单词记忆 Web 应用。支持 **日语** 和 **英语** 双语独立工作区，底层接入目前最先进的 **FSRS (Free Spaced Repetition Scheduler)** 记忆算法，结合 **DeepSeek AI** 智能辅助，在极简美学的交互界面中提供高效、科学、无压力的单词背诵体验。

> "也许我们并不需要太过的碎片化。"

---

## 核心功能

###  FSRS 科学记忆算法

完全摒弃传统固定时间复习法，底层接入 `ts-fsrs` 引擎，让每一次复习都恰到好处。

- **四级反馈调度**：每次复习提供 重来 / 困难 / 良好 / 简单 四个选项，算法自动计算下一次最佳复习时间
- **记忆冷却池**：分钟级短期记忆（如 1 分钟、10 分钟）进入冷却池，到期精准推送，实时倒计时
- **深度自定义**：支持调节目标记忆率（70%~99%）、最大复习间隔、每日新词上限、间隔随机化
- **无痕巩固模式**：「再练一次」功能提供纯净复习体验，满足突击需求但不污染 FSRS 数据模型
- **每日配额保护**：日/英语种分别独立设置每日新词上限，超出部分自动推入次日计划

###  多语种工作区

一键切换日语 / 英语独立工作区，**数据完全隔离**。

- 词库、统计、复习队列、配额在两个语种间互不干扰
- 界面文案、字体、输入占位符随语种自动适配
- Logo 切换带丝滑滚动动效（「見だ」⇌「See」）

### 🤖 DeepSeek AI 赋能

接入 DeepSeek 大语言模型，极大降低词库构建门槛。

- **单词智能补全**：输入单词即可自动生成读音/音标、中文释义、词性、标签（JLPT / CET4 等）
- **批量文本解析**：粘贴文章或单词表，AI 按行提取、去重，生成完整属性信息后一键导入
- **分片渐进式处理**：大批量单词自动分片发送，带实时进度条，避免超时

###  沉浸式 3D 卡片交互

- **物理级撕纸动效**：卡片采用 3D 层叠设计，揭晓答案时正面呈现拟真「撕下便签」飞走效果
- **堆叠景深系统**：当前卡 + 预览后两张，带缩放、位移、阴影的层级关系
- **全键盘操作**：Space / Enter 翻卡，数字键 1-4 直接提交反馈，行云流水

###  词库管理

- **罗马音模糊检索**：输入罗马音（如 `sakura`）即可搜出「桜 / さくら」
- **多格式导入**：支持手动添加、AI 批量生成、JSON / CSV 文件上传
- **Anki 词书兼容**：上传 `.apkg` 文件，云端自动清洗转换为标准 JSON
- **防重复机制**：批量导入自动与数据库比对去重，语种隔离
- **批量操作**：多选、全选、批量删除、批量导出

###  实时复习提醒

15 秒轮询 + 1 秒本地精准时钟，单词到期时多维度通知：

-  柔和风铃音效（C6 / E6 泛音和弦，Web Audio API 合成）
-  浏览器桌面推送通知
-  移动端物理震动反馈
-  页面标题动态闪烁
- 自带 60 秒去抖机制，防止通知轰炸

###  用户系统

- JWT 鉴权，7 天免登录
- 自定义头像（Base64 存储）与个性签名
- 完整的账户注销流程（级联删除所有用户数据）
- 登录频率限制 & AI 调用频率限制

---

## 技术架构

```
my-vocab/
├── frontend/              # 前端（单页应用）
│   ├── index.html         # 全部 HTML + CSS + JS（一体式 SPA）
│   ├── css/               # 外部样式
│   └── favicon.png
├── backend/               # Node.js 后端
│   ├── server.js          # Express 入口
│   ├── controllers/       # 业务逻辑
│   │   ├── authController.js     # 认证、设置、用户管理
│   │   ├── vocabController.js    # 词库 CRUD、导入导出、APKG 转换
│   │   └── studyController.js    # FSRS 调度、复习、统计
│   ├── models/            # Mongoose 数据模型
│   │   ├── User.js        # 用户 + FSRS 设置
│   │   ├── Word.js        # 单词 + FSRS 卡片状态
│   │   └── ReviewLog.js   # 复习日志
│   ├── routes/            # 路由
│   │   ├── auth.js / vocab.js / study.js
│   │   └── ai.js          # DeepSeek AI 代理
│   └── middleware/        # 中间件
│       ├── auth.js        # JWT 验证
│       ├── rateLimiter.js # 登录限流
│       └── aiRateLimiter.js # AI 调用限流
└── tools/
    └── anki_converter.py  # Anki .apkg → JSON 转换器
```

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | 原生 HTML5 / JavaScript (ES6+)、Tailwind CSS（深度定制动画与质感） |
| **后端** | Node.js、Express 5 |
| **数据库** | MongoDB (Mongoose 9) |
| **记忆算法** | ts-fsrs 5.x |
| **AI 引擎** | DeepSeek Chat API |
| **鉴权** | JWT + bcryptjs |
| **安全** | 登录限流、AI 调用限流、参数化子进程调用 |
| **工具链** | Python 3（Anki 转换器）、multer（文件上传） |

---

## 部署与运行

### 环境要求

- Node.js ≥ 18
- MongoDB ≥ 6
- Python 3（仅 Anki 转换功能需要）

### 1. 克隆与安装

```bash
git clone https://github.com/taiyanghua258/mida-vocab.git
cd mida-vocab/backend
npm install
```

### 2. 配置环境变量

在**项目根目录**创建 `.env` 文件：

```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/my-vocab
JWT_SECRET=your_super_secret_jwt_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key
CORS_ORIGIN=*
```

> ⚠️ `JWT_SECRET` 建议使用 64 字符以上的随机字符串。可通过 `openssl rand -hex 64` 生成。

### 3. 启动服务

**开发模式：**
```bash
cd backend
node server.js
```

**生产环境（推荐 PM2）：**
```bash
pm2 start backend/server.js --name "mida-vocab"
```

服务默认运行在 `http://localhost:3001`，前端静态资源已内置挂载，无需额外配置。

### 4. Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 文件上传大小限制（Anki 词书）
    client_max_body_size 10m;
}
```

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/login` | 登录（带限流） |
| `GET` | `/api/auth/me` | 获取当前用户信息 |
| `GET` | `/api/auth/settings` | 获取 FSRS 设置 |
| `PUT` | `/api/auth/settings` | 更新 FSRS 设置 |
| `PUT` | `/api/auth/profile` | 更新头像与签名 |
| `DELETE` | `/api/auth/user/:username` | 注销账户（级联删除） |
| `GET` | `/api/words` | 获取词库（分页、搜索、筛选） |
| `GET` | `/api/words/:id` | 获取单个单词 |
| `POST` | `/api/words` | 添加单词 |
| `PUT` | `/api/words/:id` | 更新单词 |
| `DELETE` | `/api/words/:id` | 删除单词 |
| `POST` | `/api/words/import` | 批量导入 |
| `POST` | `/api/words/batch-delete` | 批量删除 |
| `GET` | `/api/words/export` | 导出词库 |
| `POST` | `/api/words/upload-apkg` | 上传 Anki 文件转换 |
| `GET` | `/api/study/due` | 获取待复习单词 |
| `GET` | `/api/study/stats` | 获取学习统计 |
| `GET` | `/api/study/scheduling` | 获取调度预测 |
| `POST` | `/api/study/review` | 提交复习结果 |
| `POST` | `/api/ai/generate` | AI 单词补全 |
| `POST` | `/api/ai/generate-batch` | AI 批量生成 |

---

## 💡 为什么开发見だ

市面上已经有很多背单词软件了，为什么我还要自己动手做一个？

在学习日语的过程中，我发现现有的背单词软件总是有痛点：

1. **过于臃肿** — 我只想要一个安静背单词的地方
2. **死板的复习机制** — 算法不够智能，每天被海量复习任务淹没
3. **导入自己的生词过于困难** — 我想要方便的导入自己学习过程中整理的生词，然后可以依照严格的记忆算法来复习
4. **都不如 Anki** — 我抄了个丐版的anki，只保留了我需要的

見だ 的目标很简单：**一个纯粹、安静、高度沉浸的单词卡片机**，把最高效的 40 分钟还给自己。

---