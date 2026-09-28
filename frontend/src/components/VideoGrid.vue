<template>
  <section class="videos">
    <div class="video-wrapper local">
      <div class="video-label">YOU <span>{{ isMuted ? '• MUTED' : '' }} {{ !isCameraOn ? '• CAM OFF' : '' }}</span></div>
      <video ref="localVideo" autoplay muted playsinline></video>
    </div>
    <div class="video-wrapper remote">
      <div class="video-label">PARTNER</div>
      <video ref="remoteVideo" autoplay playsinline></video>
      <div v-if="!hasRemoteStream" class="remote-empty"><span>◌</span><p>Waiting for your friend…</p></div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'

defineProps({ isMuted: Boolean, isCameraOn: Boolean, hasRemoteStream: Boolean })
const localVideo = ref(null)
const remoteVideo = ref(null)
const emit = defineEmits(['ready'])
onMounted(() => emit('ready', localVideo.value, remoteVideo.value))
</script>

<style scoped>
.videos{display:grid;grid-template-columns:1fr 1fr;gap:14px}.video-wrapper{position:relative;min-height:300px;border:1px solid rgba(212,175,55,.16);border-radius:18px;overflow:hidden;background:#130303;box-shadow:inset 0 1px rgba(255,255,255,.02)}video{display:block;width:100%;height:100%;min-height:300px;object-fit:cover;background:#130303}.video-label{position:absolute;z-index:2;top:12px;left:12px;padding:7px 10px;border-radius:10px;background:rgba(24,4,4,.76);border:1px solid rgba(212,175,55,.13);font-size:10px;letter-spacing:1.8px;color:rgba(240,215,140,.76)}.video-label span{color:rgba(255,205,187,.7)}.remote-empty{position:absolute;inset:0;display:grid;place-content:center;text-align:center;color:rgba(248,241,227,.36);background:radial-gradient(circle,rgba(107,26,26,.18),transparent 60%)}.remote-empty span{font-size:42px;color:rgba(212,175,55,.35)}.remote-empty p{margin-top:4px;font-size:13px}@media(max-width:760px){.videos{grid-template-columns:1fr}.video-wrapper,.video-wrapper video{min-height:240px}}
</style>
