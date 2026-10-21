import { test } from "node:test";
import assert from "node:assert/strict";

import { requestOf } from "../../cli/fetch.mjs";

test("reads a missing read's request from check's line, or a plain path", () => {
  assert.equal(requestOf("/api/x?a=b/c  [/api/x?a=b%2Fc]"), "/api/x?a=b%2Fc");
  assert.equal(requestOf("/api/documents/BOL-1"), "/api/documents/BOL-1");
});
