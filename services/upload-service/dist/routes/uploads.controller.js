"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const observability_1 = require("@shared/observability");
const idempotency_1 = require("@shared/idempotency");
const uploads_service_1 = require("../domain/uploads.service");
const uploads_dto_1 = require("./uploads.dto");
let UploadsController = class UploadsController {
    constructor(uploads) {
        this.uploads = uploads;
    }
    createUpload(workspaceId, correlationId, idempotencyKey, body) {
        return this.uploads.createUpload({
            workspaceId,
            actorUserId: "dev-user",
            correlationId: correlationId ?? "",
            idempotencyKey: idempotencyKey ?? undefined,
            request: body
        });
    }
    finalize(workspaceId, uploadFileId, correlationId, idempotencyKey, body) {
        return this.uploads.finalizeUpload({
            workspaceId,
            uploadFileId,
            actorUserId: "dev-user",
            correlationId: correlationId ?? "",
            idempotencyKey: idempotencyKey ?? undefined,
            request: body
        });
    }
    getOne(workspaceId, uploadFileId) {
        return this.uploads.getUpload({ workspaceId, uploadFileId });
    }
    list(workspaceId, status, source) {
        return this.uploads.listUploads({ workspaceId, status, source });
    }
    remove(workspaceId, uploadFileId) {
        this.uploads.deleteUpload({ workspaceId, uploadFileId, actorUserId: "dev-user" });
        return;
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: false }),
    (0, swagger_1.ApiHeader)({ name: "X-Correlation-Id", required: false }),
    __param(0, (0, common_1.Param)("workspaceId")),
    __param(1, (0, common_1.Headers)(observability_1.CORRELATION_HEADER)),
    __param(2, (0, common_1.Headers)(idempotency_1.IDEMPOTENCY_HEADER)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, uploads_dto_1.CreateUploadRequestDto]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "createUpload", null);
__decorate([
    (0, common_1.Post)("/:uploadFileId/finalize"),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: false }),
    (0, swagger_1.ApiHeader)({ name: "X-Correlation-Id", required: false }),
    __param(0, (0, common_1.Param)("workspaceId")),
    __param(1, (0, common_1.Param)("uploadFileId")),
    __param(2, (0, common_1.Headers)(observability_1.CORRELATION_HEADER)),
    __param(3, (0, common_1.Headers)(idempotency_1.IDEMPOTENCY_HEADER)),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, uploads_dto_1.FinalizeUploadRequestDto]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "finalize", null);
__decorate([
    (0, common_1.Get)("/:uploadFileId"),
    __param(0, (0, common_1.Param)("workspaceId")),
    __param(1, (0, common_1.Param)("uploadFileId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)("workspaceId")),
    __param(1, (0, common_1.Query)("status")),
    __param(2, (0, common_1.Query)("source")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "list", null);
__decorate([
    (0, common_1.Delete)("/:uploadFileId"),
    __param(0, (0, common_1.Param)("workspaceId")),
    __param(1, (0, common_1.Param)("uploadFileId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "remove", null);
exports.UploadsController = UploadsController = __decorate([
    (0, swagger_1.ApiTags)("Uploads"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("/workspaces/:workspaceId/uploads"),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map