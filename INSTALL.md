# 安装

## 从工作台市场安装（推荐）

在 DSH Desktop 的工作台市场中找到「花少2 · 花学工作台」，点击安装并按提示重启 Harness。

## 适用版本

- 已验证：DSH Desktop 0.10.0-test.20260927 / Harness 0.1.7-rc.2（Windows，2026-09-29 验收，范围见 [VALIDATION.md](VALIDATION.md)）。
- 其它 Desktop / Harness 版本尚未验证，验证前不应宣称兼容。

## 从源码手动安装

1. 下载仓库源码（Code → Download ZIP 或 `git clone`），解压到长期保留的目录。
2. 准备 Node.js >= 22，在仓库根目录运行 `npm run build && npm run check && npm test` 自检。
3. 用 `npm pack` 得到 `.tgz`，通过当前 Desktop 版本实际支持的本地包安装入口安装，重启 Harness 后从模式入口进入工作台。
4. 可用 `node scripts/doctor.mjs --app <DSH 的 resources/app 目录>` 先核对 Desktop 与 Harness 版本是否在 `compatibility.json` 的已验证列表中；不在列表时脚本会停止且不修改任何配置。

## 关于 scripts/ 下的旧安装辅助脚本

`scripts/install.mjs`、`restore.mjs`、`boot-smoke.mjs`、`verify-runtime.mjs` 是旧本机安装流程的辅助脚本；0.4.0-rc.1 未验收其全新安装与回滚流程，`verify-runtime.mjs` 仍使用旧 settings 测试契约。不要在其它机器上直接重跑这些脚本；新安装、迁移或宿主升级需重新核验运行时与卸载记录。

## 卸载

从 DSH 插件管理移除本插件。卸载不删除会话、工作区文件与设置命名空间。

## 数据与网络

工作台不内置模型账号或密钥；聊天与游戏使用用户在 DSH 中自行配置的模型路线，网络访问取决于用户自己的模型服务。业务数据保存在 DSH 数据目录的设置命名空间与本机状态存储中，不上传到作者服务器。
