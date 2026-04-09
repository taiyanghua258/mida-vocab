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

## 4. 配置 Nginx 反向代理
我们需要告诉 Nginx 如何处理你的域名请求。

1. 创建配置文件：
   `nano /etc/nginx/sites-available/my-vocab`

2. 粘贴以下内容（**请将 `yourdomain.com` 替换为你真实的域名**）：
```nginx
server {
    listen 80;
    server_name yourdomain.com; # 替换成你的域名

    root /var/www/my-vocab/frontend;
    index index.html;

    # 静态前端文件
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 转发
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. 激活配置并重启 Nginx：
```bash
ln -s /etc/nginx/sites-available/my-vocab /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 5. 配置 HTTPS (推荐)
使用 Certbot 免费获取 SSL 证书：
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d yourdomain.com # 替换成你的域名
```

---

## 常用运维命令
* **查看后端状态**: `pm2 status`
* **查看日志**: `pm2 logs my-vocab`
* **重启后端**: `pm2 restart my-vocab`
* **Nginx 状态**: `systemctl status nginx`
