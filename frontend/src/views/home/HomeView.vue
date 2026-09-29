<template>
  <div class="app-shell" @click="closeCtx">
      <!-- Server rail (Discord-style) -->
      <nav class="server-rail">
        <button
          class="server-icon home-icon"
          :class="{ active: !activeServerId }"
          title="Home / Friends"
          @click="goHome"
        >
          <span>⌂</span>
        </button>
        <div class="rail-divider"></div>
        <button
          v-for="srv in servers"
          :key="srv.id"
          class="server-icon"
          :class="{ active: activeServerId === srv.id }"
          :title="srv.name"
          @click="selectServer(srv.id)"
        >
          <img v-if="srv.icon_url" :src="srv.icon_url" :alt="srv.name" />
          <span v-else>{{ serverInitials(srv.name) }}</span>
        </button>
        <button class="server-icon add-icon" title="Create Server" @click="createOpen = true">＋</button>
        <button class="server-icon join-icon" title="Join Server" @click="joinOpen = true">⧉</button>
      </nav>

      <!-- Friends sidebar (when no server selected) — Discord-style -->
      <aside v-if="!activeServerId" class="sidebar dc-sidebar">
        <div class="dc-search-wrap">
          <button type="button" class="dc-search-btn" @click="addOpen = true">
            Find or start a conversation
          </button>
        </div>

        <nav class="dc-nav">
          <button
            type="button"
            class="dc-nav-item"
            :class="{ active: activeTab === 'friends' || activeTab === 'online' }"
            @click="activeTab = 'friends'; selectedFriend = null; dm.closeConversation()"
          >
            <span class="dc-nav-icon">☺</span>
            Friends
            <span v-if="requests.length" class="dc-badge">{{ requests.length }}</span>
          </button>
          <button
            type="button"
            class="dc-nav-item"
            :class="{ active: activeTab === 'requests' }"
            @click="activeTab = 'requests'; selectedFriend = null; dm.closeConversation()"
          >
            <span class="dc-nav-icon">✉</span>
            Friend Requests
            <span v-if="requests.length" class="dc-badge danger">{{ requests.length }}</span>
          </button>
        </nav>

        <div class="dc-section-head">
          <span>Direct Messages</span>
          <button type="button" class="dc-icon-sm" title="New Group" @click="groupOpen = true">👥</button>
          <button type="button" class="dc-icon-sm" title="New DM" @click="addOpen = true">＋</button>
        </div>
        <div class="dc-dm-list">
          <button
            v-for="c in dm.conversations.value"
            :key="c.id"
            type="button"
            class="dc-dm-row"
            :class="{ active: dm.activeConversationId.value === c.id }"
            @click="dm.openConversation(c.id)"
            @contextmenu="c.peer?.id && onUserContextMenu($event, c.peer.id)"
          >
            <div class="dc-avatar-wrap">
              <UserAvatar :name="c.peer?.display_name || c.peer?.username || '?'" :src="c.peer?.avatar_url || ''" />
              <span class="dc-status-dot" :class="{ on: c.peer?.online || c.peer?.peer_id }"></span>
            </div>
            <span class="dc-dm-name">{{ c.type === 'group' ? (c.name || 'Group') : (c.peer?.display_name || c.peer?.username || 'Unknown') }}</span>
            <span v-if="c.unread_count" class="dc-badge">{{ c.unread_count }}</span>
          </button>
          <p v-if="!dm.conversations.value.length" class="dc-empty">No conversations yet</p>
        </div>

        <div class="dc-user-panel">
          <div class="dc-user-info" @click="settingsOpen = true; loadMyProfileForm()">
            <div class="dc-avatar-wrap">
              <UserAvatar :name="user.display_name || user.username" :src="user.avatar_url || myProfileForm.avatar_url || ''" />
              <span class="dc-status-dot on"></span>
            </div>
            <div class="dc-user-text">
              <strong>{{ user.display_name }}</strong>
              <small>{{ user.custom_status || 'Online' }}</small>
            </div>
          </div>
          <div class="dc-user-actions">
            <button type="button" class="dc-icon-sm" title="Settings" @click="settingsOpen = true; loadMyProfileForm()">⚙</button>
            <button type="button" class="dc-icon-sm" title="Log out" @click="logoutNow">⏻</button>
          </div>
        </div>
      </aside>

      <!-- Server channel sidebar -->
      <aside v-else class="sidebar channel-sidebar">
        <div class="sidebar-head server-head">
          <div class="server-title-wrap">
            <p class="server-title">{{ activeServer?.name || 'Server' }}</p>
            <p class="brand-sub">{{ activeServer?.member_count || 0 }} members · {{ myRole || 'MEMBER' }}</p>
          </div>
          <button class="icon-btn" title="Server Settings" @click="openServerSettings">⚙</button>
        </div>

        <div class="channel-scroll">
          <template v-for="cat in channelCategories" :key="cat.name">
            <div class="list-title channel-cat">{{ cat.name }}</div>
            <button
              v-for="ch in cat.channels"
              :key="ch.id"
              class="channel-row"
              :class="{ active: selectedChannelId === ch.id }"
              @click="selectChannel(ch)"
            >
              <span class="ch-icon">{{ ch.type === 'voice' ? '🎙' : '#' }}</span>
              <span>{{ ch.name }}</span>
            </button>
          </template>
          <p v-if="!channels.length" class="muted-line">No channels yet.</p>
        </div>

        <!-- Connected voice panel (Discord-style) -->
        <div v-if="voice.isInVoice.value" class="voice-dock">
          <div class="voice-dock-head">
            <span class="vd-status" :class="voice.connectionState.value.toLowerCase()">●</span>
            <div>
              <strong>{{ voice.connectionState.value }}</strong>
              <small>🔊 {{ voice.channelName.value }}</small>
            </div>
          </div>
          <div class="voice-dock-people">
            <div v-for="p in voice.participants.value" :key="p.user_id" class="vd-person">
              <span>{{ p.display_name || p.username }}</span>
              <span>{{ p.deafened ? '🔇' : (p.muted ? '🔇' : '🎤') }}</span>
            </div>
          </div>
          <div class="voice-dock-controls">
            <button :class="{ active: voice.isMuted.value }" title="Mute" @click="voice.toggleMute()">🎤</button>
            <button :class="{ active: voice.isDeafened.value }" title="Deafen" @click="voice.toggleDeafen()">🎧</button>
            <button :class="{ active: voice.isCameraOn.value }" title="Camera" @click="toggleVoiceCamera">📹</button>
            <button :class="{ active: voice.isScreenSharing.value }" title="Screen" @click="toggleVoiceScreen">🖥</button>
            <button class="leave" title="Leave" @click="leaveVoiceChannel">📞</button>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="profile-mini">
            <UserAvatar size="lg" :name="user.display_name || user.username" :src="user.avatar_url || myProfileForm.avatar_url || ''" />
            <span>
              <strong>{{ user.display_name }}</strong>
              <small>@{{ user.username }}</small>
            </span>
          </div>
          <button class="settings-btn" @click="settingsOpen = true; loadMyProfileForm()">⚙ Account</button>
          <button class="logout-btn" @click="logoutNow">Log out</button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="content">
        <header class="topbar">
          <div class="top-search">
            <span>⌕</span>
            <input
              v-model="globalSearch"
              @keyup.enter="runGlobalSearch"
              :placeholder="activeServerId ? 'Search in server…' : 'Search people, usernames, or conversations'"
            />
          </div>
          <div class="top-actions">
            <span class="status-pill"><i></i> Online</span>
            <button class="icon-btn" title="Notifications">♢</button>
          </div>
        </header>

        <section class="content-area">
          <!-- Toast -->
          <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>

          <!-- SERVER VIEW -->
          <template v-if="activeServerId">
            <div class="server-layout">
              <div class="server-main panel page-panel">
                <div class="panel-head">
                  <div>
                    <p class="kicker">{{ selectedChannel?.type === 'voice' ? 'VOICE CHANNEL' : 'TEXT CHANNEL' }}</p>
                    <h2>
                      <span class="ch-prefix">{{ selectedChannel?.type === 'voice' ? '🎙' : '#' }}</span>
                      {{ selectedChannel?.name || 'general' }}
                    </h2>
                  </div>
                  <div class="head-actions">
                    <button class="ghost-btn" @click="loadServerMembers">↻ Members</button>
                    <button v-if="canManage" class="gold-btn" @click="openServerSettings">Settings</button>
                  </div>
                </div>

                <!-- Text channel messages -->
                <div v-if="selectedChannel?.type !== 'voice'" class="channel-chat">
                  <div v-if="channelLoading" class="empty-state">Loading messages…</div>
                  <div v-else-if="channelError" class="empty-state form-error">{{ channelError }}</div>
                  <div v-else ref="channelMsgBox" class="channel-messages">
                    <div v-for="msg in channelMessages" :key="msg.id" class="channel-msg">
                      <UserAvatar
                        size="sm"
                        :name="msg.display_name || msg.username"
                        :src="msg.avatar_url || ''"
                        clickable
                        @click="openUserProfile(msg.user_id)"
                        @contextmenu="onUserContextMenu($event, msg.user_id)"
                      />
                      <div class="msg-body">
                        <div class="msg-meta">
                          <strong class="msg-author" @click="openUserProfile(msg.user_id)" @contextmenu="onUserContextMenu($event, msg.user_id)">{{ msg.display_name || msg.username }}</strong>
                          <time>{{ formatTime(msg.created_at) }}</time>
                        </div>
                        <div v-if="msg.reply_to_id" class="dm-reply-preview">↩ {{ msg.reply_preview || 'Reply' }}</div>
                        <template v-if="msg.deleted_at">
                          <p class="dm-deleted">Message deleted</p>
                        </template>
                        <template v-else-if="channelEditId === msg.id">
                          <input v-model="channelEditText" class="dm-edit-input" @keyup.enter="saveChannelEdit" />
                          <Button size="sm" @click="saveChannelEdit">Save</Button>
                          <button class="ghost-btn" @click="channelEditId=null">Cancel</button>
                        </template>
                        <template v-else>
                          <p v-if="msg.content">{{ msg.content }}</p>
                          <div v-if="msg.attachment_url" class="msg-attachment">
                            <img v-if="isImageAtt(msg)" :src="absUrl(msg.attachment_url)" alt="attachment" class="msg-image" @click="openAttach(msg.attachment_url)" />
                            <a v-else :href="absUrl(msg.attachment_url)" target="_blank" rel="noopener">📎 {{ msg.attachment_type || 'File' }}</a>
                          </div>
                          <div class="dm-msg-meta">
                            <span class="dm-actions">
                              <button @click="channelReplyTo = msg">Reply</button>
                              <button v-if="msg.user_id === user.id" @click="startChannelEdit(msg)">Edit</button>
                              <button v-if="msg.user_id === user.id" @click="removeChannelMsg(msg)">Delete</button>
                              <button @click="reactChannel(msg, '❤️')">❤️</button>
                              <button @click="reactChannel(msg, '👍')">👍</button>
                            </span>
                          </div>
                          <div v-if="msg.reactions?.length" class="dm-reactions">
                            <span v-for="(r, ri) in msg.reactions" :key="ri">{{ r.emoji }} {{ r.count || 1 }}</span>
                          </div>
                        </template>
                      </div>
                    </div>
                    <div v-if="!channelMessages.length" class="chat-empty">No messages yet. Say hello!</div>
                  </div>
                                    <div v-if="channelReplyTo" class="dm-reply-bar">
                    Replying to: {{ channelReplyTo.content?.slice(0, 60) || 'message' }}
                    <button class="ghost-btn" @click="channelReplyTo = null">×</button>
                  </div>
                  <div v-if="channelAttach" class="attach-preview">
                    📎 {{ channelAttach.filename }}
                    <button class="ghost-btn" @click="channelAttach = null">×</button>
                  </div>
                  <p v-if="channelTypingName" class="dm-typing">{{ channelTypingName }} is typing…</p>
                  <div class="channel-input">
                    <input type="file" ref="fileInputChannel" class="hidden-file" @change="onChannelFile" />
                    <button type="button" class="icon-btn" title="Attach" :disabled="channelUploading" @click="fileInputChannel?.click()">📎</button>
                    <input
                      v-model="channelInput"
                      @input="sendChannelTyping"
                      @keyup.enter="sendChannelMessage"
                      :placeholder="'Message #' + (activeChannel?.name || 'channel')"
                      :disabled="channelSending || channelUploading"
                    />
                    <Button :disabled="channelSending || channelUploading || (!channelInput.trim() && !channelAttach)" @click="sendChannelMessage">
                      {{ channelUploading ? '…' : 'Send' }}
                    </Button>
                  </div>
                </div>

                <!-- Voice channel -->
                <div v-else class="voice-placeholder">
                  <div class="ornament">🔊</div>
                  <p class="kicker">VOICE CHANNEL</p>
                  <h3>{{ selectedChannel?.name }}</h3>
                  <p class="connection-note" style="display:inline-block;margin-top:12px">
                    {{ voice.channelId.value === selectedChannel?.id ? voice.connectionState.value : 'Not connected' }}
                  </p>
                  <p v-if="voice.error.value" class="form-error" style="margin-top:10px">{{ voice.error.value }}</p>

                  <div class="voice-people" style="margin-top:24px">
                    <div
                      v-for="p in (voice.channelId.value === selectedChannel?.id ? voice.participants.value : [])"
                      :key="p.user_id"
                      class="voice-person"
                    >
                      <span class="avatar sm">{{ initials(p.display_name || p.username) }}</span>
                      <span class="vp-name">{{ p.display_name || p.username }}</span>
                      <span class="vp-mic">{{ p.deafened ? '🔇' : (p.muted ? '🔇' : '🎤') }}</span>
                    </div>
                    <p v-if="voice.channelId.value === selectedChannel?.id && !voice.participants.value.length" class="muted-line">
                      Waiting for others…
                    </p>
                  </div>

                  <div v-if="voice.channelId.value === selectedChannel?.id && voice.localPreviewStream.value" class="voice-preview">
                    <video
                      ref="localVoiceVideo"
                      autoplay
                      muted
                      playsinline
                      class="voice-preview-video"
                    ></video>
                    <span class="vp-badge">{{ voice.isScreenSharing.value ? 'Screen' : (voice.isCameraOn.value ? 'Camera' : 'You') }}</span>
                  </div>

                  <div class="call-actions" style="margin-top:28px">
                    <button
                      v-if="voice.channelId.value !== selectedChannel?.id || !voice.isInVoice.value"
                      class="gold-btn"
                      @click="joinVoiceChannel(selectedChannel)"
                    >
                      Join Voice
                    </button>
                    <template v-else>
                      <button class="control-btn" :class="{ active: voice.isMuted.value }" @click="voice.toggleMute()">
                        {{ voice.isMuted.value ? 'Unmute' : 'Mute' }}
                      </button>
                      <button class="control-btn" :class="{ active: voice.isDeafened.value }" @click="voice.toggleDeafen()">
                        {{ voice.isDeafened.value ? 'Undeafen' : 'Deafen' }}
                      </button>
                      <button class="control-btn" :class="{ active: voice.isCameraOn.value }" @click="toggleVoiceCamera">
                        {{ voice.isCameraOn.value ? 'Cam On' : 'Camera' }}
                      </button>
                      <button class="control-btn" :class="{ active: voice.isScreenSharing.value }" @click="toggleVoiceScreen">
                        {{ voice.isScreenSharing.value ? 'Sharing' : 'Share Screen' }}
                      </button>
                      <button class="control-btn" @click="openVoiceDevices">Devices</button>
                      <button class="hangup-btn" @click="leaveVoiceChannel">Leave</button>
                    </template>
                  </div>
                </div>
              </div>

              <!-- Member list panel -->
              <aside class="member-panel panel">
                <div class="member-head">
                  <p class="kicker">MEMBERS</p>
                  <span class="count-chip">{{ members.length }}</span>
                </div>
                <div v-if="membersLoading" class="muted-line">Loading…</div>
                <div v-else class="member-list">
                  <div
                    v-for="m in members"
                    :key="m.user_id"
                    class="member-row"
                    @click="openUserProfile(m.user_id)"
                    @contextmenu="onUserContextMenu($event, m.user_id)"
                  >
                    <UserAvatar size="sm" :name="m.display_name || m.username" :src="m.avatar_url || ''" />
                    <div class="member-copy">
                      <strong>{{ m.display_name || m.username }}</strong>
                      <small>{{ m.role }}</small>
                    </div>
                    <span class="presence" :class="{ on: m.online }"></span>
                  </div>
                  <p v-if="!members.length" class="muted-line">No members.</p>
                </div>
              </aside>
            </div>
          </template>

          <!-- FRIENDS VIEW (home) -->
          <template v-else>
            <!-- DM Conversation -->
            <div v-if="dm.activeConversationId.value" class="panel page-panel dm-panel">
              <div class="panel-head">
                <div class="dm-header-user">
                  <span class="avatar">{{ initials(dm.activePeer.value?.display_name || dm.activePeer.value?.username || '?') }}</span>
                  <div>
                    <p class="kicker">DIRECT MESSAGE</p>
                    <h2>{{ dm.activePeer.value?.display_name || 'Conversation' }}</h2>
                    <p class="panel-sub">
                      {{ (dm.activePeer.value?.online || dm.activePeer.value?.peer_id) ? 'Online' : 'Offline' }}
                      · @{{ dm.activePeer.value?.username }}
                    </p>
                  </div>
                </div>
                <div class="head-actions">
                  <button class="ghost-btn" @click="dmSearchOpen = !dmSearchOpen">⌕ Search</button>
                  <button
                    class="gold-btn"
                    :disabled="!dm.activePeer.value?.peer_id"
                    @click="selectedFriend = dm.activePeer.value; dm.closeConversation()"
                  >Voice Call</button>
                  <button class="ghost-btn" @click="blockActivePeer">Block</button>
                  <button class="ghost-btn" @click="dm.closeConversation()">Close</button>
                </div>
              </div>

              <div v-if="dmSearchOpen" class="dm-search-bar">
                <input
                  :value="dm.searchQuery.value"
                  @input="dm.searchInConversation($event.target.value)"
                  placeholder="Search messages…"
                />
                <div v-if="dm.searchResults.value.length" class="dm-search-results">
                  <button
                    v-for="m in dm.searchResults.value"
                    :key="m.id"
                    class="dm-search-hit"
                    @click="dmSearchOpen=false"
                  >{{ m.content }}</button>
                </div>
              </div>

              <div v-if="dm.loading.value" class="empty-state">Loading…</div>
              <div v-else-if="dm.error.value" class="empty-state form-error">{{ dm.error.value }}</div>
              <div v-else class="dm-messages" ref="dmMsgBox">
                <div
                  v-for="msg in dm.messages.value"
                  :key="msg.id"
                  class="dm-msg"
                  :class="{ mine: msg.is_mine || msg.sender_id === user.id }"
                >
                  <div v-if="msg.reply_to_id" class="dm-reply-preview">↩ {{ msg.reply_preview || 'Reply' }}</div>
                  <template v-if="msg.deleted_at">
                    <p class="dm-deleted">Message deleted</p>
                  </template>
                  <template v-else-if="dmEditId === msg.id">
                    <input v-model="dmEditText" class="dm-edit-input" @keyup.enter="saveEditDM" />
                    <button class="gold-btn" @click="saveEditDM">Save</button>
                    <button class="ghost-btn" @click="dmEditId=null">Cancel</button>
                  </template>
                  <template v-else>
                    <p>{{ msg.content }}</p>
                    <div v-if="msg.attachment_url" class="dm-attachment">
                      <a :href="msg.attachment_url" target="_blank" rel="noopener">{{ msg.attachment_type || 'Attachment' }}</a>
                    </div>
                    <div class="dm-msg-meta">
                      <time>{{ formatTime(msg.created_at) }}</time>
                      <span v-if="msg.is_mine || msg.sender_id === user.id" class="dm-actions">
                        <button @click="dm.replyTo.value = msg">Reply</button>
                        <button @click="startEditDM(msg)">Edit</button>
                        <button @click="removeDM(msg)">Delete</button>
                        <button @click="reactDM(msg, '❤️')">❤️</button>
                        <button @click="reactDM(msg, '👍')">👍</button>
                      </span>
                      <span v-else class="dm-actions">
                        <button @click="dm.replyTo.value = msg">Reply</button>
                        <button @click="reactDM(msg, '❤️')">❤️</button>
                        <button @click="reactDM(msg, '👍')">👍</button>
                      </span>
                    </div>
                    <div v-if="msg.reactions?.length" class="dm-reactions">
                      <span v-for="(r, ri) in msg.reactions" :key="ri">{{ r.emoji }} {{ r.count || 1 }}</span>
                    </div>
                  </template>
                </div>
                <div v-if="!dm.messages.value.length" class="chat-empty">No messages yet. Say hello.</div>
              </div>

              <div v-if="dm.typingUser.value" class="dm-typing">{{ dm.activePeer.value?.display_name || 'User' }} is typing…</div>
              <div v-if="dm.replyTo.value" class="dm-reply-bar">
                Replying to: {{ dm.replyTo.value.content?.slice(0, 60) }}
                <button class="ghost-btn" @click="dm.replyTo.value = null">×</button>
              </div>
              <div v-if="dmAttach" class="attach-preview">
                📎 {{ dmAttach.filename }}
                <button class="ghost-btn" @click="dmAttach = null">×</button>
              </div>
              <div class="channel-input dm-input">
                <input type="file" ref="fileInputDm" class="hidden-file" @change="onDmFile" />
                <button type="button" class="icon-btn" title="Attach" :disabled="dmUploading" @click="fileInputDm?.click()">📎</button>
                <input
                  v-model="dmInput"
                  @input="onDMInput"
                  @keyup.enter="sendDM"
                  placeholder="Write a message…"
                  :disabled="dm.sending.value || dmUploading"
                />
                <Button :disabled="dm.sending.value || dmUploading || (!dmInput.trim() && !dmAttach)" @click="sendDM">Send</Button>
              </div>
            </div>

            <!-- Friend requests panel -->
            <div v-else-if="activeTab === 'requests'" class="dc-friends-panel">
              <header class="dc-friends-toolbar">
                <div class="dc-friends-tabs">
                  <button type="button" class="dc-tab" @click="activeTab = 'friends'">Friends</button>
                  <button type="button" class="dc-tab" @click="activeTab = 'online'">Online</button>
                  <button type="button" class="dc-tab active">
                    Pending
                    <span v-if="requests.length" class="dc-badge danger">{{ requests.length }}</span>
                  </button>
                  <Button size="sm" @click="addOpen = true">Add Friend</Button>
                </div>
              </header>
              <div class="dc-friends-body">
                <h3 class="dc-list-label">Pending — {{ requests.length }}</h3>
                <div v-if="requests.length" class="dc-friend-list">
                  <div v-for="request in requests" :key="request.id" class="dc-friend-row">
                    <div class="dc-avatar-wrap">
                      <UserAvatar :name="request.display_name || request.username" :src="request.avatar_url || ''" />
                    </div>
                    <div class="dc-friend-meta">
                      <strong>{{ request.display_name }}</strong>
                      <small>@{{ request.username }}</small>
                    </div>
                    <div class="dc-friend-actions">
                      <Button size="sm" @click="acceptRequest(request.id)">Accept</Button>
                      <button type="button" class="ghost-btn" @click="rejectRequest(request.id)">Ignore</button>
                    </div>
                  </div>
                </div>
                <p v-else class="dc-empty-main">No pending friend requests. Wumpus is waiting with you.</p>
              </div>
            </div>

            <!-- Friends / Online list (Discord-style) -->
            <div v-else-if="activeTab === 'friends' || activeTab === 'online'" class="dc-friends-panel">
              <header class="dc-friends-toolbar">
                <div class="dc-friends-tabs">
                  <span class="dc-friends-title">☺ Friends</span>
                  <span class="dc-tab-sep"></span>
                  <button type="button" class="dc-tab" :class="{ active: activeTab === 'online' }" @click="activeTab = 'online'; selectedFriend = null">Online</button>
                  <button type="button" class="dc-tab" :class="{ active: activeTab === 'friends' }" @click="activeTab = 'friends'; selectedFriend = null">All</button>
                  <button type="button" class="dc-tab" @click="activeTab = 'requests'">
                    Pending
                    <span v-if="requests.length" class="dc-badge danger">{{ requests.length }}</span>
                  </button>
                  <Button size="sm" @click="addOpen = true">Add Friend</Button>
                </div>
              </header>

              <!-- Selected friend call workspace -->
              <div v-if="selectedFriend" class="dc-friends-body friend-workspace">
                <button type="button" class="ghost-btn" style="margin-bottom:12px" @click="clearSelection">← Back to friends</button>
                <div class="call-toolbar">
                  <div>
                    <p class="kicker">DIRECT CALL</p>
                    <strong>{{ selectedFriend.display_name }}</strong>
                    <small>@{{ selectedFriend.username }}</small>
                  </div>
                  <div class="head-actions">
                    <Button size="sm" @click="openDMWith(selectedFriend.id)">Message</Button>
                    <span class="connection-note">
                      {{ isInCall ? 'Connected' : (selectedFriend.peer_id || selectedFriend.online) ? 'Available' : 'Offline' }}
                    </span>
                  </div>
                </div>
                <VideoGrid
                  :is-muted="isMuted"
                  :is-camera-on="isCameraOn"
                  :has-remote-stream="hasRemoteStream"
                  @ready="onVideoReady"
                />
                <div class="call-actions">
                  <button class="control-btn" :class="{ active: isMuted }" @click="toggleMute">{{ isMuted ? 'Mic Off' : 'Mute' }}</button>
                  <button class="control-btn" :class="{ active: !isCameraOn }" @click="toggleCamera">{{ isCameraOn ? 'Camera' : 'Cam Off' }}</button>
                  <button v-if="!isInCall" class="gold-btn" :disabled="!selectedFriend.peer_id || !myId" @click="startSelectedCall">Start Call</button>
                  <button v-else class="hangup-btn" @click="endCall">End Call</button>
                </div>
              </div>

              <div v-else class="dc-friends-body">
                <div class="dc-search-bar">
                  <span>⌕</span>
                  <input v-model="search" @keyup.enter="runSearch" placeholder="Search" />
                </div>

                <template v-if="searchResults.length">
                  <h3 class="dc-list-label">Search results</h3>
                  <div class="dc-friend-list">
                    <div v-for="person in searchResults" :key="person.id" class="dc-friend-row">
                      <UserAvatar :name="person.display_name || person.username" :src="person.avatar_url || ''" />
                      <div class="dc-friend-meta">
                        <strong>{{ person.display_name }}</strong>
                        <small>@{{ person.username }}</small>
                      </div>
                      <div class="dc-friend-actions">
                        <button type="button" class="dc-icon-btn" title="Message" @click="openDMWith(person.id)">💬</button>
                        <Button size="sm" @click="sendFriendRequest(person.id)">Add</Button>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <h3 class="dc-list-label">
                    {{ activeTab === 'online' ? 'Online' : 'All friends' }} — {{ visibleFriends.length }}
                  </h3>
                  <div v-if="visibleFriends.length" class="dc-friend-list">
                    <div
                      v-for="friend in visibleFriends"
                      :key="friend.id"
                      class="dc-friend-row"
                      @click="selectFriend(friend)"
                      @contextmenu="onUserContextMenu($event, friend.id)"
                    >
                      <div class="dc-avatar-wrap">
                        <UserAvatar :name="friend.display_name || friend.username" :src="friend.avatar_url || ''" />
                        <span class="dc-status-dot" :class="{ on: friend.peer_id || friend.online }"></span>
                      </div>
                      <div class="dc-friend-meta">
                        <strong>{{ friend.display_name }}</strong>
                        <small>
                          {{ friend.custom_status || ((friend.peer_id || friend.online) ? 'Online' : 'Offline') }}
                        </small>
                      </div>
                      <div class="dc-friend-actions" @click.stop>
                        <button type="button" class="dc-icon-btn" title="Message" @click="openDMWith(friend.id)">💬</button>
                        <button type="button" class="dc-icon-btn" title="More" @click="onUserContextMenu($event, friend.id)">⋮</button>
                      </div>
                    </div>
                  </div>
                  <p v-else class="dc-empty-main">
                    {{ activeTab === 'online' ? 'No friends are online right now.' : 'No friends yet. Add someone to get started.' }}
                  </p>
                </template>
              </div>
            </div>
          </template>
        </section>
      </main>

    <Dialog :open="addOpen" title="Add a friend" description="Search by username to send a request or start a chat." @close="addOpen = false">
      <div class="flex gap-2 mt-2">
        <Input v-model="search" placeholder="Search username…" class="flex-1" @keyup.enter="runSearch" />
        <Button @click="runSearch">Search</Button>
      </div>
      <div class="mt-4 space-y-2 max-h-64 overflow-auto">
        <div v-for="person in searchResults" :key="person.id" class="flex items-center gap-3 rounded-lg border border-[var(--wc-border)] p-2">
          <UserAvatar :name="person.display_name || person.username" :src="person.avatar_url || ''" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">{{ person.display_name }}</p>
            <p class="text-xs text-[var(--wc-muted)]">@{{ person.username }}</p>
          </div>
          <Button variant="ghost" size="sm" @click="openDMWith(person.id); addOpen=false">Message</Button>
          <Button size="sm" @click="sendFriendRequest(person.id)">Add</Button>
        </div>
        <p v-if="searchPerformed && !searchResults.length" class="text-center text-sm text-[var(--wc-muted)] py-6">No people found.</p>
      </div>
    </Dialog>

    <!-- Create Server Modal -->
    <div v-if="createOpen" class="modal-backdrop" @click.self="createOpen = false">
      <section class="modal">
        <button class="close-btn" @click="createOpen = false">×</button>
        <p class="kicker">COMMUNITY</p>
        <h2>Create a Server</h2>
        <p class="modal-sub">Your community space. You will be the owner.</p>
        <div class="form-stack">
          <label>
            <span>Server name</span>
            <input v-model="createForm.name" maxlength="100" placeholder="e.g. Night Circle" @keyup.enter="submitCreate" />
          </label>
          <label>
            <span>Icon URL <small>(optional)</small></span>
            <input v-model="createForm.icon_url" placeholder="https://…" />
          </label>
          <p v-if="createError" class="form-error">{{ createError }}</p>
          <Button class="w-full" :disabled="createLoading || !createForm.name.trim()" @click="submitCreate">
            {{ createLoading ? 'Creating…' : 'Create Server' }}
          </Button>
        </div>
      </section>
    </div>

    <!-- Join Server Modal -->
    <div v-if="joinOpen" class="modal-backdrop" @click.self="joinOpen = false">
      <section class="modal">
        <button class="close-btn" @click="joinOpen = false">×</button>
        <p class="kicker">COMMUNITY</p>
        <h2>Join a Server</h2>
        <p class="modal-sub">Paste an invitation code or invite link.</p>
        <div class="form-stack">
          <label>
            <span>Invitation code</span>
            <input v-model="joinCode" placeholder="e.g. AB12CD34" @keyup.enter="submitJoin" />
          </label>
          <p v-if="joinError" class="form-error">{{ joinError }}</p>
          <Button class="w-full" :disabled="joinLoading || !joinCode.trim()" @click="submitJoin">
            {{ joinLoading ? 'Joining…' : 'Join Server' }}
          </Button>
        </div>
      </section>
    </div>

    <!-- Server Settings Modal -->
    <div v-if="serverSettingsOpen" class="modal-backdrop" @click.self="serverSettingsOpen = false">
      <section class="modal wide">
        <button class="close-btn" @click="serverSettingsOpen = false">×</button>
        <p class="kicker">SERVER SETTINGS</p>
        <h2>{{ activeServer?.name }}</h2>
        <p class="modal-sub">Your role: {{ myRole }}</p>

        <div class="settings-tabs">
          <button :class="{ active: settingsTab === 'general' }" @click="settingsTab = 'general'">General</button>
          <button :class="{ active: settingsTab === 'invites' }" @click="settingsTab = 'invites'; loadInvites()">Invites</button>
          <button :class="{ active: settingsTab === 'members' }" @click="settingsTab = 'members'; loadServerMembers()">Members</button>
          <button :class="{ active: settingsTab === 'danger' }" @click="settingsTab = 'danger'">Danger</button>
        </div>

        <!-- General -->
        <div v-if="settingsTab === 'general'" class="form-stack">
          <label>
            <span>Server name</span>
            <input v-model="editForm.name" maxlength="100" :disabled="!canManage" />
          </label>
          <label>
            <span>Icon URL</span>
            <input v-model="editForm.icon_url" :disabled="!canManage" placeholder="https://…" />
          </label>
          <p v-if="editError" class="form-error">{{ editError }}</p>
          <button v-if="canManage" class="gold-btn full" :disabled="editLoading" @click="submitEdit">
            {{ editLoading ? 'Saving…' : 'Save Changes' }}
          </button>
          <p v-else class="muted-line">Only owner or admin can edit settings.</p>
        </div>

        <!-- Invites -->
        <div v-if="settingsTab === 'invites'" class="form-stack">
          <button v-if="canManage" class="gold-btn" :disabled="inviteLoading" @click="createNewInvite">
            {{ inviteLoading ? 'Creating…' : '＋ Create Invite' }}
          </button>
          <p v-if="inviteError" class="form-error">{{ inviteError }}</p>
          <div v-if="lastInviteCode" class="invite-code-box">
            <span>New code:</span>
            <code>{{ lastInviteCode }}</code>
            <button class="ghost-btn" @click="copyInvite(lastInviteCode)">Copy</button>
          </div>
          <div v-for="inv in invites" :key="inv.code" class="invite-row">
            <code>{{ inv.code }}</code>
            <small>uses {{ inv.uses }}{{ inv.max_uses ? ' / ' + inv.max_uses : '' }}</small>
            <button class="ghost-btn" @click="copyInvite(inv.code)">Copy</button>
          </div>
          <p v-if="!invites.length && !lastInviteCode" class="muted-line">No invites yet.</p>
        </div>

        <!-- Members -->
        <div v-if="settingsTab === 'members'" class="member-list settings-members">
          <div v-for="m in members" :key="m.user_id" class="member-row" @click="openUserProfile(m.user_id)">
            <UserAvatar size="sm" :name="m.display_name || m.username" :src="m.avatar_url || ''" />
            <div class="member-copy">
              <strong>{{ m.display_name || m.username }}</strong>
              <small>@{{ m.username }} · {{ m.role }}</small>
            </div>
            <span class="presence" :class="{ on: m.online }"></span>
          </div>
        </div>

        <!-- Danger -->
        <div v-if="settingsTab === 'danger'" class="form-stack danger-zone">
          <template v-if="myRole === 'OWNER'">
            <p class="muted-line">Deleting a server is permanent. All channels and messages will be removed.</p>
            <button class="hangup-btn full" :disabled="deleteLoading" @click="confirmDeleteServer">
              {{ deleteLoading ? 'Deleting…' : 'Delete Server' }}
            </button>
          </template>
          <template v-else>
            <p class="muted-line">Leave this server. You can rejoin later with an invite.</p>
            <button class="hangup-btn full" :disabled="leaveLoading" @click="confirmLeaveServer">
              {{ leaveLoading ? 'Leaving…' : 'Leave Server' }}
            </button>
          </template>
          <p v-if="dangerError" class="form-error">{{ dangerError }}</p>
        </div>
      </section>
    </div>


    <!-- Global floating voice bar — persists across all views -->
    <div v-if="isAuthenticated && voice.isInVoice.value" class="floating-voice-bar">
      <button class="fv-jump" @click="jumpToVoiceChannel" title="Go to voice channel">
        <span class="fv-dot" :class="voice.connectionState.value.toLowerCase()"></span>
        <div class="fv-meta">
          <strong>{{ voice.connectionState.value }}</strong>
          <small>🔊 {{ voice.channelName.value }}{{ voice.serverName.value ? ' · ' + voice.serverName.value : '' }}</small>
        </div>
      </button>
      <div class="fv-actions">
        <button :class="{ active: voice.isMuted.value }" title="Mute" @click="voice.toggleMute()">🎤</button>
        <button :class="{ active: voice.isDeafened.value }" title="Deafen" @click="voice.toggleDeafen()">🎧</button>
        <button :class="{ active: voice.isCameraOn.value }" title="Camera" @click="toggleVoiceCamera">📹</button>
        <button :class="{ active: voice.isScreenSharing.value }" title="Share screen" @click="toggleVoiceScreen">🖥</button>
        <button title="Devices" @click="openVoiceDevices">⚙</button>
        <button class="fv-leave" title="Leave voice" @click="leaveVoiceChannel">📞</button>
      </div>
    </div>

    <!-- Voice device picker -->
    <div v-if="voiceDevicesOpen" class="modal-backdrop" @click.self="voiceDevicesOpen = false">
      <section class="modal small">
        <button class="close-btn" @click="voiceDevicesOpen = false">×</button>
        <p class="kicker">VOICE</p>
        <h2>Audio devices</h2>
        <div class="form-stack">
          <label>
            <span>Microphone</span>
            <select v-model="selectedMicId" class="device-select">
              <option value="">Default</option>
              <option v-for="d in audioDevices.mics" :key="d.deviceId" :value="d.deviceId">
                {{ d.label || d.deviceId }}
              </option>
            </select>
          </label>
          <button class="gold-btn full" @click="applyMic">Apply</button>
        </div>
      </section>
    </div>

    <!-- Account Settings Modal -->
    <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false">
      <section class="modal wide">
        <button class="close-btn" @click="settingsOpen = false">×</button>
        <p class="kicker">MY PROFILE</p>
        <h2>Account & Profile</h2>
        <div class="settings-card">
          <span class="avatar large">{{ initials(user.display_name || user.username) }}</span>
          <div>
            <strong>{{ user.display_name }}</strong>
            <p>@{{ user.username }}</p>
            <p class="muted-line">{{ user.email || 'Authenticated account' }}</p>
          </div>
        </div>
        <div class="form-stack ui-form" style="margin-top:16px">
          <div class="ui-field">
            <Label>Display name</Label>
            <Input v-model="myProfileForm.display_name" maxlength="120" />
          </div>
          <div class="ui-field">
            <Label>Bio</Label>
            <Textarea v-model="myProfileForm.bio" :rows="3" placeholder="Tell others about yourself" />
          </div>
          <div class="ui-field">
            <Label>Custom status</Label>
            <Input v-model="myProfileForm.custom_status" placeholder="What are you up to?" />
          </div>
          <div class="ui-field">
            <Label>Avatar URL</Label>
            <Input v-model="myProfileForm.avatar_url" placeholder="https://…" />
          </div>
          <div class="ui-field">
            <Label>Banner URL</Label>
            <Input v-model="myProfileForm.banner_url" placeholder="https://…" />
          </div>
          <Separator class="my-2" />
          <div class="ui-field">
            <Label>Who can send friend requests</Label>
            <Select v-model="myProfileForm.privacy_friend_request">
              <option value="everyone">Everyone</option>
              <option value="server_members">Server Members</option>
              <option value="friends_of_friends">Friends of Friends</option>
              <option value="nobody">Nobody</option>
            </Select>
          </div>
          <div class="ui-field">
            <Label>Who can DM you</Label>
            <Select v-model="myProfileForm.privacy_dm">
              <option value="everyone">Everyone</option>
              <option value="server_members">Server Members</option>
              <option value="friends_only">Friends Only</option>
              <option value="nobody">Nobody</option>
            </Select>
          </div>
          <div class="ui-field">
            <Label>Profile visibility</Label>
            <Select v-model="myProfileForm.privacy_profile">
              <option value="public">Public</option>
              <option value="friends_only">Friends Only</option>
            </Select>
          </div>
          <Alert v-if="myProfileError" variant="destructive">{{ myProfileError }}</Alert>
          <Button class="w-full" :disabled="myProfileLoading" @click="saveMyProfile">
            {{ myProfileLoading ? 'Saving…' : 'Save Profile' }}
          </Button>

          <div class="appearance-block">
            <p class="kicker">APPEARANCE</p>
            <p class="settings-help" style="margin-top:6px">Theme only changes background surfaces. Gold & maroon stay the same.</p>
            <div class="theme-picks">
              <button type="button" class="theme-pick" :class="{ active: theme === 'dark' }" @click="setTheme('dark')">
                <span class="theme-swatch dark-swatch"></span>
                Dark
                <Badge v-if="theme === 'dark'" variant="gold">Active</Badge>
              </button>
              <button type="button" class="theme-pick" :class="{ active: theme === 'light' }" @click="setTheme('light')">
                <span class="theme-swatch light-swatch"></span>
                Light
                <Badge v-if="theme === 'light'" variant="gold">Active</Badge>
              </button>
              <button type="button" class="theme-pick" :class="{ active: theme === 'system' }" @click="setTheme('system')">
                <span class="theme-swatch system-swatch"></span>
                System
                <Badge v-if="theme === 'system'" variant="gold">Active</Badge>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <Dialog :open="groupOpen" title="New group DM" description="Select friends and name your group." @close="groupOpen = false">
      <div class="ui-field mt-2">
        <Label>Group name</Label>
        <Input v-model="groupName" placeholder="Study group" />
      </div>
      <div class="mt-3 space-y-1 max-h-48 overflow-auto">
        <label v-for="f in friends" :key="f.id" class="flex items-center gap-2 p-2 rounded hover:bg-[var(--wc-surface-2)] cursor-pointer">
          <input type="checkbox" :value="f.id" v-model="groupSelected" />
          <UserAvatar size="sm" :name="f.display_name || f.username" :src="f.avatar_url || ''" />
          <span class="text-sm">{{ f.display_name }}</span>
        </label>
      </div>
      <Button class="w-full mt-3" :disabled="groupSelected.length < 1" @click="submitGroup">Create group</Button>
    </Dialog>

    <UserProfileCard
      :open="profileOpen"
      :user-id="profileUserId"
      :self-id="user?.id || ''"
      @close="profileOpen = false"
      @message="openDMWith"
      @changed="loadFriends"
    />
    <UserContextMenu
      :open="ctxMenu.open"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :relationship="ctxMenu.relationship"
      @view-profile="ctxAction('view')"
      @message="ctxAction('message')"
      @add-friend="ctxAction('add')"
      @cancel-request="ctxAction('cancel')"
      @accept="ctxAction('accept')"
      @decline="ctxAction('decline')"
      @remove-friend="ctxAction('remove')"
      @block="ctxAction('block')"
      @unblock="ctxAction('unblock')"
    />
  </div>
