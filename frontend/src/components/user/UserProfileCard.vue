<template>
  <div v-if="open" class="modal-backdrop upc-backdrop" @click.self="$emit('close')">
    <section class="modal upc-card" v-if="profile">
      <button class="close-btn" @click="$emit('close')">×</button>
      <div class="upc-banner" :style="bannerStyle">
        <div v-if="!profile.banner_url" class="upc-banner-fallback"></div>
      </div>
      <div class="upc-body">
        <div class="upc-avatar-row">
          <div class="upc-avatar" :style="avatarStyle">
            <span v-if="!profile.avatar_url">{{ initials }}</span>
          </div>
          <span class="upc-presence" :class="{ on: profile.online }"></span>
        </div>
        <h2 class="upc-name">{{ profile.display_name }}</h2>
        <p class="upc-user">@{{ profile.username }}</p>
        <p v-if="profile.custom_status" class="upc-status">{{ profile.custom_status }}</p>
        <p v-if="profile.bio" class="upc-bio">{{ profile.bio }}</p>
        <p class="upc-meta">
          {{ profile.online ? 'Online' : 'Offline' }}
          · Member since {{ memberSince }}
        </p>

        <div v-if="profile.mutual_friends || (profile.mutual_servers && profile.mutual_servers.length)" class="upc-mutual">
          <p v-if="profile.mutual_friends"><strong>{{ profile.mutual_friends }}</strong> Mutual Friends</p>
          <div v-if="profile.mutual_servers?.length" class="upc-servers">
            <span class="kicker">MUTUAL SERVERS</span>
            <div class="upc-server-chips">
              <span v-for="s in profile.mutual_servers" :key="s.id">{{ s.name }}</span>
            </div>
          </div>
        </div>

        <div class="upc-actions" v-if="!isSelf">
          <!-- Relationship-driven actions -->
          <template v-if="rel === 'NONE'">
            <button class="gold-btn" :disabled="busy" @click="doAddFriend">Add Friend</button>
            <button class="ghost-btn" @click="doMessage">Message</button>
          </template>
          <template v-else-if="rel === 'PENDING_SENT'">
            <button class="ghost-btn" disabled>Request Sent</button>
            <button class="ghost-btn" :disabled="busy" @click="doCancelRequest">Cancel</button>
            <button class="ghost-btn" @click="doMessage">Message</button>
          </template>
          <template v-else-if="rel === 'PENDING_RECEIVED'">
            <button class="gold-btn" :disabled="busy" @click="doAccept">Accept</button>
            <button class="ghost-btn" :disabled="busy" @click="doDecline">Decline</button>
            <button class="ghost-btn" @click="doMessage">Message</button>
          </template>
          <template v-else-if="rel === 'FRIENDS'">
            <button class="ghost-btn" disabled>Friends</button>
            <button class="ghost-btn" @click="doMessage">Message</button>
            <button class="ghost-btn" :disabled="busy" @click="doRemoveFriend">Remove Friend</button>
          </template>
          <template v-else-if="rel === 'BLOCKED'">
            <button class="gold-btn" :disabled="busy" @click="doUnblock">Unblock</button>
          </template>
          <button v-if="rel !== 'BLOCKED'" class="hangup-btn" :disabled="busy" @click="doBlock">Block</button>
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
      </div>
    </section>
    <section v-else-if="loading" class="modal small">
      <p class="empty-state">Loading profile…</p>
    </section>
    <section v-else class="modal small">
      <p class="form-error">{{ error || 'Profile unavailable' }}</p>
      <button class="ghost-btn" @click="$emit('close')">Close</button>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../../lib/api'

const props = defineProps({
  open: { type: Boolean, default: false },
  userId: { type: String, default: '' },
  selfId: { type: String, default: '' }
})
const emit = defineEmits(['close', 'message', 'changed'])

const profile = ref(null)
const loading = ref(false)
const error = ref('')
const busy = ref(false)

