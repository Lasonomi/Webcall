export const WS_EVENTS = {
  DM_MESSAGE: 'dm:message',
  DM_UPDATE: 'dm:update',
  DM_DELETE: 'dm:delete',
  DM_TYPING: 'dm:typing',
  DM_READ: 'dm:read',
  DM_REACTION: 'dm:reaction',
  VOICE_JOIN: 'voice:join',
  VOICE_LEAVE: 'voice:leave',
  VOICE_STATE: 'voice:state',
} as const

export const RELATIONSHIP = {
  NONE: 'NONE',
  PENDING_SENT: 'PENDING_SENT',
  PENDING_RECEIVED: 'PENDING_RECEIVED',
  FRIENDS: 'FRIENDS',
  BLOCKED: 'BLOCKED',
} as const