</template>


<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import VideoGrid from '@/components/VideoGrid.vue'
import { useAuth } from '@/composables/useAuth'
import { api } from '@/lib/api'
import { usePeerCall } from '@/composables/usePeerCall'
import { useVoiceChannel } from '@/composables/useVoiceChannel'
import { useDM } from '@/composables/useDM'
import { useNotifications } from '@/composables/useNotifications'
import UserProfileCard from '@/components/user/UserProfileCard.vue'
import UserContextMenu from '@/components/user/UserContextMenu.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Select from '@/components/ui/Select.vue'
import Label from '@/components/ui/Label.vue'
import Separator from '@/components/ui/Separator.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import Alert from '@/components/ui/Alert.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownItem from '@/components/ui/DropdownItem.vue'
import { useTheme } from '@/composables/useTheme'

const { user, isAuthenticated, restore, logout } = useAuth()

// —— Friends state ——
const activeTab = ref('friends')
const friends = ref([])
const requests = ref([])
const selectedFriend = ref(null)
const search = ref('')
const globalSearch = ref('')
const searchResults = ref([])
const searchPerformed = ref(false)
const searchError = ref('')
const addOpen = ref(false)
const settingsOpen = ref(false)
const chatInput = ref('')
const messagesContainer = ref(null)
const hasRemoteStream = ref(false)
let heartbeatTimer = null
let pollTimer = null

