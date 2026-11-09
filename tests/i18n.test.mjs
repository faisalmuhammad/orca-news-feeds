import test from "node:test";
import assert from "node:assert/strict";
import { translate } from "../.orca/tests/i18n.mjs";

test("panel translations cover static, interpolated, and fallback copy", () => {
  assert.equal(translate("zh-CN", "Refresh feeds"), "刷新订阅");
  assert.equal(translate("zh-CN", "12 unread"), "12 条未读");
  assert.equal(
    translate("zh-CN", "Last successful update: {date}", {
      date: "2026/11/9 10:00",
    }),
    "上次成功更新：2026/11/9 10:00",
  );
  assert.equal(translate("zh-CN", "Untrusted feed title"), "Untrusted feed title");
  assert.equal(translate("en", "Refresh feeds"), "Refresh feeds");
});
