<template>
  <div
    v-if="open"
    class="ctx-menu"
    :style="{ top: y + 'px', left: x + 'px' }"
    @click.stop
  >
    <button @click="emit('view-profile')">View Profile</button>
    <button @click="emit('message')">Message</button>
    <template v-if="relationship === 'NONE'">
      <button @click="emit('add-friend')">Add Friend</button>
    </template>
    <template v-else-if="relationship === 'PENDING_SENT'">
      <button disabled>Friend Request Sent</button>
      <button @click="emit('cancel-request')">Cancel Request</button>
    </template>
    <template v-else-if="relationship === 'PENDING_RECEIVED'">
      <button @click="emit('accept')">Accept Friend Request</button>
      <button @click="emit('decline')">Decline</button>
    </template>
    <template v-else-if="relationship === 'FRIENDS'">
      <button disabled>Friends</button>
      <button @click="emit('remove-friend')">Remove Friend</button>
    </template>
    <template v-else-if="relationship === 'BLOCKED'">
      <button @click="emit('unblock')">Unblock</button>
    </template>
    <hr v-if="relationship !== 'BLOCKED'" />
    <button v-if="relationship !== 'BLOCKED'" class="danger" @click="emit('block')">Block</button>
  </div>
</template>

<script setup>
defineProps({
  open: Boolean,
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  relationship: { type: String, default: 'NONE' }
})
const emit = defineEmits([
  'view-profile',
  'message',
  'add-friend',
  'cancel-request',
  'accept',
  'decline',
  'remove-friend',
  'block',
  'unblock'
])
</script>

<style scoped>
.ctx-menu{
  position:fixed;z-index:50;min-width:180px;
  border:1px solid rgba(212,175,55,.2);border-radius:12px;
  background:#2c0909;box-shadow:0 16px 40px rgba(0,0,0,.5);
  padding:6px;display:grid;gap:2px;
}
.ctx-menu button{
  border:0;background:transparent;color:rgba(245,230,200,.75);
  text-align:left;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:12px;
}
.ctx-menu button:hover:not(:disabled){background:rgba(212,175,55,.1);color:var(--gold-light)}
.ctx-menu button:disabled{opacity:.45;cursor:default}
.ctx-menu hr{border:0;border-top:1px solid rgba(212,175,55,.1);margin:4px 0}
.ctx-menu .danger{color:#ffb3a8}
.ctx-menu .danger:hover{background:rgba(165,42,42,.2)}
</style>
