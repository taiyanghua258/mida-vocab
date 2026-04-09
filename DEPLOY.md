# My Vocab 部署指南 (VPS 版)

本指南将指导你如何将 "My Vocab" 项目部署到你的 RackNerd VPS 上。

## 1. 准备工作 (已完成回录)
* [x] VPS IP: `107.175.233.60`
* [x] 已安装 Node.js 20, NPM, PM2, Nginx
* [x] 域名已指向 VPS IP
* [x] 防火墙已开放 80, 443, 3001 端口

## 2. 上传/更新代码 (使用 GitHub)
既然你已经有 GitHub 仓库，这是最推荐的方式。

### A. 在本地电脑 (推送修改)
我刚才帮你修改了代码，你需要把这些修改推送到 GitHub：
```bash
git add .
git commit -m "chore: adapt for VPS deployment"
git push origin main  # 或者是你的分支名
```

### B. 在 VPS 上 (拉取代码)
SSH 登录 VPS 后：
```bash
cd /var/www
# 如果是第一次：
git clone https://github.com/你的用户名/你的项目名.git my-vocab
cd my-vocab

# 如果以后更新代码：
# git pull origin main
```

## 3. 安装依赖并启动后端
SSH 登录 VPS：
```bash
cd /var/www/my-vocab/backend
npm install

# 使用 PM2 启动
pm2 start server.js --name "my-vocab"

# 设置开机自启
pm2 save
pm2 startup
```

## 4. 访问方式 (重要)
既然 Node.js 兼任了网页服务器，你完全不需要额外配置 Nginx（除非你需要域名和 HTTPS）。

**推荐访问方式：**
直接在浏览器输入：`http://107.175.233.60:3001`

> [!TIP]
> 如果通过 80 端口（直接输入 IP）访问到了默认页面（如 Apache/Nginx 默认页）导致 API 报错，请务必在地址后面加上 `:3001`。

---

## 常用运维命令
* **查看后端状态**: `pm2 status`
* **查看日志**: `pm2 logs my-vocab`
* **重启后端**: `pm2 restart my-vocab`
* **开放端口**: `sudo ufw allow 3001/tcp` (如果无法访问，请检查防火墙)
