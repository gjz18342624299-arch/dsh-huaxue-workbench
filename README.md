# 花少2 · 花学工作台

独立 DSH 工作台：七位花学旅伴陪你工作、聊天与借个嘴，保留花学拆解和「第八位嘉宾」情境续演。

当前版本 0.4.0-rc.1。支持范围仅为已实际验证的 DSH Desktop 0.10.0-test.20260927 / Harness 0.1.7-rc.2（Windows）；其它宿主版本请先运行 `node scripts/doctor.mjs --app <DSH 的 resources/app 目录>` 核对，不要自动跳过兼容检查。

工作台通过正式 `desktopWorkbenches` 服务注册，复用原生会话与模型：不修改 DSH 安装文件，不创建自定义 Agent 预设，不包含任何模型密钥。模型由用户自己在 DSH 中配置。旧会话中的 `huashao2` 仅用于兼容读取，不是安装前置条件。

## 使用

1. 从侧栏左上角模式入口进入「花少2 · 花学工作台」。
2. 选择工作区和旅伴，进入原生 DSH 聊天。
3. 右侧可切换其他旅伴；游戏入口为「第八位嘉宾」。
4. 页面顶部的「花学历史会话」用于打开已有花学会话。原生侧栏保持宿主的默认会话列表，不改写宿主的过滤逻辑。

## 开发

Node.js >= 22；构建和纯逻辑测试不需要下载 npm 依赖：

```sh
npm run build
npm run check
npm test
npm pack
```

`src/host-client.js` 通过官方工作台插槽承载选人页与原生会话；`src/business-client.js` 为业务界面源文件；`client.js` 由 `scripts/build.mjs` 生成，随仓库与安装包提供。运行依赖 `yaml@2.9.0` 已显式声明，DSH 服务由宿主提供。

GitHub Actions 已配置 Linux、Windows、macOS 的包级检查；工作流通过不代表三种系统的桌面实机已验收。

验收记录见 [VALIDATION.md](VALIDATION.md)，安装说明见 [INSTALL.md](INSTALL.md)，资源与许可状态见 [RIGHTS.md](RIGHTS.md)。角色为虚构演绎，非本人发言。
