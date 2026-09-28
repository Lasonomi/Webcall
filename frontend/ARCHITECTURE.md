# WebCall Frontend Architecture

## Layers

```
views/          → page composition (routing targets)
components/     → UI only (feature folders)
stores/         → Pinia global state
composables/    → reusable logic (voice, dm, webrtc)
services/       → API / WebSocket / WebRTC adapters
```

## Current state (post-refactor phase 1)

| Area | Location |
|------|----------|
| Auth | `stores/auth.store.ts`, `views/auth/LoginView.vue` |
| Theme | `stores/theme.store.ts`, `styles/theme.css` |
| Main shell | `views/home/HomeView.vue` (being split further) |
| UI kit | `components/ui/*` |
| User | `components/user/*` |
| Layout pieces | `components/layout/*` |
| API | `services/api/client.js` |
| Voice logic | `composables/useVoiceChannel.js` (global session) |
| DM logic | `composables/useDM.js` |
| Peer call | `composables/usePeerCall.js` |

## How to change UI safely

- **"percantik chat"** → `components/chat/` (extract from HomeView gradually)
- **"ubah profile card"** → `components/user/UserProfileCard.vue`
- **"ubah voice UI"** → `components/layout/GlobalVoiceBar.vue` + `components/voice/`
- **"ubah server sidebar"** → `components/layout/ServerSidebar.vue`
- **"dark/light"** → `stores/theme.store.ts` + `styles/theme.css`

## Next extraction targets from HomeView

1. `components/friends/FriendsSidebar.vue`
2. `components/friends/FriendsPanel.vue`
3. `components/dm/DMConversation.vue`
4. `components/channel/ChannelSidebar.vue`
5. `components/chat/ChatContainer.vue`