const isSelf = computed(() => props.userId && props.userId === props.selfId)
const rel = computed(() => profile.value?.relationship || 'NONE')
const initials = computed(() => {
  const n = profile.value?.display_name || profile.value?.username || '?'
  return n.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()
})
const memberSince = computed(() => {
  if (!profile.value?.created_at) return '—'
  try {
    return new Date(profile.value.created_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short'
    })
  } catch {
    return '—'
  }
})
const bannerStyle = computed(() => {
  if (profile.value?.banner_url) {
    return { backgroundImage: `url(${profile.value.banner_url})` }
  }
  return {}
})
const avatarStyle = computed(() => {
  if (profile.value?.avatar_url) {
    return { backgroundImage: `url(${profile.value.avatar_url})`, backgroundSize: 'cover' }
  }
  return {}
})

const load = async () => {
  if (!props.userId || !props.open) return
  loading.value = true
  error.value = ''
  profile.value = null
  try {
    const data = await api.getPublicProfile(props.userId)
    profile.value = data.profile
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.userId],
  () => {
    if (props.open) load()
  },
  { immediate: true }
)

const refresh = async () => {
  await load()
  emit('changed')
}

const doAddFriend = async () => {
  busy.value = true
  try {
    await api.requestFriend(props.userId)
    await refresh()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
const doCancelRequest = async () => {
  busy.value = true
  try {
    await api.cancelFriendRequest(props.userId)
    await refresh()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
const doAccept = async () => {
  busy.value = true
  try {
    await api.acceptFriend(props.userId)
    await refresh()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
const doDecline = async () => {
  busy.value = true
  try {
    await api.rejectFriend(props.userId)
    await refresh()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
const doRemoveFriend = async () => {
  if (!confirm('Remove friend?')) return
  busy.value = true
  try {
    await api.removeFriend(props.userId)
    await refresh()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
const doMessage = () => {
  emit('message', props.userId)
  emit('close')
}
const doBlock = async () => {
  if (!confirm('Block this user?')) return
  busy.value = true
  try {
    await api.blockUser(props.userId)
    await refresh()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
const doUnblock = async () => {
  busy.value = true
  try {
    await api.unblockUser(props.userId)
    await refresh()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.upc-backdrop{z-index:30}
.upc-card{width:min(400px,100%);padding:0;overflow:hidden;animation:upcIn .18s ease}
@keyframes upcIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
.upc-banner{height:110px;background:linear-gradient(135deg,rgba(107,26,26,.8),rgba(212,175,55,.15));background-size:cover;background-position:center}
.upc-banner-fallback{height:100%}
.upc-body{padding:0 22px 22px;position:relative}
.upc-avatar-row{position:relative;margin-top:-36px;width:72px}
.upc-avatar{width:72px;height:72px;border-radius:18px;border:3px solid #2c0909;background:rgba(107,26,26,.7);display:grid;place-items:center;font-family:'Cinzel',serif;color:var(--gold-light);font-size:18px}
.upc-presence{position:absolute;right:2px;bottom:2px;width:14px;height:14px;border-radius:50%;background:#4b2f2f;border:2px solid #2c0909}
.upc-presence.on{background:#77c58c;box-shadow:0 0 8px rgba(119,197,140,.5)}
.upc-name{margin-top:12px;font-family:'Cinzel',serif;font-size:20px;color:var(--cream)}
.upc-user{color:var(--muted);font-size:12px;margin-top:2px}
.upc-status{margin-top:8px;font-size:12px;color:rgba(240,215,140,.7)}
.upc-bio{margin-top:12px;font-size:12px;line-height:1.55;color:rgba(245,230,200,.75);white-space:pre-wrap}
.upc-meta{margin-top:10px;font-size:10px;color:rgba(245,230,200,.35)}
.upc-mutual{margin-top:14px;padding-top:12px;border-top:1px solid rgba(212,175,55,.1)}
.upc-mutual p{font-size:12px;color:var(--muted)}
.upc-mutual strong{color:var(--gold)}
.upc-servers{margin-top:10px}
.upc-server-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.upc-server-chips span{font-size:10px;padding:4px 8px;border-radius:999px;border:1px solid rgba(212,175,55,.15);color:rgba(245,230,200,.6)}
.upc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.upc-actions .hangup-btn{margin-left:auto}
</style>
