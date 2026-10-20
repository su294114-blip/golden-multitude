# The Golden Multitude

一个完全程序化的 Three.js 水下体验：在帕劳水母湖中，穿行于向阳迁徙的金色水母群。

## 项目结构

- `dist/index.html`：网页入口与紧凑控制面板
- `dist/scene.js`：Three.js 场景、着色器、交互与性能分级
- `dist/style.css`：界面样式
- `netlify.toml`：Netlify 部署配置，发布目录已设为 `dist`
- `server.cjs`：本地预览服务器

网页没有构建步骤，也没有外部图片或模型。Three.js 使用固定版本的 CDN import map。

## 本地预览

需要安装 Node.js，然后在项目目录中运行：

```powershell
node server.cjs
```

浏览器访问：<http://127.0.0.1:4173>

## 上传到 GitHub

### 方法一：GitHub 网页上传

1. 在 GitHub 点击 **New repository**。
2. 仓库名可用 `golden-multitude`，不要勾选自动创建 README、`.gitignore` 或 License。
3. 创建仓库后，点击 **uploading an existing file**。
4. 把本项目中的 `.gitignore`、`.openai`、`dist`、`netlify.toml`、`README.md` 和 `server.cjs` 拖入上传区。
5. 填写提交说明，例如 `Initial website`，然后点击 **Commit changes**。

Windows 默认隐藏以点开头的项目。如果看不到 `.gitignore` 或 `.openai`，可以先在资源管理器中开启“查看 → 显示 → 隐藏的项目”。`.openai` 对 Netlify 不是必需文件，漏传也不会影响部署；`.gitignore` 建议保留。

### 方法二：命令行推送

项目已经初始化 Git，当前分支为 `main`。先在 GitHub 创建一个空仓库，然后在本目录运行：

```powershell
git add .
git commit -m "Prepare GitHub and Netlify deployment"
git remote add origin https://github.com/你的用户名/golden-multitude.git
git push -u origin main
```

如果 GitHub 仓库名不同，只需替换第三行 URL。GitHub 通过浏览器登录或令牌验证时，按它显示的提示完成即可。

## 在 Netlify 上线

1. 登录 Netlify，点击 **Add new site → Import an existing project**。
2. 选择 **GitHub** 并授权 Netlify 读取刚创建的仓库。
3. 选中 `golden-multitude` 仓库。
4. Netlify 会读取 `netlify.toml`。确认：
   - Branch to deploy：`main`
   - Build command：留空
   - Publish directory：`dist`
5. 点击 **Deploy site**。
6. 部署完成后，Netlify 会给出一个 `*.netlify.app` 地址。可在 **Site configuration → Change site name** 修改免费子域名。

以后修改文件后推送到 `main`，Netlify 会自动重新部署：

```powershell
git add .
git commit -m "Update scene"
git push
```

## 直接拖拽部署（不经过 GitHub）

也可以打开 Netlify Drop，把 `dist` 文件夹拖进去快速上线。这种方式不会连接 GitHub，后续修改需要重新拖拽，因此更适合临时预览。
