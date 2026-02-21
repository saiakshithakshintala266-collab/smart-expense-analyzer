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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalizeUploadRequestDto = exports.CreateUploadRequestDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CreateUploadRequestDto {
}
exports.CreateUploadRequestDto = CreateUploadRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CreateUploadRequestDto.prototype, "originalFileName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CreateUploadRequestDto.prototype, "contentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CreateUploadRequestDto.prototype, "sizeBytes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ["receipt", "bank_csv", "manual"] }),
    __metadata("design:type", String)
], CreateUploadRequestDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    __metadata("design:type", String)
], CreateUploadRequestDto.prototype, "checksumSha256", void 0);
class FinalizeUploadRequestDto {
}
exports.FinalizeUploadRequestDto = FinalizeUploadRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    __metadata("design:type", String)
], FinalizeUploadRequestDto.prototype, "checksumSha256", void 0);
//# sourceMappingURL=uploads.dto.js.map