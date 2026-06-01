<template>
  <div class="public-inbox">
    <header class="topbar">
      <div>
        <div class="title">Key Inbox</div>
        <div class="mailbox">{{ mailbox || 'Loading...' }}</div>
      </div>
      <Icon class="icon" icon="ion:reload" width="20" height="20" @click="refresh"/>
    </header>

    <main class="main">
      <section class="list">
        <div v-if="loading" class="state">
          <Loading/>
        </div>
        <el-empty v-else-if="mailList.length === 0" description="No messages"/>
        <button
            v-for="mail in mailList"
            v-else
            :key="mail.emailId"
            class="mail-row"
            :class="current?.emailId === mail.emailId ? 'active' : ''"
            @click="current = mail"
        >
          <span class="from">{{ mail.name || mail.sendEmail }}</span>
          <span class="subject">
            <span v-if="mail.code" class="code">[Code {{ mail.code }}]</span>
            {{ mail.subject || '(No subject)' }}
          </span>
          <span class="preview">{{ previewText(mail) }}</span>
          <span class="time">{{ formatTime(mail.createTime) }}</span>
        </button>
      </section>

      <section class="detail">
        <el-empty v-if="!current" description="Select a message"/>
        <article v-else class="message">
          <h1>{{ current.subject || '(No subject)' }}</h1>
          <div class="meta">
            <div>From: {{ current.name || current.sendEmail }} &lt;{{ current.sendEmail }}&gt;</div>
            <div>To: {{ current.toEmail }}</div>
            <div>{{ detailTime(current.createTime) }}</div>
          </div>
          <ShadowHtml v-if="current.content" class="body-html" :html="current.content"/>
          <pre v-else class="body-text">{{ current.text }}</pre>
        </article>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { Icon } from "@iconify/vue";
import Loading from "@/components/loading/index.vue";
import ShadowHtml from "@/components/shadow-html/index.vue";
import { inboxKeyMailList } from "@/request/inbox-key.js";
import { formatDetailDate, fromNow } from "@/utils/day.js";

const route = useRoute()
const key = computed(() => route.query.key)
const loading = ref(false)
const mailbox = ref('')
const current = ref(null)
const mailList = reactive([])

onMounted(() => {
  refresh()
})

function refresh() {
  loading.value = true
  inboxKeyMailList({
    key: key.value,
    emailId: 0,
    size: 50,
    timeSort: 0
  }).then(data => {
    mailbox.value = data.mailbox
    mailList.length = 0
    mailList.push(...data.list)
    current.value = data.list[0] || null
  }).finally(() => {
    loading.value = false
  })
}

function previewText(mail) {
  const text = mail.text || stripHtml(mail.content || '')
  return text.replace(/\s+/g, ' ').trim()
}

function stripHtml(html) {
  const doc = document.createElement('div')
  doc.innerHTML = html
  doc.querySelectorAll('script, style, title').forEach(item => item.remove())
  return doc.textContent || ''
}

function formatTime(time) {
  return fromNow(time)
}

function detailTime(time) {
  return formatDetailDate(time)
}
</script>

<style scoped lang="scss">
.public-inbox {
  height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.topbar {
  min-height: 60px;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--header-actions-border);

  .title {
    font-size: 18px;
    font-weight: 700;
  }

  .mailbox {
    margin-top: 4px;
    color: var(--regular-text-color);
    font-size: 13px;
  }

  .icon {
    cursor: pointer;
  }
}

.main {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 380px) 1fr;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    grid-template-rows: 45% 55%;
  }
}

.list {
  min-height: 0;
  overflow: auto;
  border-right: 1px solid var(--el-border-color);

  @media (max-width: 820px) {
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color);
  }
}

.state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mail-row {
  width: 100%;
  min-height: 92px;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "from time"
    "subject subject"
    "preview preview";
  gap: 5px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--el-border-color);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &.active,
  &:hover {
    background: var(--email-hover-background);
  }

  .from {
    grid-area: from;
    font-weight: 700;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .time {
    grid-area: time;
    color: var(--regular-text-color);
    font-size: 12px;
    white-space: nowrap;
  }

  .subject {
    grid-area: subject;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .preview {
    grid-area: preview;
    color: var(--regular-text-color);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.code {
  color: var(--el-color-primary);
}

.detail {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.message {
  padding: 22px;

  h1 {
    font-size: 22px;
    margin: 0 0 14px;
  }

  .meta {
    display: grid;
    gap: 6px;
    color: var(--regular-text-color);
    padding-bottom: 14px;
    margin-bottom: 18px;
    border-bottom: 1px solid var(--el-border-color);
  }
}

.body-html {
  display: block;
}

.body-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}
</style>
