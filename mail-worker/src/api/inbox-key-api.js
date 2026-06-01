import app from '../hono/hono';
import result from '../model/result';
import inboxKeyService from '../service/inbox-key-service';

app.post('/inboxKey/add', async (c) => {
	const data = await inboxKeyService.add(c, await c.req.json());
	return c.json(result.ok(data));
});

app.get('/inboxKey/list', async (c) => {
	const list = await inboxKeyService.list(c, c.req.query());
	return c.json(result.ok(list));
});

app.put('/inboxKey/set', async (c) => {
	await inboxKeyService.set(c, await c.req.json());
	return c.json(result.ok());
});

app.delete('/inboxKey/delete', async (c) => {
	await inboxKeyService.delete(c, c.req.query());
	return c.json(result.ok());
});

app.get('/inboxKey/mailList', async (c) => {
	const data = await inboxKeyService.publicMailList(c, c.req.query());
	return c.json(result.ok(data));
});

app.get('/inboxKey/latest', async (c) => {
	const list = await inboxKeyService.latest(c, c.req.query());
	return c.json(result.ok(list));
});
