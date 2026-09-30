export type User = {
  id: string
  username: string
  display_name: string
  email?: string
  avatar_url?: string
}

export type Server = {
  id: string
  name: string
  icon_url?: string
  member_count?: number
}

export type Channel = {
  id: string
  name: string
  type: 'text' | 'voice' | string
  category?: string
  allow_message?: boolean
  allow_upload?: boolean
  allow_voice?: boolean
  allow_video?: boolean
}

export type Member = {
  user_id: string
  username?: string
  display_name?: string
  avatar_url?: string
  role?: string
  online?: boolean
}

export type Conversation = {
  id: string
  name?: string
  type?: string
  unread_count?: number
  peer?: {
    id: string
    display_name?: string
    username?: string
    avatar_url?: string
    online?: boolean
  }
}

export type Message = {
  id: string
  content: string
  sender_id?: string
  user_id?: string
  is_mine?: boolean
  created_at?: string
  display_name?: string
  username?: string
  avatar_url?: string
  attachment_url?: string
}