// —— Server state ——
const servers = ref([])
const activeServerId = ref(null)
const activeServer = ref(null)
const channels = ref([])
const selectedChannelId = ref(null)
const selectedChannel = ref(null)
const members = ref([])
const membersLoading = ref(false)
const channelMessages = ref([])
const channelLoading = ref(false)
const channelError = ref('')
const channelInput = ref('')
const channelTypingName = ref('')
let channelTypingTimer = null
const groupOpen = ref(false)
const groupName = ref('')
const groupSelected = ref([])

const channelReplyTo = ref(null)
const channelEditId = ref(null)
const channelEditText = ref('')
const channelAttach = ref(null)
const channelUploading = ref(false)
const dmAttach = ref(null)
const dmUploading = ref(false)
const fileInputChannel = ref(null)
const fileInputDm = ref(null)
const channelSending = ref(false)
const channelMsgBox = ref(null)
const myRole = ref('')

// Modals
const createOpen = ref(false)
const createForm = ref({ name: '', icon_url: '' })
const createLoading = ref(false)
const createError = ref('')

const joinOpen = ref(false)
const joinCode = ref('')
const joinLoading = ref(false)
const joinError = ref('')

const serverSettingsOpen = ref(false)
const settingsTab = ref('general')
const editForm = ref({ name: '', icon_url: '' })
const editLoading = ref(false)
const editError = ref('')
const invites = ref([])
const inviteLoading = ref(false)
const inviteError = ref('')
const lastInviteCode = ref('')
const deleteLoading = ref(false)
const leaveLoading = ref(false)
const dangerError = ref('')

