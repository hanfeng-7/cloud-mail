<template>
  <div class="inbox-key-page">
    <div class="header-actions">
      <Icon v-perm="'inbox-key:add'" class="icon" icon="ion:add-outline" width="23" height="23" @click="openAdd"/>
      <el-input v-model="params.keyword" class="search-input" placeholder="搜索邮箱"/>
      <Icon class="icon" icon="iconoir:search" width="20" height="20" @click="getList"/>
      <Icon class="icon" icon="ion:reload" width="18" height="18" @click="refresh"/>
    </div>

    <div class="table-wrap">
      <div class="loading" :class="loading ? 'loading-show' : 'loading-hide'">
        <Loading/>
      </div>
      <el-table :data="list" height="100%" style="width: 100%">
        <el-table-column prop="email" label="邮箱" min-width="210" show-overflow-tooltip/>
        <el-table-column label="状态" width="95">
          <template #default="{ row }">
            <el-tag v-if="row.status === 0 && !row.deleted" type="success">启用</el-tag>
            <el-tag v-else type="danger">禁用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="有效期" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.receiveExpireTime">{{ formatTime(row.receiveExpireTime) }}</span>
            <el-tag v-else>永久</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="删除时间" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.deleteTime">{{ formatTime(row.deleteTime) }}</span>
            <el-tag v-else>永久</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="访问链接" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="link" @click="openCopy(row)">{{ row.accessLink }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <div class="actions">
              <Icon class="icon" icon="fluent:copy-20-regular" width="20" height="20" @click="openCopy(row)"/>
              <Icon v-perm="'inbox-key:set'" class="icon" icon="fluent:settings-20-regular" width="20" height="20" @click="openEdit(row)"/>
              <Icon
                  v-perm="'inbox-key:set'"
                  class="icon"
                  :icon="row.status === 0 ? 'fluent:pause-20-regular' : 'fluent:play-20-regular'"
                  width="20"
                  height="20"
                  @click="toggleStatus(row)"
              />
              <Icon v-perm="'inbox-key:delete'" class="icon danger" icon="uiw:delete" width="16" height="16" @click="deleteRow(row)"/>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="showAdd" title="创建随机邮箱" width="380">
      <div class="form">
        <el-select v-model="addForm.domain" placeholder="邮箱域名">
          <el-option v-for="domain in domainList" :key="domain" :label="domain" :value="domain"/>
        </el-select>
        <div class="line">
          <el-switch v-model="addForm.receivePermanent" active-text="收信永久"/>
          <el-input-number v-if="!addForm.receivePermanent" v-model="addForm.receiveDays" :min="1" :max="36500"/>
        </div>
        <div class="line">
          <el-switch v-model="addForm.deletePermanent" active-text="删除永久"/>
          <el-input-number v-if="!addForm.deletePermanent" v-model="addForm.deleteDays" :min="1" :max="36500"/>
        </div>
        <el-button type="primary" :loading="submitLoading" @click="submitAdd">创建</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="showEdit" title="设置邮箱 Key" width="380">
      <div class="form">
        <el-switch v-model="editForm.statusOpen" active-text="启用"/>
        <div class="line">
          <el-switch v-model="editForm.receivePermanent" active-text="收信永久"/>
          <el-input-number v-if="!editForm.receivePermanent" v-model="editForm.receiveDays" :min="1" :max="36500"/>
        </div>
        <div class="line">
          <el-switch v-model="editForm.deletePermanent" active-text="删除永久"/>
          <el-input-number v-if="!editForm.deletePermanent" v-model="editForm.deleteDays" :min="1" :max="36500"/>
        </div>
        <el-button type="primary" :loading="submitLoading" @click="submitEdit">保存</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="showCopy" title="Copy inbox link" width="460">
      <div class="copy-box">
        <el-radio-group v-model="copyType">
          <el-radio-button
              v-for="option in copyOptions"
              :key="option.value"
              :label="option.value"
          >
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
        <el-input
            :model-value="copyPreview"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            readonly
        />
        <el-button type="primary" @click="confirmCopy">Copy</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { Icon } from "@iconify/vue";
import Loading from "@/components/loading/index.vue";
import { inboxKeyAdd, inboxKeyDelete, inboxKeyList, inboxKeySet } from "@/request/inbox-key.js";
import { useSettingStore } from "@/store/setting.js";
import { tzDayjs } from "@/utils/day.js";

const settingStore = useSettingStore();
const params = reactive({
  keyword: ''
})
const list = reactive([])
const loading = ref(false)
const submitLoading = ref(false)
const showAdd = ref(false)
const showEdit = ref(false)
const showCopy = ref(false)
const copyType = ref('ui')
const copyRow = ref(null)

const copyOptions = [
  { value: 'ui', label: 'UI page' },
  { value: 'json', label: 'JSON API' },
  { value: 'text', label: 'Plain text API' }
]

const domainList = computed(() => {
  const domains = settingStore.domainList || settingStore.settings.domainList || []
  return domains.map(item => item.replace('@', ''))
})

const addForm = reactive({
  domain: '',
  receivePermanent: true,
  receiveDays: 7,
  deletePermanent: true,
  deleteDays: 30
})

const editForm = reactive({
  inboxKeyId: null,
  statusOpen: true,
  receivePermanent: true,
  receiveDays: 7,
  deletePermanent: true,
  deleteDays: 30
})

const copyPreview = computed(() => {
  if (!copyRow.value) {
    return ''
  }
  return buildCopyLink(copyRow.value, copyType.value)
})

getList()

function getList() {
  loading.value = true
  inboxKeyList(params).then(data => {
    list.length = 0
    list.push(...data)
  }).finally(() => {
    loading.value = false
  })
}

function refresh() {
  params.keyword = ''
  getList()
}

function openAdd() {
  addForm.domain = domainList.value[0] || ''
  showAdd.value = true
}

function openEdit(row) {
  editForm.inboxKeyId = row.inboxKeyId
  editForm.statusOpen = row.status === 0
  editForm.receivePermanent = !row.receiveExpireTime
  editForm.deletePermanent = !row.deleteTime
  editForm.receiveDays = 7
  editForm.deleteDays = 30
  showEdit.value = true
}

function submitAdd() {
  submitLoading.value = true
  inboxKeyAdd(addForm).then(row => {
    showAdd.value = false
    list.unshift(row)
    ElMessage({ message: '创建成功', type: 'success', plain: true })
    getList()
  }).finally(() => {
    submitLoading.value = false
  })
}

function submitEdit() {
  submitLoading.value = true
  inboxKeySet({
    inboxKeyId: editForm.inboxKeyId,
    status: editForm.statusOpen ? 0 : 1,
    receivePermanent: editForm.receivePermanent,
    receiveDays: editForm.receivePermanent ? null : editForm.receiveDays,
    deletePermanent: editForm.deletePermanent,
    deleteDays: editForm.deletePermanent ? null : editForm.deleteDays
  }).then(() => {
    showEdit.value = false
    ElMessage({ message: '保存成功', type: 'success', plain: true })
    getList()
  }).finally(() => {
    submitLoading.value = false
  })
}

function toggleStatus(row) {
  inboxKeySet({
    inboxKeyId: row.inboxKeyId,
    status: row.status === 0 ? 1 : 0
  }).then(() => {
    row.status = row.status === 0 ? 1 : 0
  })
}

function deleteRow(row) {
  ElMessageBox.confirm(`删除 ${row.email}？`, {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    inboxKeyDelete([row.inboxKeyId]).then(() => {
      const index = list.findIndex(item => item.inboxKeyId === row.inboxKeyId)
      if (index > -1) list.splice(index, 1)
      ElMessage({ message: '删除成功', type: 'success', plain: true })
    })
  })
}

function formatTime(time) {
  return tzDayjs(time).format('YYYY-MM-DD HH:mm')
}

function openCopy(row) {
  copyRow.value = row
  copyType.value = 'ui'
  showCopy.value = true
}

async function confirmCopy() {
  await copy(copyPreview.value)
  showCopy.value = false
}

function buildCopyLink(row, type) {
  const origin = getAccessOrigin(row.accessLink)
  const key = encodeURIComponent(getAccessKey(row))

  if (type === 'json') {
    return `${origin}/api/public/inboxKey/latestCode?key=${key}`
  }

  if (type === 'text') {
    return `${origin}/api/public/inboxKey/latestCodeText?key=${key}`
  }

  return `${origin}/inbox?key=${key}`
}

function getAccessOrigin(link) {
  try {
    return new URL(link).origin
  } catch (e) {
    return window.location.origin
  }
}

function getAccessKey(row) {
  if (row.accessKey) {
    return row.accessKey
  }

  try {
    return new URL(row.accessLink).searchParams.get('key') || ''
  } catch (e) {
    return ''
  }
}

async function copy(text) {
  await navigator.clipboard.writeText(text)
  ElMessage({ message: '已复制', type: 'success', plain: true })
}
</script>

<style scoped lang="scss">
.inbox-key-page {
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
}

.header-actions {
  padding: 9px 15px;
  display: flex;
  gap: 18px;
  align-items: center;
  box-shadow: var(--header-actions-border);

  .icon {
    cursor: pointer;
  }
}

.search-input {
  width: min(220px, calc(100vw - 140px));
}

.table-wrap {
  position: relative;
  min-height: 0;
}

.actions {
  display: flex;
  gap: 14px;
  align-items: center;

  .icon {
    cursor: pointer;
  }

  .danger {
    color: var(--el-color-danger);
  }
}

.link {
  cursor: pointer;
  color: var(--el-color-primary);
}

.form {
  display: grid;
  gap: 15px;

  .line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
}

.copy-box {
  display: grid;
  gap: 14px;
}

.loading {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--loadding-background);
  z-index: 2;
}

.loading-show {
  opacity: 1;
}

.loading-hide {
  pointer-events: none;
  opacity: 0;
}
</style>
