<script setup lang="ts">
/**
 * Persistent voice bar — rendered at app shell level so route changes
 * do not unmount WebRTC session (session lives in useVoiceChannel).
 */
defineProps<{
  visible: boolean
  channelName?: string
  participants?: Array<{ display_name?: string; username?: string; muted?: boolean }>
  muted?: boolean
  deafened?: boolean
  status?: string
}>()
const emit = defineEmits<{
  toggleMute: []
  toggleDeafen: []
  leave: []
}>()
</script>

<template>
  <div v-if="visible" class="floating-voice-bar">
    <div class="fvb-info">
      <span class="fvb-icon">🔊</span>
      <div>
        <strong>{{ channelName || 'Voice' }}</strong>
        <small>{{ status || 'Connected' }} · {{ (participants || []).length }} in channel</small>
      </div>
    </div>
    <div class="fvb-actions">
      <button type="button" class="control-btn" :class="{ active: muted }" @click="emit('toggleMute')">
        {{ muted ? 'Unmute' : 'Mute' }}
      </button>
      <button type="button" class="control-btn" :class="{ active: deafened }" @click="emit('toggleDeafen')">
        {{ deafened ? 'Undeafen' : 'Deafen' }}
      </button>
      <button type="button" class="hangup-btn" @click="emit('leave')">Leave</button>
    </div>
  </div>
</template>
