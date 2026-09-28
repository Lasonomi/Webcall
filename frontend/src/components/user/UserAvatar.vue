<template>
  <span
    class="user-avatar"
    :class="[sizeClass, { clickable }]"
    :style="imgStyle"
    :title="title || name"
    @click="clickable && $emit('click', $event)"
    @contextmenu="clickable && $emit('contextmenu', $event)"
  >
    <span v-if="!src" class="user-avatar-fallback">{{ letters }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '?' },
  src: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
  clickable: { type: Boolean, default: false },
  title: { type: String, default: '' }
})
defineEmits(['click', 'contextmenu'])

const sizeClass = computed(() => `size-${props.size}`)
const letters = computed(() => {
  const n = (props.name || '?').trim()
  return n
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})
const imgStyle = computed(() => {
  if (props.src) {
    return {
      backgroundImage: `url(${props.src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {}
})
</script>

<style scoped>
.user-avatar{
  display:grid;place-items:center;flex-shrink:0;
  border:1px solid rgba(212,175,55,.28);
  background:rgba(107,26,26,.55);
  color:var(--gold-light, #f0d78c);
  font-family:'Cinzel',serif;
  overflow:hidden;
}
.user-avatar.size-sm{width:28px;height:28px;border-radius:9px;font-size:9px}
.user-avatar.size-md{width:34px;height:34px;border-radius:11px;font-size:10px}
.user-avatar.size-lg{width:38px;height:38px;border-radius:12px;font-size:12px}
.user-avatar.clickable{cursor:pointer}
.user-avatar.clickable:hover{border-color:rgba(212,175,55,.5)}
.user-avatar-fallback{line-height:1}
</style>
