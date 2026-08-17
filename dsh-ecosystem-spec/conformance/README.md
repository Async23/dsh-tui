# Conformance & Verification

验证是对公开 contract、schema、registry 和 fixtures 的检查，不是“跑过参考实现”。当前 runner：`node conformance/tests/run.js`，入口：`npm test`。

## Evidence level

```text
Declared -> Parsed -> Negotiated -> Tested -> Observed -> Attested
```

- `Declared`：manifest/Host Descriptor 自己声称；
- `Parsed`：通过对应 schema；
- `Negotiated`：绑定指定 Host Descriptor 后得到机器可读 decision；
- `Tested`：通过公开 fixtures 和测试套件；
- `Observed`：在指定 runtime 中被记录；
- `Attested`：有独立验证主体的可核验签署证据。

任何 claim MUST 绑定 `schemas/conformance-claim.schema.json` 的等价 schema、Community spec version、Host Descriptor digest、artifact digest、suite version、result、测试时间和 evidence level。claim 过期或 revoked 后不得继续展示为有效。

## 绝对禁止

不得把任何 evidence level 转换成“安全插件”“官方认证”“无漏洞”或“完全兼容所有 dsh”。trusted-in-process 模式下，capability/permission 不是技术安全边界。

## 最小测试

Manifest：缺字段、类型错误、未注册 contract、非法 namespace、重复 contribution ID、禁止 service 声明。  
Negotiation：required 缺失、optional 缺失、unknown contract、waiting authorization、授权后通过。  
Lifecycle：正常/重复 activation、异常、deactivate、cleanup retry。  
Ledger：create、bind、replace、release、cleanup-failed。  
Remote：local/remote runtime、TUI/Web presentation、attach/detach、invocation snapshot；这些属于 TUI profile 的额外测试。

测试与条款映射见 `requirements-v0.1.json`，合法/非法输入见 `fixtures/`。失败必须返回稳定 reasonCode，并在市场/Host 展示“不可兼容、待授权、降级或未知”，不能只显示泛化的安装失败。