const toast = ref(null)
let toastTimer = null

const {
  myId, isInCall, isMuted, isCameraOn, messages, localStream,
  startPresence, init, startCall, endCall, toggleMute, toggleCamera, sendMessage, destroy
} = usePeerCall()

const voice = useVoiceChannel()
const { theme, setTheme } = useTheme()
const dm = useDM()
const notifications = useNotifications()
const dmInput = ref('')
const dmSearchOpen = ref(false)
const dmEditId = ref(null)
const dmEditText = ref('')
const profileOpen = ref(false)
const profileUserId = ref('')
const ctxMenu = ref({ open: false, x: 0, y: 0, userId: '', relationship: 'NONE' })
const myProfileForm = ref({
  display_name: '', bio: '', avatar_url: '', banner_url: '', custom_status: '',
  privacy_friend_request: 'everyone', privacy_dm: 'everyone', privacy_profile: 'public'
})
const myProfileLoading = ref(false)
const myProfileError = ref('')

const voiceDevicesOpen = ref(false)
const audioDevices = ref({ mics: [], speakers: [] })
const selectedMicId = ref('')

const onlineCount = computed(() => friends.value.filter(f => f.peer_id || f.online).length)
const visibleFriends = computed(() =>
  activeTab.value === 'online' ? friends.value.filter(f => f.peer_id || f.online) : friends.value
)
const canManage = computed(() => myRole.value === 'OWNER' || myRole.value === 'ADMIN')

const channelCategories = computed(() => {
  const map = new Map()
  for (const ch of channels.value) {
    const cat = ch.category || (ch.type === 'voice' ? 'VOICE CHANNELS' : 'TEXT CHANNELS')
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(ch)
  }
  return Array.from(map.entries()).map(([name, list]) => ({ name, channels: list }))
})

