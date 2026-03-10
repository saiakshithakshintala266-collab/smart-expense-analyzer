// File: services/upload-service/src/auth/debug-role.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";

const VALID_ROLES = ["admin", "member", "viewer"] as const;

@Injectable()
export class DebugRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const role = req.headers["x-debug-role"];

    // FIX: Throw 401 when the header is absent OR when it contains an invalid role.
    // Previously the guard may have only checked for invalid values, allowing absent headers through.
    if (!role || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      throw new UnauthorizedException("Missing or invalid X-Debug-Role header (dev-only auth)");
    }

    return true;
  }
}