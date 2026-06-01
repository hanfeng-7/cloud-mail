import http from '@/axios/index.js';

export function inboxKeyAdd(form) {
    return http.post('/inboxKey/add', form)
}

export function inboxKeyList(params) {
    return http.get('/inboxKey/list', {params})
}

export function inboxKeySet(form) {
    return http.put('/inboxKey/set', form)
}

export function inboxKeyDelete(inboxKeyIds) {
    return http.delete('/inboxKey/delete', {params: {inboxKeyIds: inboxKeyIds.join(',')}})
}

export function inboxKeyMailList(params) {
    return http.get('/public/inboxKey/mailList', {params})
}

export function inboxKeyLatest(key, emailId) {
    return http.get('/public/inboxKey/mailList', {params: {key, emailId, timeSort: 1}, noMsg: true, timeout: 35 * 1000})
        .then(data => data.list)
}
