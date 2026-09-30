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

## 安装包发布（Release）

发布流程可复现，全部命令在本仓库根目录执行（需要 Node ≥ 22；`npm test` 前先 `npm install` 安装 `yaml`，其余步骤不需要下载依赖）：

```sh
npm run build        # 由 src/ 重新生成 client.js
npm run check        # 元数据、可移植性与语法检查
npm test             # 现有测试
npm run pack:check   # 完整发布门禁：重新构建 → 跑完以上检查与测试 → 校验安装契约（入口 / bundle patch / inject / exports）
                     # → npm pack → 校验包内容、私有文件与体积（≤ 8 MiB），
                     # 产出 ../dist/dsh-huaxue-workbench-<version>.tgz 并输出 SHA-256
```

`npm run pack:check` 通过后，在**对应版本的主分支提交**上创建正式 GitHub Release（不勾选 draft / prerelease），并把 tgz 以**固定附件名 `dsh-huaxue-workbench.tgz`**（不带版本号）上传。每次 Release 使用同一附件文件名，市场通过固定地址统计安装包下载次数：

- 固定下载地址：`https://github.com/gjz18342624299-arch/dsh-huaxue-workbench/releases/latest/download/dsh-huaxue-workbench.tgz`

用 GitHub CLI 的等价发布命令（网页操作等价；`#` 后是重命名后的附件名）：

```sh
gh release create v<version> ../dist/dsh-huaxue-workbench-<version>.tgz#dsh-huaxue-workbench.tgz --title <version> --latest
```

下载统计来自 GitHub Release 附件的真实下载数，不要手工填写或伪造。

验收记录见 [VALIDATION.md](VALIDATION.md)，安装说明见 [INSTALL.md](INSTALL.md)，资源与许可状态见 [RIGHTS.md](RIGHTS.md)。角色为虚构演绎，非本人发言。
