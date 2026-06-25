export type AgentErrorCode =
  | 'authentication_required'
  | 'invalid_token_type'
  | 'permission_missing'
  | 'role_required'
  | 'forbidden'
  | 'connection_required'

export type AgentErrorMessage = {
  error: true
  code: AgentErrorCode
  message: string
  details?: Record<string, string | readonly string[]>
}

// Errors a tool returns *to the model*, not throws. The runtime keeps the
// session alive and the model relays `message` to the user. Tools should
// construct one and call `.toMessage()` from `execute()`.
export class AgentError {
  constructor(
    readonly code: AgentErrorCode,
    readonly message: string,
    readonly details?: Record<string, string | readonly string[]>
  ) {}

  toMessage(): AgentErrorMessage {
    return {
      error: true,
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    }
  }
}