const initials = (name = '') =>
  name
    .split(' ')
    .map(s => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const serverInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .map(s => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

const formatTime = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const showToast = (message, type = 'ok') => {
  toast.value = { message, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 3200)
}

watch(
  () => voice.localPreviewStream.value,
  (stream) => {
    const el = localVoiceVideo.value
    if (el) el.srcObject = stream || null
  }
)

// —— Data loaders ——
const loadFriends = async () => {
  if (!isAuthenticated.value) return
  const [friendData, requestData] = await Promise.all([api.friends(), api.requests()])
  friends.value = friendData.friends || []
  requests.value = requestData.requests || []
}

const loadServers = async () => {
  if (!isAuthenticated.value) return
  try {
    const data = await api.listServers()
    servers.value = data.servers || []
  } catch (err) {
    console.error(err)
  }
}

const loadData = async () => {
  await Promise.all([loadFriends(), loadServers()])
}

const refreshAll = async () => {
  try {
    await loadData()
    if (activeServerId.value) await openServer(activeServerId.value, false)
    showToast('Refreshed')
  } catch (err) {
    console.error(err)
  }
}

// —— Navigation ——


const openUserProfile = (userId) => {
  if (!userId || userId === user.value?.id) {
    // open own settings for self
    settingsOpen.value = true
    loadMyProfileForm()
    return
  }
  profileUserId.value = userId
  profileOpen.value = true
  ctxMenu.value.open = false
}

const onUserContextMenu = async (e, userId) => {
  e.preventDefault()
  if (!userId || userId === user.value?.id) return
  let relationship = 'NONE'
  try {
    const data = await api.getPublicProfile(userId)
    relationship = data.profile?.relationship || 'NONE'
  } catch (_) {}
  ctxMenu.value = {
    open: true,
    x: Math.min(e.clientX, window.innerWidth - 200),
    y: Math.min(e.clientY, window.innerHeight - 260),
    userId,
    relationship
  }
}

const closeCtx = () => { ctxMenu.value.open = false }

const ctxAction = async (action) => {
  const uid = ctxMenu.value.userId
  closeCtx()
  try {
    if (action === 'view') openUserProfile(uid)
    else if (action === 'message') await openDMWith(uid)
    else if (action === 'add') { await api.requestFriend(uid); showToast('Friend request sent') }
    else if (action === 'cancel') { await api.cancelFriendRequest(uid); showToast('Request cancelled') }
    else if (action === 'accept') { await api.acceptFriend(uid); await loadFriends(); showToast('Friend added') }
    else if (action === 'decline') { await api.rejectFriend(uid); await loadFriends() }
    else if (action === 'remove') { await api.removeFriend(uid); await loadFriends(); showToast('Friend removed') }
    else if (action === 'block') { await api.blockUser(uid); showToast('User blocked') }
    else if (action === 'unblock') { await api.unblockUser(uid); showToast('User unblocked') }
  } catch (err) {
    showToast(err.message, 'error')
  }
}

const loadMyProfileForm = async () => {
  myProfileError.value = ''
  try {
    const data = await api.getMyProfile()
    const p = data.profile || {}
    myProfileForm.value = {
      display_name: p.display_name || '',
      bio: p.bio || '',
      avatar_url: p.avatar_url || '',
      banner_url: p.banner_url || '',
      custom_status: p.custom_status || '',
      privacy_friend_request: p.privacy_friend_request || 'everyone',
      privacy_dm: p.privacy_dm || 'everyone',
      privacy_profile: p.privacy_profile || 'public'
    }
  } catch (err) {
    myProfileError.value = err.message
  }
}

const saveMyProfile = async () => {
  myProfileLoading.value = true
  myProfileError.value = ''
  try {
    const data = await api.updateMyProfile(myProfileForm.value)
    if (data.profile && user.value) {
      user.value = {
        ...user.value,
        display_name: data.profile.display_name,
        username: data.profile.username,
        avatar_url: data.profile.avatar_url || ''
      }
    }
    showToast('Profile saved')
  } catch (err) {
    myProfileError.value = err.message
  } finally {
    myProfileLoading.value = false
  }
}

const openDMWith = async (userId) => {
  try {
    goHome()
    activeTab.value = 'friends'
    selectedFriend.value = null
    await dm.startDM(userId)
    showToast('Conversation opened')
  } catch (err) {
    showToast(err.message || 'Cannot open DM', 'error')
  }
}

const sendDM = async () => {
  const text = dmInput.value
  if (!text.trim() && !dmAttach.value && !dm.replyTo.value) return
  try {
    const attachment = dmAttach.value
      ? { url: dmAttach.value.url, type: dmAttach.value.type }
      : null
    await dm.sendMessage(text, attachment)
    dmInput.value = ''
    dmAttach.value = null
  } catch (err) {
    showToast(err.message, 'error')
  }
}

const startChannelEdit = (msg) => {
  channelEditId.value = msg.id
  channelEditText.value = msg.content || ''
}
const saveChannelEdit = async () => {
  if (!channelEditId.value) return
  try {
    await api.updateChannelMessage(channelEditId.value, channelEditText.value)
    channelEditId.value = null
    channelEditText.value = ''
    await loadChannelMessages()
  } catch (err) {
    showToast(err.message, 'error')
  }
}
const removeChannelMsg = async (msg) => {
  if (!confirm('Delete this message?')) return
  try {
    await api.deleteChannelMessage(msg.id)
    await loadChannelMessages()
  } catch (err) {
    showToast(err.message, 'error')
  }
}
const reactChannel = async (msg, emoji) => {
  try {
    const data = await api.reactChannelMessage(msg.id, emoji)
    const idx = channelMessages.value.findIndex((m) => m.id === msg.id)
    if (idx >= 0) channelMessages.value[idx] = { ...channelMessages.value[idx], reactions: data.reactions || [] }
  } catch (err) {
    showToast(err.message, 'error')
  }
}

const onDMInput = () => {
  dm.sendTyping()
}

const startEditDM = (msg) => {
  dmEditId.value = msg.id
  dmEditText.value = msg.content || ''
}

const saveEditDM = async () => {
  if (!dmEditId.value) return
  try {
    await dm.editMessage(dmEditId.value, dmEditText.value)
    dmEditId.value = null
    dmEditText.value = ''
  } catch (err) {
    showToast(err.message, 'error')
  }
}

const removeDM = async (msg) => {
  if (!confirm('Delete this message?')) return
  try {
    await dm.deleteMessage(msg.id)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

const reactDM = async (msg, emoji) => {
  try {
    await dm.react(msg.id, emoji)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

const blockActivePeer = async () => {
  if (!confirm('Block this user? They will not be able to message you.')) return
  try {
    await dm.blockPeer()
    showToast('User blocked')
    dm.closeConversation()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

const goHome = () => {
  // Voice stays connected (Discord-style) while browsing friends / DMs
  activeServerId.value = null
  activeServer.value = null
  channels.value = []
  selectedChannelId.value = null
  selectedChannel.value = null
  members.value = []
  channelMessages.value = []
  myRole.value = ''
}

const selectServer = async (id) => {
  if (isInCall.value) endCall()
  hasRemoteStream.value = false
  selectedFriend.value = null
  dm.closeConversation()
  // Voice stays connected across server navigation
  await openServer(id)
}

const openServer = async (id, showLoadToast = false) => {
  activeServerId.value = id
  channelLoading.value = true
  channelError.value = ''
  try {
    const data = await api.getServer(id)
    activeServer.value = data.server
    channels.value = data.channels || []
    myRole.value = data.role || data.server?.user_role || 'MEMBER'

    // Default to #general or first text channel
    let target = channels.value.find(c => c.name === 'general' && c.type === 'text')
    if (!target) target = channels.value.find(c => c.type === 'text')
    if (!target) target = channels.value[0] || null

    if (target) {
      selectedChannelId.value = target.id
      selectedChannel.value = target
      if (target.type === 'text') await loadChannelMessages(id, target.id)
      else channelMessages.value = []
    } else {
      selectedChannelId.value = null
      selectedChannel.value = null
      channelMessages.value = []
    }

    await loadServerMembers()
    if (showLoadToast) showToast(`Entered ${activeServer.value.name}`)
  } catch (err) {
    channelError.value = err.message
    showToast(err.message, 'error')
  } finally {
    channelLoading.value = false
  }
}

const selectChannel = async (ch) => {
  selectedChannelId.value = ch.id
  selectedChannel.value = ch
  channelError.value = ''
  if (ch.type === 'text' && activeServerId.value) {
    await loadChannelMessages(activeServerId.value, ch.id)
  } else {
    channelMessages.value = []
  }
  // Auto-join voice when clicking a voice channel
  if (ch.type === 'voice' && activeServerId.value) {
    await joinVoiceChannel(ch)
  }
}

const joinVoiceChannel = async (ch) => {
  if (!ch || ch.type !== 'voice') return
  // Already in this channel — stay connected
  if (voice.channelId.value === ch.id && voice.isInVoice.value) return
  try {
    // Switching voice channel: re-join room (peer identity reused when possible)
    await voice.join({
      channelId: ch.id,
      channelName: ch.name,
      serverId: activeServerId.value,
      serverName: activeServer.value?.name || '',
      userId: user.value?.id
    })
    showToast(`Joined voice: ${ch.name}`)
  } catch (err) {
    showToast(err.message || 'Failed to join voice', 'error')
  }
}

const toggleVoiceCamera = async () => {
  try {
    await voice.toggleCamera()
  } catch (err) {
    showToast(err.message || 'Camera error', 'error')
  }
}

const toggleVoiceScreen = async () => {
  try {
    await voice.toggleScreenShare()
  } catch (err) {
    showToast(err.message || 'Screen share error', 'error')
  }
}

const jumpToVoiceChannel = async () => {
  if (!voice.serverId.value) return
  if (activeServerId.value !== voice.serverId.value) {
    await selectServer(voice.serverId.value)
  }
  const ch = channels.value.find((c) => c.id === voice.channelId.value)
  if (ch) {
    selectedChannelId.value = ch.id
    selectedChannel.value = ch
  }
}

const leaveVoiceChannel = async () => {
  try {
    await voice.leave()
    showToast('Left voice channel')
  } catch (err) {
    showToast(err.message || 'Leave failed', 'error')
  }
}

const openVoiceDevices = async () => {
  voiceDevicesOpen.value = true
  audioDevices.value = await voice.listAudioDevices()
}

const applyMic = async () => {
  await voice.switchMicrophone(selectedMicId.value || undefined)
  voiceDevicesOpen.value = false
  showToast('Microphone updated')
}

const loadChannelMessages = async (serverId, channelId) => {
  channelLoading.value = true
  channelError.value = ''
  try {
    const data = await api.listChannelMessages(serverId, channelId)
    channelMessages.value = data.messages || []
    await nextTick()
    if (channelMsgBox.value) channelMsgBox.value.scrollTop = channelMsgBox.value.scrollHeight
  } catch (err) {
    channelError.value = err.message
  } finally {
    channelLoading.value = false
  }
}

const absUrl = (u) => {
  if (!u) return ''
  if (u.startsWith('http')) return u
  return `${api.url}${u}`
}
const isImageAtt = (msg) => {
  const t = (msg.attachment_type || '').toLowerCase()
  return t === 'image' || t.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(msg.attachment_url || '')
}
const openAttach = (url) => { window.open(absUrl(url), '_blank', 'noopener') }

const onChannelFile = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  channelUploading.value = true
  try {
    const data = await api.uploadFile(file)
    channelAttach.value = { url: data.url, type: data.type || data.mime_type, filename: data.filename || file.name }
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    channelUploading.value = false
  }
}

const onDmFile = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  dmUploading.value = true
  try {
    const data = await api.uploadFile(file)
    dmAttach.value = { url: data.url, type: data.type || data.mime_type, filename: data.filename || file.name }
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    dmUploading.value = false
  }
}


const onPresence = (e) => {
  const { user_id, online } = e.detail || {}
  if (!user_id) return
  const apply = (list) => {
    const i = list.findIndex((x) => x.id === user_id)
    if (i >= 0) list[i] = { ...list[i], online: !!online, peer_id: online ? list[i].peer_id : '' }
  }
  apply(friends.value)
  // members
  const mi = members.value.findIndex((x) => x.id === user_id || x.user_id === user_id)
  if (mi >= 0) members.value[mi] = { ...members.value[mi], online: !!online }
}
const onChannelTypingEvt = (e) => {
  const msg = e.detail || {}
  if (msg.channel_id !== activeChannelId.value) return
  if (msg.user_id === user.value?.id) return
  const m = members.value.find((x) => x.id === msg.user_id || x.user_id === msg.user_id)
  channelTypingName.value = m?.display_name || m?.username || 'Someone'
  if (channelTypingTimer) clearTimeout(channelTypingTimer)
  channelTypingTimer = setTimeout(() => { channelTypingName.value = '' }, 3000)
}
const sendChannelTyping = () => {
  if (!activeServerId.value || !activeChannelId.value) return
  const targets = members.value.map((m) => m.id || m.user_id).filter(Boolean)
  dm.sendRaw?.({
    type: 'channel:typing',
    server_id: activeServerId.value,
    channel_id: activeChannelId.value,
    targets
  })
}
const onNotifClick = async (n) => {
  await notifications.markRead(n.id)
  notifications.open.value = false
  if (n.ref_type === 'conversation' && n.ref_id) {
    await dm.openConversation(n.ref_id)
  }
}
const submitGroup = async () => {
  try {
    await dm.createGroup(groupSelected.value, groupName.value || 'Group')
    groupOpen.value = false
    groupSelected.value = []
    groupName.value = ''
    showToast('Group created')
  } catch (err) {
    showToast(err.message, 'error')
  }
}

const sendChannelMessage = async () => {
  const text = channelInput.value.trim()
  if ((!text && !channelAttach.value) || !activeServerId.value || !activeChannelId.value) return
  channelSending.value = true
  try {
    await api.createChannelMessage(activeServerId.value, activeChannelId.value, {
      content: text,
      attachment_url: channelAttach.value?.url || '',
      attachment_type: channelAttach.value?.type || '',
      reply_to_id: channelReplyTo.value?.id || ''
    })
    channelInput.value = ''
    channelAttach.value = null
    channelReplyTo.value = null
    await loadChannelMessages()
    await nextTick()
    if (channelMsgBox.value) channelMsgBox.value.scrollTop = channelMsgBox.value.scrollHeight
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    channelSending.value = false
  }
}

const loadServerMembers = async () => {
  if (!activeServerId.value) return
  membersLoading.value = true
  try {
    const data = await api.listMembers(activeServerId.value)
    members.value = data.members || []
  } catch (err) {
    console.error(err)
  } finally {
    membersLoading.value = false
  }
}

// —— Create / Join ——
const submitCreate = async () => {
  createError.value = ''
  createLoading.value = true
  try {
    const data = await api.createServer({
      name: createForm.value.name.trim(),
      icon_url: createForm.value.icon_url.trim()
    })
    createOpen.value = false
    createForm.value = { name: '', icon_url: '' }
    await loadServers()
    if (data.server?.id) await selectServer(data.server.id)
    showToast('Server created')
  } catch (err) {
    createError.value = err.message
  } finally {
    createLoading.value = false
  }
}

const submitJoin = async () => {
  joinError.value = ''
  joinLoading.value = true
  try {
    const data = await api.joinServerByInvite(joinCode.value.trim())
    joinOpen.value = false
    joinCode.value = ''
    await loadServers()
    if (data.server?.id) await selectServer(data.server.id)
    showToast(`Joined ${data.server?.name || 'server'}`)
  } catch (err) {
    joinError.value = err.message
  } finally {
    joinLoading.value = false
  }
}

// —— Server settings ——
const openServerSettings = () => {
  if (!activeServer.value) return
  editForm.value = {
    name: activeServer.value.name || '',
    icon_url: activeServer.value.icon_url || ''
  }
  editError.value = ''
  dangerError.value = ''
  settingsTab.value = 'general'
  lastInviteCode.value = ''
  serverSettingsOpen.value = true
}

const submitEdit = async () => {
  if (!activeServerId.value) return
  editError.value = ''
  editLoading.value = true
  try {
    const data = await api.updateServer(activeServerId.value, {
      name: editForm.value.name.trim(),
      icon_url: editForm.value.icon_url.trim()
    })
    activeServer.value = data.server
    await loadServers()
    showToast('Server updated')
  } catch (err) {
    editError.value = err.message
  } finally {
    editLoading.value = false
  }
}

const loadInvites = async () => {
  if (!activeServerId.value || !canManage.value) return
  inviteError.value = ''
  try {
    const data = await api.listInvites(activeServerId.value)
    invites.value = data.invites || []
  } catch (err) {
    inviteError.value = err.message
  }
}

const createNewInvite = async () => {
  if (!activeServerId.value) return
  inviteLoading.value = true
  inviteError.value = ''
  try {
    const data = await api.createInvite(activeServerId.value, 0)
    lastInviteCode.value = data.invite?.code || ''
    await loadInvites()
    showToast('Invite created')
  } catch (err) {
    inviteError.value = err.message
  } finally {
    inviteLoading.value = false
  }
}

const copyInvite = async (code) => {
  try {
    await navigator.clipboard.writeText(code)
    showToast('Copied to clipboard')
  } catch {
    showToast(code)
  }
}

const confirmDeleteServer = async () => {
  if (!activeServerId.value) return
  if (!confirm('Delete this server permanently?')) return
  deleteLoading.value = true
  dangerError.value = ''
  try {
    await api.deleteServer(activeServerId.value)
    serverSettingsOpen.value = false
    goHome()
    await loadServers()
    showToast('Server deleted')
  } catch (err) {
    dangerError.value = err.message
  } finally {
    deleteLoading.value = false
  }
}

const confirmLeaveServer = async () => {
  if (!activeServerId.value) return
  if (!confirm('Leave this server?')) return
  leaveLoading.value = true
  dangerError.value = ''
  try {
    await api.leaveServer(activeServerId.value)
    serverSettingsOpen.value = false
    goHome()
    await loadServers()
    showToast('Left server')
  } catch (err) {
    dangerError.value = err.message
  } finally {
    leaveLoading.value = false
  }
}

// —— Friends helpers ——
const selectFriend = (friend) => {
  if (isInCall.value) endCall()
  hasRemoteStream.value = false
  selectedFriend.value = friend
}
const clearSelection = () => {
  endCall()
  hasRemoteStream.value = false
  selectedFriend.value = null
}

const runSearch = async () => {
  searchError.value = ''
  searchPerformed.value = true
  try {
    searchResults.value = (await api.searchUsers(search.value)).users || []
  } catch (err) {
    searchError.value = err.message
  }
}
const runGlobalSearch = async () => {
  search.value = globalSearch.value
  addOpen.value = true
  await runSearch()
}
const sendFriendRequest = async (id) => {
  try {
    await api.requestFriend(id)
    searchError.value = 'Friend request sent.'
    await loadFriends()
  } catch (err) {
    searchError.value = err.message
  }
}
const acceptRequest = async (id) => {
  await api.acceptFriend(id)
  await loadFriends()
}
const rejectRequest = async (id) => {
  await api.rejectFriend(id)
  await loadFriends()
}

const onVideoReady = async (localVideo, remoteVideo) => {
  try {
    await init(localVideo, remoteVideo, () => {
      hasRemoteStream.value = true
    })
    if (myId.value) await api.updatePeer(myId.value)
  } catch (err) {
    console.error(err)
  }
}

const startSelectedCall = () => {
  if (!selectedFriend.value?.peer_id) return
  startCall(selectedFriend.value.peer_id)
}
const sendChat = () => {
  if (chatInput.value.trim()) {
    sendMessage(chatInput.value.trim())
    chatInput.value = ''
  }
}
watch(
  messages,
  () =>
    requestAnimationFrame(() => {
      if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }),
  { deep: true }
)

const logoutNow = async () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (pollTimer) clearInterval(pollTimer)
  try {
    if (voice.isInVoice.value) await voice.leave()
  } catch (err) { console.error(err) }
  try { dm.disconnectRealtime() } catch (err) { console.error(err) }
  try {
    await api.clearPeer()
  } catch (err) {
    console.error(err)
  }
  destroy()
  logout()
  window.location.reload()
}

const beginSession = async () => {
  await loadData()
  try {
    await dm.loadConversations()
    if (user.value?.id) dm.connectRealtime(user.value.id)
  } catch (err) { console.error(err) }
  startPresence()
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (pollTimer) clearInterval(pollTimer)
  heartbeatTimer = setInterval(async () => {
    if (!isAuthenticated.value) return
    if (myId.value) {
      try {
        await api.updatePeer(myId.value)
      } catch (err) {
        console.error(err)
      }
    }
  }, 20000)
  pollTimer = setInterval(async () => {
    if (!isAuthenticated.value) return
    try {
      await loadFriends()
      if (activeServerId.value) await loadServerMembers()
    } catch (err) {
      console.error(err)
    }
  }, 8000)
}

watch(myId, async (value) => {
  if (value && isAuthenticated.value) {
    try {
      await api.updatePeer(value)
      await loadFriends()
    } catch (err) {
      console.error(err)
    }
  }
})

onMounted(async () => {
  window.addEventListener('webcall:presence', onPresence)
  window.addEventListener('webcall:channel-typing', onChannelTypingEvt)
  notifications.load()

  const restored = await restore()
  if (restored) await beginSession()
})

watch(isAuthenticated, async (ok) => {
  if (ok) await beginSession()
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Playfair+Display:wght@400;600&family=Inter:wght@400;500;600;700&display=swap');
:root,html.dark,[data-theme="dark"]{
  --bg:var(--wc-bg, #0A0A0A);
  --surface:var(--wc-surface, #171717);
  --surface-2:var(--wc-surface-2, #222222);
  --foreground:var(--wc-fg, #FFFFFF);
  --muted-fg:var(--wc-muted, #A3A3A3);
  --gold:var(--wc-gold, #D4AF37);
  --gold-light:var(--wc-gold, #E8C84A);
  --gold-dark:#A67C00;
  --maroon:var(--wc-maroon, #800000);
  --maroon-dark:var(--wc-maroon-dark, #5C0000);
  --maroon-light:#9A1A1A;
  --border:var(--wc-border, #2A2A2A);
  --line:color-mix(in srgb, var(--wc-gold, #D4AF37) 18%, transparent);
  --cream:var(--wc-fg, #F5F0E6);
  --text:var(--foreground);
  --muted:var(--muted-fg);
  --card-bg:var(--wc-surface, #171717);
  --sidebar-bg:var(--wc-surface, #171717);
  --input-bg:color-mix(in srgb, var(--wc-fg) 6%, transparent);
  --modal-bg:var(--wc-surface, #171717);
  --hover:color-mix(in srgb, var(--wc-maroon) 18%, transparent);
  --primary:var(--maroon);
  --primary-hover:var(--wc-maroon-dark, #9A1A1A);
  --shadow:0 22px 50px rgba(0,0,0,.45);
  --toast-bg:var(--wc-surface, #171717);
  --kicker:color-mix(in srgb, var(--wc-gold) 55%, transparent);
  --label:color-mix(in srgb, var(--wc-gold) 40%, transparent);
  --muted-fg-soft:color-mix(in srgb, var(--wc-muted) 70%, transparent);
  color-scheme:dark;
}
html.light,[data-theme="light"]{
  --bg:var(--wc-bg, #FAFAFA);
  --surface:var(--wc-surface, #FFFFFF);
  --surface-2:var(--wc-surface-2, #F1F1F1);
  --foreground:var(--wc-fg, #171717);
  --muted-fg:var(--wc-muted, #666666);
  --muted-fg-soft:#737373;
  --gold:var(--wc-gold, #A67C00);
  --gold-light:var(--wc-gold, #A67C00);
  --gold-dark:#6B520F;
  --maroon:var(--wc-maroon, #800000);
  --maroon-dark:var(--wc-maroon-dark, #5C0000);
  --maroon-light:#9A1A1A;
  --border:var(--wc-border, #E5E5E5);
  --line:color-mix(in srgb, var(--wc-maroon) 14%, transparent);
  --cream:var(--wc-fg, #171717);
  --text:var(--foreground);
  --muted:var(--muted-fg);
  --card-bg:var(--wc-surface, #FFFFFF);
  --sidebar-bg:var(--wc-surface, #FFFFFF);
  --input-bg:var(--wc-surface-2, #F1F1F1);
  --modal-bg:var(--wc-surface, #FFFFFF);
  --hover:color-mix(in srgb, var(--wc-maroon) 10%, transparent);
  --primary:var(--maroon);
  --primary-hover:var(--wc-maroon-dark, #9A1A1A);
  --shadow:0 12px 32px rgba(0,0,0,.06);
  --toast-bg:var(--wc-surface, #FFFFFF);
  --kicker:#7A6A2A;
  --label:#6B6B6B;
  color-scheme:light;
}
*{box-sizing:border-box;margin:0;padding:0}
body{min-width:320px;background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;transition:background .2s ease,color .2s ease}
button,input,select,textarea{font:inherit}
.app-shell{min-height:100vh;display:flex;background:radial-gradient(circle at 70% -20%,rgba(212,175,55,.06),transparent 38%),var(--bg)}

/* Server rail */
.server-rail{width:72px;min-width:72px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 0;background:#0a0a0a;border-right:0;overflow-y:auto}
.server-icon{width:48px;height:48px;border-radius:50%;border:1px solid var(--border);background:var(--surface-2);color:var(--gold);font-family:'Cinzel',serif;font-size:13px;font-weight:600;cursor:pointer;display:grid;place-items:center;transition:border-radius .15s,border-color .15s,background .15s;overflow:hidden;padding:0}
.server-icon img{width:100%;height:100%;object-fit:cover}
.server-icon:hover,.server-icon.active{border-radius:16px;border-color:var(--maroon);background:var(--hover)}
.server-icon.active{box-shadow:0 0 0 2px rgba(212,175,55,.25)}
.home-icon{font-size:18px}.add-icon,.join-icon{font-size:18px;color:var(--maroon);background:var(--surface-2)}
.rail-divider{width:32px;height:1px;background:var(--line);margin:4px 0}

.sidebar{width:240px;min-width:240px;display:flex;flex-direction:column;border-right:1px solid var(--border);background:var(--sidebar-bg);backdrop-filter:blur(16px)}.sidebar.dc-sidebar{display:flex;flex-direction:column;min-height:100vh}.sidebar-head{display:flex;align-items:center;justify-content:space-between;padding:22px 18px}.brand{font-family:'Cinzel',serif;color:var(--gold);letter-spacing:4px;font-size:18px}.brand-sub{font-size:8px;letter-spacing:2px;color:var(--label, rgba(240,215,140,.45));margin-top:3px}.icon-btn{width:34px;height:34px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--gold);cursor:pointer}.side-search{display:flex;align-items:center;gap:8px;margin:0 14px 16px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--input-bg)}.side-search span,.top-search span{font-size:20px;color:rgba(240,215,140,.5)}.side-search input,.top-search input{width:100%;border:0;outline:0;background:transparent;color:var(--foreground);font-size:12px}.side-search input::placeholder,.top-search input::placeholder{color:var(--muted-fg-soft, rgba(245,230,200,.28))}
.nav-row{display:grid;gap:4px;padding:0 10px}.nav-row button{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:var(--muted);border-radius:10px;padding:10px 12px;text-align:left;cursor:pointer;font-size:12px}.nav-row button.active,.nav-row button:hover{background:var(--hover);color:var(--foreground)}.nav-row b{margin-left:auto;min-width:20px;padding:2px 6px;border-radius:999px;background:rgba(212,175,55,.14);color:var(--gold);font-size:10px;text-align:center}.list-title{display:flex;justify-content:space-between;padding:22px 16px 8px;font-size:9px;letter-spacing:2px;color:var(--label, rgba(240,215,140,.36))}.list-title span{color:var(--muted-fg-soft, rgba(240,215,140,.26))}.friend-list{padding:0 8px;overflow:auto;flex:1}.friend-row{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;border-radius:12px;padding:9px 10px;color:var(--cream);text-align:left;cursor:pointer}.friend-row:hover,.friend-row.selected{background:var(--hover)}.friend-copy{min-width:0;display:grid;gap:2px;flex:1}.friend-copy strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.friend-copy small,.profile-mini small,.request-copy small,.result-row small{color:var(--muted-fg);font-size:10px}.avatar{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;border:1px solid rgba(212,175,55,.28);border-radius:11px;background:rgba(107,26,26,.55);color:var(--gold-light);font-family:'Cinzel',serif;font-size:10px}.avatar.large{width:38px;height:38px;flex-basis:38px;border-radius:12px}.avatar.sm{width:28px;height:28px;flex-basis:28px;border-radius:9px;font-size:9px}.presence{width:7px;height:7px;border-radius:50%;background:#4b2f2f;box-shadow:0 0 0 3px rgba(255,255,255,.02)}.presence.on{background:#77c58c;box-shadow:0 0 10px rgba(119,197,140,.35)}.muted-line{padding:20px 12px;color:var(--muted-fg);font-size:11px;line-height:1.5}.sidebar-footer{padding:14px 10px;border-top:1px solid var(--line);display:grid;gap:8px}.profile-mini{display:flex;align-items:center;gap:10px;padding:8px 6px}.profile-mini span:last-child{display:grid;gap:2px;min-width:0}.profile-mini strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.settings-btn,.logout-btn{border:0;border-radius:9px;padding:9px 11px;text-align:left;cursor:pointer;color:var(--muted);background:transparent;font-size:11px}.settings-btn:hover{background:rgba(212,175,55,.07);color:var(--gold-light)}.logout-btn:hover{background:rgba(165,42,42,.12);color:#ffb3a8}

/* Channel sidebar */
.server-head{padding:16px 14px}.server-title-wrap{min-width:0;flex:1}.server-title{font-family:'Cinzel',serif;font-size:14px;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.channel-scroll{flex:1;overflow:auto;padding-bottom:8px}.channel-cat{padding-top:14px;padding-bottom:4px}.channel-row{display:flex;align-items:center;gap:8px;width:calc(100% - 16px);margin:1px 8px;border:0;background:transparent;border-radius:8px;padding:7px 10px;color:rgba(245,230,200,.5);text-align:left;cursor:pointer;font-size:12px}.channel-row:hover,.channel-row.active{background:var(--hover);color:var(--foreground);box-shadow:inset 3px 0 0 var(--maroon)}.ch-icon{opacity:.7;font-size:13px;width:16px;text-align:center}.ch-prefix{opacity:.55;margin-right:4px}

.content{min-width:0;flex:1;display:flex;flex-direction:column}.topbar{height:66px;display:flex;align-items:center;gap:16px;padding:0 22px;border-bottom:1px solid var(--border);background:var(--surface);backdrop-filter:blur(14px)}.top-search{display:flex;align-items:center;gap:10px;flex:1;max-width:760px;margin:0 auto;padding:10px 15px;border:1px solid var(--border);border-radius:999px;background:var(--input-bg)}.top-actions{display:flex;align-items:center;gap:10px}.status-pill{display:flex;align-items:center;gap:6px;color:var(--muted-fg);font-size:10px}.status-pill i{width:6px;height:6px;background:#77c58c;border-radius:50%;box-shadow:0 0 9px rgba(119,197,140,.4)}.content-area{padding:22px;overflow:auto;position:relative}.panel{border:1px solid var(--border);border-radius:22px;background:var(--card-bg);box-shadow:var(--shadow)}.page-panel{min-height:calc(100vh - 110px);padding:24px}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.panel-head.compact{margin-bottom:14px}.kicker{font-size:9px;letter-spacing:2.2px;color:var(--kicker, rgba(240,215,140,.5))}h2,h3{font-family:'Cinzel',serif;font-weight:600;color:var(--foreground)}h2{margin-top:5px;font-size:23px}.panel-sub,.modal-sub{margin-top:5px;color:var(--muted-fg);font-size:12px}.count-chip,.connection-note{padding:7px 10px;border:1px solid var(--line);border-radius:999px;color:rgba(240,215,140,.56);font-size:10px}.gold-btn,.ghost-btn,.control-btn,.hangup-btn{border-radius:10px;padding:9px 12px;cursor:pointer}.gold-btn{border:1px solid var(--maroon);background:var(--maroon);color:#fff}.gold-btn:hover:not(:disabled){background:var(--primary-hover)}.gold-btn:disabled{opacity:.35;cursor:not-allowed}.ghost-btn{border:1px solid var(--border);background:transparent;color:var(--muted-fg)}.gold-btn.full,.hangup-btn.full{width:100%;margin-top:8px}.head-actions{display:flex;gap:8px}.home-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:15px;margin-top:22px}.welcome-card,.tips-card,.chat-card{border:1px solid var(--border);border-radius:18px;background:var(--surface-2)}.welcome-card{min-height:310px;padding:30px;position:relative;overflow:hidden}.welcome-card:after{content:'';position:absolute;width:240px;height:240px;right:-80px;top:-80px;border:1px solid rgba(212,175,55,.11);border-radius:50%;box-shadow:0 0 0 40px rgba(212,175,55,.025),0 0 0 80px rgba(212,175,55,.014)}.ornament{font-size:22px;color:rgba(212,175,55,.7);margin-bottom:22px}.welcome-card h3{font-size:26px;max-width:360px;margin-top:8px}.welcome-card>p:not(.kicker){margin-top:12px;max-width:520px;color:var(--muted-fg);font-size:12px;line-height:1.7}.stat-strip{display:flex;gap:28px;margin-top:40px;flex-wrap:wrap}.stat-strip div{display:grid;gap:3px}.stat-strip strong{font-family:'Cinzel',serif;font-size:20px;color:var(--gold)}.stat-strip span{font-size:9px;letter-spacing:1px;color:var(--muted-fg)}.tips-card{padding:22px}.tip{display:flex;gap:14px;padding:18px 0;border-bottom:1px solid rgba(212,175,55,.09)}.tip:last-child{border-bottom:0}.tip>span{color:rgba(212,175,55,.6);font-family:'Cinzel',serif;font-size:11px}.tip strong{font-size:12px}.tip p{margin-top:4px;color:var(--muted-fg);font-size:10px;line-height:1.5}

.friend-workspace{margin-top:22px;display:grid;gap:14px}.call-toolbar{display:flex;align-items:center;justify-content:space-between}.call-toolbar>div{display:grid;gap:3px}.call-toolbar strong{font-family:'Cinzel',serif;color:var(--cream);font-size:15px}.call-toolbar small{color:var(--muted);font-size:10px}.call-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.control-btn{min-width:96px;border:1px solid var(--line);background:rgba(0,0,0,.12);color:rgba(245,230,200,.58)}.control-btn.active{border-color:rgba(212,175,55,.4);background:rgba(212,175,55,.08);color:var(--gold-light)}.hangup-btn{border:1px solid rgba(165,42,42,.6);background:rgba(139,26,26,.42);color:#ffcac0}.chat-card{padding:14px}.chat-head{display:flex;justify-content:space-between;align-items:center;padding:2px 2px 10px}.chat-head span{font-size:9px;letter-spacing:1.8px;color:var(--gold-light)}.chat-head small{color:rgba(245,230,200,.28);font-size:9px}.messages{min-height:150px;max-height:190px;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:8px}.message{align-self:flex-start;max-width:78%;padding:9px 11px;background:rgba(107,26,26,.38);border-radius:12px}.message.mine{align-self:flex-end;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.12)}.message p{font-size:11px;line-height:1.5}.message time{display:block;margin-top:4px;text-align:right;font-size:8px;color:rgba(245,230,200,.28)}.chat-empty{display:grid;place-items:center;min-height:130px;color:rgba(245,230,200,.25);font-size:11px}.chat-input{display:flex;gap:7px;border-top:1px solid rgba(212,175,55,.08);padding-top:10px}.chat-input input,.modal-search input,.form-stack input{flex:1;border:1px solid var(--border);border-radius:10px;background:var(--input-bg);color:var(--foreground);outline:0;padding:10px 12px;font-size:11px}.chat-input input:focus,.modal-search input:focus,.form-stack input:focus{border-color:var(--maroon)}.search-results{margin-top:18px;padding-top:18px;border-top:1px solid rgba(212,175,55,.08)}.result-row,.request-card{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);margin-bottom:8px}.result-row>div,.request-copy{display:grid;gap:2px;flex:1}.result-row strong,.request-copy strong{font-size:11px}.request-list{margin-top:20px}.request-card{padding:13px}.request-card .gold-btn{margin-left:auto}.empty-state{padding:45px 10px;text-align:center;color:var(--muted-fg);font-size:11px}.modal-backdrop{position:fixed;inset:0;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);z-index:20}.modal{position:relative;width:min(520px,100%);max-height:80vh;overflow:auto;border:1px solid var(--border);border-radius:22px;background:var(--modal-bg);box-shadow:var(--shadow);padding:26px}.modal.small{width:min(430px,100%)}.modal.wide{width:min(560px,100%)}.close-btn{position:absolute;top:12px;right:12px;width:30px;height:30px;border:1px solid var(--border);border-radius:9px;background:transparent;color:var(--muted-fg);cursor:pointer}.modal h2{margin-top:6px}.modal-search{display:flex;gap:8px;margin-top:18px}.result-stack{margin-top:18px}.form-error{margin-top:10px;color:#ffb3a8;font-size:10px}.settings-card{display:flex;align-items:center;gap:12px;margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:15px;background:var(--surface-2)}.settings-card>div{display:grid;gap:4px}.settings-card strong{font-size:13px}.settings-card p{color:var(--muted);font-size:10px}.settings-help{margin-top:14px;color:var(--muted-fg);font-size:10px;line-height:1.6}

/* Forms & server UI extras */
.form-stack{display:grid;gap:14px;margin-top:18px}.form-stack label{display:grid;gap:6px}.form-stack label span{font-size:10px;letter-spacing:1px;color:rgba(240,215,140,.55)}.form-stack label small{opacity:.6}
.settings-tabs{display:flex;gap:6px;margin-top:18px;flex-wrap:wrap}.settings-tabs button{border:1px solid var(--line);background:transparent;color:rgba(245,230,200,.45);border-radius:9px;padding:7px 12px;font-size:11px;cursor:pointer}.settings-tabs button.active{background:rgba(212,175,55,.1);color:var(--gold-light);border-color:rgba(212,175,55,.35)}
.invite-code-box{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid rgba(212,175,55,.2);border-radius:12px;background:rgba(212,175,55,.06)}.invite-code-box code,.invite-row code{font-family:monospace;color:var(--gold);font-size:13px;letter-spacing:1px}.invite-row{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid rgba(212,175,55,.08);border-radius:10px;background:rgba(0,0,0,.12)}.invite-row small{flex:1;color:var(--muted);font-size:10px}
.danger-zone{border-top:1px solid rgba(165,42,42,.25);padding-top:8px}

/* Server layout */
.server-layout{display:grid;grid-template-columns:1fr 220px;gap:14px;align-items:start}.server-main{min-height:calc(100vh - 110px)}.member-panel{padding:18px;position:sticky;top:0;max-height:calc(100vh - 110px);overflow:auto}.member-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.member-list{display:grid;gap:4px}.member-row{display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:10px}.member-row:hover{background:rgba(212,175,55,.05)}.member-copy{min-width:0;flex:1;display:grid;gap:1px}.member-copy strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.member-copy small{font-size:9px;color:var(--muted)}.settings-members{margin-top:14px}

.channel-chat{margin-top:18px;display:flex;flex-direction:column;min-height:calc(100vh - 220px)}.channel-messages{flex:1;overflow:auto;padding:8px 4px;display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 300px)}.channel-msg{display:flex;gap:10px}.msg-body{min-width:0;flex:1}.msg-meta{display:flex;align-items:baseline;gap:8px;margin-bottom:3px}.msg-meta strong,.msg-author{font-size:12px;color:var(--gold-light)}.msg-author{cursor:pointer}.msg-author:hover{text-decoration:underline}.msg-meta time{font-size:9px;color:rgba(245,230,200,.28)}.msg-body p{font-size:12px;line-height:1.55;color:rgba(245,230,200,.85)}.channel-input{display:flex;gap:8px;padding-top:12px;border-top:1px solid rgba(212,175,55,.08);margin-top:8px}.channel-input input{flex:1;border:1px solid var(--border);border-radius:10px;background:var(--input-bg);color:var(--foreground);outline:0;padding:12px 14px;font-size:12px}.channel-input input:focus{border-color:var(--maroon)}
.voice-placeholder{margin-top:40px;text-align:center;padding:40px 20px}.voice-placeholder .ornament{font-size:36px;margin-bottom:12px}.voice-placeholder h3{margin-top:8px}

.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:50;padding:12px 20px;border-radius:12px;border:1px solid var(--border);background:var(--toast-bg);color:var(--foreground);font-size:12px;box-shadow:var(--shadow)}.toast.error{border-color:rgba(165,42,42,.5);color:#ffb3a8}

.dm-list{max-height:180px}.dm-unread{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:rgba(212,175,55,.2);color:var(--gold);font-size:10px;display:grid;place-items:center}
.dm-panel{display:flex;flex-direction:column;min-height:calc(100vh - 110px)}.dm-header-user{display:flex;align-items:center;gap:12px}
.dm-messages{flex:1;overflow:auto;padding:12px 4px;display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 280px)}
.dm-msg{max-width:75%;padding:10px 12px;border-radius:14px;background:rgba(107,26,26,.38);align-self:flex-start}
.dm-msg.mine{align-self:flex-end;background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.12)}
.dm-msg p{font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.dm-msg-meta{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}
.dm-msg-meta time{font-size:9px;color:rgba(245,230,200,.28)}
.dm-actions{display:flex;gap:4px}.dm-actions button{border:0;background:transparent;color:rgba(245,230,200,.35);font-size:10px;cursor:pointer;padding:2px 4px}
.dm-actions button:hover{color:var(--gold-light)}
.dm-deleted{font-style:italic;color:rgba(245,230,200,.3);font-size:11px}
.dm-reply-preview{font-size:10px;color:rgba(240,215,140,.45);border-left:2px solid rgba(212,175,55,.3);padding-left:8px;margin-bottom:6px}
.dm-reply-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-top:8px;border:1px solid rgba(212,175,55,.12);border-radius:10px;font-size:11px;color:var(--muted)}
.dm-typing{font-size:11px;color:rgba(240,215,140,.5);padding:6px 4px}
.dm-reactions{display:flex;gap:6px;margin-top:6px}.dm-reactions span{font-size:11px;padding:2px 6px;border-radius:999px;background:rgba(0,0,0,.2)}
.dm-search-bar{margin:12px 0}.dm-search-bar input{width:100%;border:1px solid rgba(212,175,55,.14);border-radius:10px;background:rgba(0,0,0,.16);color:var(--cream);padding:10px 12px;font-size:12px;outline:0}
.dm-search-results{margin-top:8px;display:grid;gap:4px}.dm-search-hit{text-align:left;border:1px solid rgba(212,175,55,.08);border-radius:8px;background:rgba(0,0,0,.12);color:var(--cream);padding:8px 10px;font-size:11px;cursor:pointer}
.dm-edit-input{width:100%;border:1px solid rgba(212,175,55,.3);border-radius:8px;background:rgba(0,0,0,.2);color:var(--cream);padding:8px;font-size:12px;margin-bottom:6px}
.dm-attachment a,.msg-attachment a{font-size:11px;color:var(--gold)}
.msg-image{max-width:min(320px,100%);max-height:240px;border-radius:10px;margin-top:6px;cursor:pointer;border:1px solid var(--border)}
.attach-preview{display:flex;align-items:center;gap:8px;padding:6px 10px;margin-top:8px;border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--muted-fg)}
.hidden-file{display:none}
.notif-wrap{position:relative}
.notif-bell{position:relative}
.notif-bell .dc-badge{position:absolute;top:-4px;right:-4px}
.notif-dropdown{position:absolute;right:0;top:calc(100% + 8px);width:min(320px,90vw);max-height:360px;overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);z-index:40;padding:8px}
.notif-head{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-bottom:1px solid var(--border);margin-bottom:6px}
.notif-item{display:grid;gap:2px;width:100%;text-align:left;border:0;background:transparent;color:var(--foreground);padding:8px;border-radius:8px;cursor:pointer}
.notif-item.unread{background:color-mix(in srgb, var(--wc-maroon) 12%, transparent)}
.notif-item small{color:var(--muted-fg);font-size:11px}
.notif-empty{padding:16px;text-align:center;color:var(--muted-fg);font-size:12px}





/* Voice dock */
.voice-dock{margin:8px 8px 0;padding:12px;border:1px solid rgba(212,175,55,.2);border-radius:14px;background:rgba(0,0,0,.28)}
.voice-dock-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.voice-dock-head strong{display:block;font-size:11px;color:#77c58c}
.voice-dock-head small{display:block;font-size:10px;color:var(--muted);margin-top:2px}
.vd-status{color:#77c58c;font-size:10px}.vd-status.connecting,.vd-status.reconnecting{color:var(--gold)}.vd-status.disconnected{color:#a66}
.voice-dock-people{display:grid;gap:4px;max-height:100px;overflow:auto;margin-bottom:8px}
.vd-person{display:flex;justify-content:space-between;font-size:11px;padding:3px 4px;color:rgba(245,230,200,.7)}
.voice-dock-controls{display:flex;gap:6px}
.voice-dock-controls button{flex:1;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.03);color:var(--cream);padding:8px 0;cursor:pointer;font-size:13px}
.voice-dock-controls button.active{background:rgba(165,42,42,.35);border-color:rgba(165,42,42,.5)}
.voice-dock-controls button.leave{background:rgba(139,26,26,.4);border-color:rgba(165,42,42,.5)}
.voice-people{display:grid;gap:8px;justify-items:center;max-width:360px;margin:0 auto}
.voice-person{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1px solid rgba(212,175,55,.1);border-radius:12px;background:rgba(0,0,0,.12)}

/* Floating voice bar — global persistent widget */
.floating-voice-bar{
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:40;
  display:flex;align-items:center;gap:12px;padding:10px 14px;
  border:1px solid var(--border);border-radius:18px;
  background:var(--surface);backdrop-filter:blur(16px);
  box-shadow:var(--shadow);min-width:min(520px,94vw);
}
.fv-jump{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:inherit;cursor:pointer;text-align:left;flex:1;min-width:0}
.fv-dot{width:8px;height:8px;border-radius:50%;background:#77c58c;box-shadow:0 0 10px rgba(119,197,140,.5);flex-shrink:0}
.fv-dot.connecting,.fv-dot.reconnecting{background:var(--gold);box-shadow:0 0 10px rgba(212,175,55,.4)}
.fv-dot.disconnected{background:#a66}
.fv-meta{min-width:0}.fv-meta strong{display:block;font-size:11px;color:#77c58c}.fv-meta small{display:block;font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
.fv-actions{display:flex;gap:5px;flex-shrink:0}
.fv-actions button{width:34px;height:34px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.03);color:var(--cream);cursor:pointer;font-size:13px}
.fv-actions button.active{background:rgba(165,42,42,.35);border-color:rgba(165,42,42,.5)}
.fv-actions button.fv-leave{background:rgba(139,26,26,.45);border-color:rgba(165,42,42,.55)}
.voice-preview{position:relative;margin:20px auto 0;width:min(320px,100%);border-radius:14px;overflow:hidden;border:1px solid rgba(212,175,55,.2);background:#000}
.voice-preview-video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#111}
.vp-badge{position:absolute;left:8px;bottom:8px;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.65);font-size:9px;color:var(--gold-light)}


.vp-name{flex:1;font-size:12px;text-align:left}.vp-mic{font-size:14px}
.device-select{width:100%;border:1px solid rgba(212,175,55,.14);border-radius:10px;background:rgba(0,0,0,.16);color:var(--cream);padding:10px 12px;font-size:11px}


.ui-form{display:grid;gap:12px}.ui-field{display:grid;gap:6px}.ui-field label,.ui-field :deep(label){display:block}
.appearance-block{margin-top:22px;padding-top:18px;border-top:1px solid var(--border)}
.theme-picks{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
.theme-pick{display:grid;gap:8px;justify-items:center;padding:12px 8px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);color:var(--muted);cursor:pointer;font-size:11px;transition:border-color .15s,transform .15s,background .15s}
.theme-pick:hover{border-color:var(--maroon);transform:translateY(-1px)}
.theme-pick.active{border-color:var(--maroon);background:var(--hover);color:var(--foreground);box-shadow:0 0 0 1px var(--maroon)}
.theme-swatch{width:36px;height:36px;border-radius:10px;border:1px solid var(--border)}
.dark-swatch{background:linear-gradient(135deg,#0A0A0A 50%,#800000 50%)}
.light-swatch{background:linear-gradient(135deg,#FAFAFA 50%,#D4AF37 50%)}
.system-swatch{background:linear-gradient(90deg,#0A0A0A 50%,#FAFAFA 50%)}
/* interactive polish */
.server-icon,.icon-btn,.gold-btn,.ghost-btn,.control-btn,.friend-row,.channel-row,.member-row{transition:background .15s ease,border-color .15s ease,transform .12s ease,box-shadow .15s ease}
.server-icon:active,.gold-btn:active,.ghost-btn:active{transform:scale(.97)}
.panel{transition:background .2s ease,border-color .2s ease}
input,select,textarea{transition:border-color .15s ease,background .15s ease}


/* Light mode readability overrides */
html.light .welcome-card:after{border-color:rgba(128,0,0,.08);box-shadow:0 0 0 40px rgba(128,0,0,.03),0 0 0 80px rgba(128,0,0,.015)}
html.light .tip{border-bottom-color:rgba(0,0,0,.06)}
html.light .side-search span,html.light .top-search span{color:var(--muted-fg)}
html.light .settings-btn:hover{background:var(--hover);color:var(--maroon)}
html.light .logout-btn:hover{background:rgba(128,0,0,.08);color:var(--maroon)}
html.light .friend-copy strong,html.light .profile-mini strong{color:var(--foreground)}
html.light .stat-strip strong{color:var(--gold)}
html.light .ornament{color:var(--gold)}
html.light .msg-meta strong,html.light .msg-author{color:var(--maroon)}
html.light .channel-input input,html.light .chat-input input,html.light .form-stack input,html.light .device-select{
  background:var(--input-bg);color:var(--foreground);border-color:var(--border)
}
html.light .dm-msg{background:var(--surface-2)}
html.light .dm-msg.mine{background:rgba(128,0,0,.06);border-color:rgba(128,0,0,.12)}
html.light .member-panel,html.light .voice-dock{background:var(--surface)}
html.light .upc-card .upc-avatar,html.light .user-avatar{border-color:var(--border)}


/* —— Discord-inspired friends layout (WebCall palette) —— */
.dc-sidebar{background:var(--surface)!important;border-right:1px solid var(--border)!important}
.dc-search-wrap{padding:10px 10px 8px}
.dc-search-btn{width:100%;border:0;border-radius:4px;background:var(--bg);color:var(--muted-fg);font-size:12px;padding:8px 10px;text-align:left;cursor:pointer}
.dc-search-btn:hover{color:var(--foreground)}
.dc-nav{display:grid;gap:2px;padding:0 8px 8px}
.dc-nav-item{display:flex;align-items:center;gap:10px;border:0;border-radius:4px;background:transparent;color:var(--muted-fg);font-size:14px;font-weight:500;padding:8px 10px;cursor:pointer;text-align:left}
.dc-nav-item:hover{background:var(--hover);color:var(--foreground)}
.dc-nav-item.active{background:var(--hover);color:var(--foreground)}
.dc-nav-icon{width:20px;text-align:center;opacity:.85}
.dc-badge{margin-left:auto;min-width:16px;height:16px;padding:0 5px;border-radius:999px;background:var(--maroon);color:#fff;font-size:10px;font-weight:700;display:inline-grid;place-items:center}
.dc-badge.danger{background:#da373c}
.dc-section-head{display:flex;align-items:center;justify-content:space-between;padding:12px 10px 4px;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--muted-fg)}
.dc-icon-sm{width:24px;height:24px;border:0;border-radius:4px;background:transparent;color:var(--muted-fg);cursor:pointer;font-size:14px}
.dc-icon-sm:hover{background:var(--hover);color:var(--foreground)}
.dc-dm-list{flex:1;overflow:auto;padding:0 8px 8px;min-height:0}
.dc-dm-row{width:100%;display:flex;align-items:center;gap:10px;border:0;border-radius:4px;background:transparent;color:var(--muted-fg);padding:6px 8px;cursor:pointer;text-align:left}
.dc-dm-row:hover,.dc-dm-row.active{background:var(--hover);color:var(--foreground)}
.dc-dm-name{flex:1;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dc-empty{padding:12px 8px;font-size:12px;color:var(--muted-fg)}
.dc-avatar-wrap{position:relative;flex-shrink:0}
.dc-status-dot{position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:#4b4b4b;border:2px solid var(--surface)}
.dc-status-dot.on{background:#23a559}
.dc-user-panel{display:flex;align-items:center;gap:8px;padding:8px;margin-top:auto;background:color-mix(in srgb, var(--bg) 80%, #000);border-top:1px solid var(--border)}
.dc-user-info{display:flex;align-items:center;gap:8px;flex:1;min-width:0;cursor:pointer;border-radius:4px;padding:2px 4px}
.dc-user-info:hover{background:var(--hover)}
.dc-user-text{min-width:0;display:grid}
.dc-user-text strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dc-user-text small{font-size:11px;color:var(--muted-fg)}
.dc-user-actions{display:flex;gap:2px}

.dc-friends-panel{display:flex;flex-direction:column;min-height:calc(100vh - 66px);background:var(--bg);border-radius:0;border:0}
.dc-friends-toolbar{display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid var(--border);background:var(--bg);min-height:48px}
.dc-friends-tabs{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%}
.dc-friends-title{font-size:15px;font-weight:600;color:var(--foreground);display:flex;align-items:center;gap:6px}
.dc-tab-sep{width:1px;height:20px;background:var(--border);margin:0 4px}
.dc-tab{border:0;border-radius:4px;background:transparent;color:var(--muted-fg);font-size:14px;font-weight:500;padding:4px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.dc-tab:hover{background:var(--hover);color:var(--foreground)}
.dc-tab.active{background:var(--surface-2);color:var(--foreground)}
.dc-friends-body{flex:1;overflow:auto;padding:16px 20px 24px}
.dc-search-bar{display:flex;align-items:center;gap:8px;background:var(--surface);border-radius:4px;padding:8px 12px;margin-bottom:20px}
.dc-search-bar span{color:var(--muted-fg)}
.dc-search-bar input{flex:1;border:0;outline:0;background:transparent;color:var(--foreground);font-size:14px}
.dc-list-label{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-fg);margin-bottom:8px}
.dc-friend-list{display:grid}
.dc-friend-row{display:flex;align-items:center;gap:12px;padding:10px 8px;border-top:1px solid var(--border);cursor:pointer;border-radius:8px}
.dc-friend-row:hover{background:var(--surface);border-radius:8px}
.dc-friend-row:hover .dc-friend-actions{opacity:1}
.dc-friend-meta{flex:1;min-width:0;display:grid;gap:2px}
.dc-friend-meta strong{font-size:14px;font-weight:500;color:var(--foreground)}
.dc-friend-meta small{font-size:12px;color:var(--muted-fg)}
.dc-friend-actions{display:flex;align-items:center;gap:8px;opacity:.85}
.dc-icon-btn{width:32px;height:32px;border:0;border-radius:50%;background:var(--surface-2);color:var(--muted-fg);cursor:pointer;font-size:14px;display:grid;place-items:center}
.dc-icon-btn:hover{color:var(--foreground);background:var(--hover)}
.dc-empty-main{padding:40px 16px;text-align:center;color:var(--muted-fg);font-size:14px}
/* Hide old topbar brand feel on friends home — content full */
.content-area:has(.dc-friends-panel){padding:0}
.content-area:has(.dc-friends-panel) .topbar{display:none}

@media(max-width:1100px){.server-layout{grid-template-columns:1fr}.member-panel{display:none}}
@media(max-width:900px){.sidebar{width:220px;min-width:220px}.home-grid{grid-template-columns:1fr}}
@media(max-width:720px){.app-shell{display:block}.server-rail{width:100%;min-width:0;flex-direction:row;flex-wrap:wrap;justify-content:center;padding:10px;border-right:0;border-bottom:1px solid var(--line)}.sidebar{width:100%;min-width:0;height:auto;max-height:none;border-right:0;border-bottom:1px solid var(--line)}.friend-list,.channel-scroll{max-height:200px}.sidebar-footer{grid-template-columns:1fr auto auto;align-items:center}.settings-btn,.logout-btn{font-size:10px}.topbar{height:60px}.content-area{padding:12px}.page-panel{min-height:calc(100vh - 84px);padding:16px}.top-search{max-width:none}.top-actions .status-pill,.top-actions .icon-btn{display:none}}
</style>
