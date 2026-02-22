import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

export type DebugRole = "admin" | "member" | "viewer";

@Injectable()
export class DebugRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[]> }>();
    const role = getHeader(req.headers ?? {}, "x-debug-role") as DebugRole | undefined;

    // If header missing, default to member for local dev convenience.
    const effectiveRole: DebugRole = role ?? "member";

    if (effectiveRole === "viewer") {
      throw new ForbiddenException("RBAC: viewer is read-only");
    }
    return true;
  }
}

function getHeader(
  headers: Record<string, string | string[]>,
  name: string
): string | undefined {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}