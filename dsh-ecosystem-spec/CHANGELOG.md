# Changelog

## 2026-08-17（评审修订，issue #266）

### Changed

- **Breaking（Draft 阶段）**：optional capability 引用的 `fallback` 改为必填（C-030）——没有书面降级行为的"可选"声明是 `INVALID_MANIFEST`。迁移：manifest 中每个 `requires.capabilities.optional[]` 条目补 `fallback` 字段。
- C-030 补全语义：`unknown` 触发条件限定为"contract version 未注册 / registry 版本高于协商器支持"两种；明确决策优先级 `unknown > rejected > waiting_authorization > compatible_degraded > compatible`。
- TUI Admission §2：`Listed` 统一为 `Declared`（对齐 claim schema 的 evidence ladder）；"TUI Verified" 获得显式定义（`verificationLevel ≥ Tested` 且 claim 未过期未撤销的市场展示标签）。
- `requirements-v0.1.json` 每条增加 `evidence: automated | review` 标记；C-050/C-070 如实标为 review。

### Added

- fixtures：`invalid-plugin-optional-no-fallback`、`invalid-plugin-provides`、`unknown-version-plugin`、`host-no-observe.example`；
- runner：`unknown` 决策分支、contract profile 十点完整性检查（C-040 转为 automated）、`compatible_degraded` 与 `unknown` 协商断言；
- `permissions-0.1.json`：`commands.invoke` 补充 default allow 的 rationale。

### Fixed

- C-002 的 `provides` 半边补负例 fixture；
- README 错别字。

## 2026-08-17

### Added

- 建立 `dsh-ecosystem-spec` 文档簇；
- 分离 Community Consensus 与 dsh-TUI Admission；
- 增加 TUI 实验性提案区；
- 增加 Governance / Conformance / Registry 文档；
- 增加 RFC 0000-0004 索引性规范文档；
- 增加 Manifest、Host Descriptor、event envelope、effect ledger、claim schema；
- 增加真实 registry、permission registry、contract profile、fixtures 和零依赖 conformance runner；
- 增加 `C-*` 与 `TUI-*` requirement ID、状态模型和 claim 绑定要求。

### Positioning

- 明确本仓库是社区侧、实验性规范库；
- 明确不要求 dsh 官方立即采纳；
- 明确 TUI 准入规则不自动等于社区标准或官方标准；
- 明确 reference implementation != specification；
- 明确 trusted-in-process capability/permission 不是技术安全边界。
