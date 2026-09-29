# 2026-09-29 本机修复验收

- 环境：Windows；DSH Desktop 0.10.0-test.20260927；Harness 0.1.7-rc.2。
- 实际桌面已显示「花少2 · 花学工作台」、七位旅伴面板及「花少2工作台」工作区。
- 选择静静子，用已有 kimi-k3 路线发送「修复验收：请用一句话告诉我你是哪位花学旅伴。不要调用工具或修改文件。」
- 实际回复：「我是静静子，行就行、不行就直说，话摆在这儿了。」
- 退出并重新启动桌面端后，入口、角色选择与验收会话仍在。浏览器验收未发现控制台错误。
- 自动测试、包检查与安装副本一致性结果见项目 logs/2026-09-29-huaxue-desktop-repair.md。

完整游戏端到端流程、其它版本、全新机器安装未在本轮测试。本机修复不等于远端发布完成。原模型默认、凭据和历史会话未作清理或替换。

## 2026-09-29 补充：第八位嘉宾续演修复
- 现象：接话后无回复，15 秒后提示「未同步到本次接话记录」。会话日志显示每轮 `turn/end.reason.kind = "blocked"`。
- 根因：Harness 0.1.7 的归档会话门禁拒绝已归档会话的每一步；游戏流程首轮后立即归档会话。
- 修复：发送前取消归档，演练期间保持未归档，离开演练后再归档；`gameTranscript` 识别 `reason.kind`。
- 验证：`node scripts/build.mjs`、`scripts/check.mjs`、`node --test test/*.test.mjs` 24/24 通过；运行副本与源码逐字节一致。完整多轮游戏在桌面端的实际回复待重启 DSH 后人工确认。
- 同日补充：重启后继续演练需先 retain 会话再取绑定（facade.sessions.retain）；无头 Chrome 连本机网页端继续 session-5b3c0779 发送一句，turn 4 经 kimi-k3 completed，现场多人回复，控制台无错误。

## 2026-09-29 补充：市场上架前复核

- `node scripts/build.mjs`、`node scripts/check.mjs`、`node --test test/*.test.mjs` 24/24 通过（Node v24.17.0）。
- 由 `src/` 重新构建的 `client.js` 与本机实际运行副本逐字节一致（SHA-256 相同）。
- `npm pack --dry-run`：29 个文件，包体积约 0.62 MB（远低于 8 MiB 上限）；包内无密钥、无本机绝对路径、无 `.env`、无用户数据。
- 本轮回填 MIT 许可证（见 LICENSE 与 RIGHTS.md）；市场收录审核与远端发布结果以 awesome-dsh-workbench 的 PR 为准。
