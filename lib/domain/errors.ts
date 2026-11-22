export type ErrorCode =
  | "validation"
  | "not_found"
  | "sold_out"
  | "forbidden"
  | "closed"
  | "rate_limited"
  | "too_fast"
  | "id_required"
  | "conflict"
  | "not_implemented"
  | "bad_state";

export class DomainError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

export function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}
