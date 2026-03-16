"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORRELATION_HEADER = void 0;
exports.getOrCreateCorrelationId = getOrCreateCorrelationId;
const nanoid_1 = require("nanoid");
exports.CORRELATION_HEADER = "x-correlation-id";
function getOrCreateCorrelationId(headerValue) {
    const v = (headerValue ?? "").trim();
    return v.length > 0 ? v : (0, nanoid_1.nanoid)(16);
}
//# sourceMappingURL=index.js.map