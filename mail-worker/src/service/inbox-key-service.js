import orm from '../entity/orm';
import inboxKey from '../entity/inbox-key';
import email from '../entity/email';
import BizError from '../error/biz-error';
import { formatDetailDate, toUtc } from '../utils/date-uitil';
import emailUtils from '../utils/email-utils';
import { and, asc, count, desc, eq, gt, lt, ne, sql } from 'drizzle-orm';
import { emailConst, isDel } from '../const/entity-const';

export const inboxKeyConst = {
	status: {
		OPEN: 0,
		CLOSE: 1
	}
};

const inboxKeyService = {
	async add(c, params) {
		const domain = this.resolveDomain(c, params.domain);
		const receiveExpireTime = this.daysToTime(params.receiveDays, params.receivePermanent);
		const deleteTime = this.daysToTime(params.deleteDays, params.deletePermanent);

		for (let i = 0; i < 8; i++) {
			const mail = `${this.randomString(12)}@${domain}`;
			const accessKey = this.randomString(40);
			try {
				return await orm(c).insert(inboxKey).values({
					email: mail,
					accessKey,
					receiveExpireTime,
					deleteTime
				}).returning().get();
			} catch (e) {
				if (!e.message?.includes('SQLITE_CONSTRAINT')) {
					throw e;
				}
			}
		}

		throw new BizError('Failed to generate a unique inbox key mailbox');
	},

	async list(c, params) {
		const { keyword, status } = params;
		const conditions = [];

		if (keyword) {
			conditions.push(sql`${inboxKey.email} COLLATE NOCASE LIKE ${'%' + keyword + '%'}`);
		}

		if (status || status === 0 || status === '0') {
			conditions.push(eq(inboxKey.status, Number(status)));
		}

		let query = orm(c).select().from(inboxKey);
		if (conditions.length > 0) {
			query = query.where(and(...conditions));
		}

		const list = await query.orderBy(desc(inboxKey.inboxKeyId)).all();
		const origin = new URL(c.req.url).origin;
		return list.map(item => ({
			...item,
			accessLink: `${origin}/inbox?key=${item.accessKey}`,
			receiveExpired: this.isReceiveExpired(item),
			deleted: this.isDeleteExpired(item)
		}));
	},

	async set(c, params) {
		const { inboxKeyId } = params;
		const row = await this.selectById(c, inboxKeyId);
		if (!row) {
			throw new BizError('Inbox key mailbox does not exist');
		}

		const values = {
			updateTime: formatDetailDate(toUtc())
		};

		if (params.status || params.status === 0) {
			values.status = Number(params.status);
		}

		if ('receiveDays' in params || params.receivePermanent) {
			values.receiveExpireTime = this.daysToTime(params.receiveDays, params.receivePermanent);
		}

		if ('deleteDays' in params || params.deletePermanent) {
			values.deleteTime = this.daysToTime(params.deleteDays, params.deletePermanent);
		}

		await orm(c).update(inboxKey).set(values).where(eq(inboxKey.inboxKeyId, Number(inboxKeyId))).run();
	},

	async delete(c, params) {
		let { inboxKeyIds } = params;
		if (!Array.isArray(inboxKeyIds)) {
			inboxKeyIds = String(inboxKeyIds || '').split(',');
		}

		for (const id of inboxKeyIds.map(Number).filter(Boolean)) {
			await orm(c).delete(inboxKey).where(eq(inboxKey.inboxKeyId, id)).run();
		}
	},

	selectById(c, inboxKeyId) {
		return orm(c).select().from(inboxKey).where(eq(inboxKey.inboxKeyId, Number(inboxKeyId))).get();
	},

	selectByEmail(c, mail) {
		return orm(c).select().from(inboxKey).where(sql`${inboxKey.email} COLLATE NOCASE = ${mail}`).get();
	},

	async selectByEmailForReceive(c, mail) {
		const row = await this.selectByEmail(c, mail);
		if (!row) {
			return null;
		}

		if (row.status === inboxKeyConst.status.CLOSE || this.isReceiveExpired(row) || this.isDeleteExpired(row)) {
			throw new BizError('Inbox key mailbox is disabled or expired', 403);
		}

		return row;
	},

	async publicMailList(c, params) {
		let { key, emailId, size, timeSort } = params;
		const row = await this.selectByAccessKeyForView(c, key);

		size = Number(size) || 50;
		if (size > 50) {
			size = 50;
		}

		emailId = Number(emailId);
		timeSort = Number(timeSort);
		if (!emailId) {
			emailId = timeSort ? 0 : 9999999999;
		}

		const conditions = and(
			sql`${email.toEmail} COLLATE NOCASE = ${row.email}`,
			eq(email.type, emailConst.type.RECEIVE),
			eq(email.isDel, isDel.NORMAL),
			ne(email.status, emailConst.status.SAVING),
			timeSort ? gt(email.emailId, emailId) : lt(email.emailId, emailId)
		);

		const listQuery = orm(c).select({
			emailId: email.emailId,
			sendEmail: email.sendEmail,
			name: email.name,
			subject: email.subject,
			code: email.code,
			text: email.text,
			content: email.content,
			recipient: email.recipient,
			toEmail: email.toEmail,
			toName: email.toName,
			createTime: email.createTime,
			status: email.status
		}).from(email).where(conditions);

		if (timeSort) {
			listQuery.orderBy(asc(email.emailId));
		} else {
			listQuery.orderBy(desc(email.emailId));
		}

		const countQuery = orm(c).select({ total: count() }).from(email).where(and(
			sql`${email.toEmail} COLLATE NOCASE = ${row.email}`,
			eq(email.type, emailConst.type.RECEIVE),
			eq(email.isDel, isDel.NORMAL),
			ne(email.status, emailConst.status.SAVING)
		)).get();

		const latestEmailQuery = orm(c).select({
			emailId: email.emailId,
			toEmail: email.toEmail
		}).from(email).where(and(
			sql`${email.toEmail} COLLATE NOCASE = ${row.email}`,
			eq(email.type, emailConst.type.RECEIVE),
			eq(email.isDel, isDel.NORMAL),
			ne(email.status, emailConst.status.SAVING)
		)).orderBy(desc(email.emailId)).limit(1).get();

		const [list, totalRow, latestEmail] = await Promise.all([
			listQuery.limit(size).all(),
			countQuery,
			latestEmailQuery
		]);

		return {
			mailbox: row.email,
			list: list.map(item => this.toPublicEmail(item)),
			total: totalRow.total,
			latestEmail: latestEmail || { emailId: 0, toEmail: row.email }
		};
	},

	async publicInfo(c, params) {
		const row = await this.selectByAccessKeyForView(c, params.key);
		return {
			email: row.email,
			status: row.status,
			receiveExpireTime: row.receiveExpireTime,
			deleteTime: row.deleteTime,
			createTime: row.createTime
		};
	},

	async publicMailDetail(c, params) {
		const row = await this.selectByAccessKeyForView(c, params.key);
		const id = Number(params.id);
		if (!id) {
			throw new BizError('Missing mail id', 403);
		}

		const mail = await this.selectPublicEmailById(c, row.email, id);
		if (!mail) {
			throw new BizError('Mail not found', 404);
		}

		return this.toPublicEmail(mail);
	},

	async latest(c, params) {
		const { key, emailId } = params;
		const row = await this.selectByAccessKeyForView(c, key);
		const list = await orm(c).select({
			emailId: email.emailId,
			sendEmail: email.sendEmail,
			name: email.name,
			subject: email.subject,
			code: email.code,
			text: email.text,
			content: email.content,
			recipient: email.recipient,
			toEmail: email.toEmail,
			toName: email.toName,
			createTime: email.createTime,
			status: email.status
		}).from(email).where(and(
			sql`${email.toEmail} COLLATE NOCASE = ${row.email}`,
			gt(email.emailId, Number(emailId) || 0),
			eq(email.type, emailConst.type.RECEIVE),
			eq(email.isDel, isDel.NORMAL),
			ne(email.status, emailConst.status.SAVING)
		)).orderBy(desc(email.emailId)).limit(20).all();

		return list.map(item => this.toPublicEmail(item));
	},

	async latestCode(c, params) {
		const row = await this.selectByAccessKeyForView(c, params.key);
		const list = await orm(c).select({
			emailId: email.emailId,
			sendEmail: email.sendEmail,
			name: email.name,
			subject: email.subject,
			text: email.text,
			content: email.content,
			toEmail: email.toEmail,
			createTime: email.createTime
		}).from(email).where(and(
			sql`${email.toEmail} COLLATE NOCASE = ${row.email}`,
			eq(email.type, emailConst.type.RECEIVE),
			eq(email.isDel, isDel.NORMAL),
			ne(email.status, emailConst.status.SAVING)
		)).orderBy(desc(email.emailId)).limit(20).all();

		for (const item of list) {
			const verificationCode = this.extractCode(item);
			if (verificationCode) {
				return {
					email: row.email,
					verificationCode,
					subject: item.subject || '',
					from: item.sendEmail || '',
					receivedAt: item.createTime
				};
			}
		}

		return {
			email: row.email,
			verificationCode: null,
			subject: '',
			from: '',
			receivedAt: null
		};
	},

	async selectByAccessKeyForView(c, accessKey) {
		if (!accessKey) {
			throw new BizError('Missing inbox key', 403);
		}

		const row = await orm(c).select().from(inboxKey).where(eq(inboxKey.accessKey, accessKey)).get();
		if (!row) {
			throw new BizError('Inbox key mailbox not found', 404);
		}

		if (row.status === inboxKeyConst.status.CLOSE || this.isReceiveExpired(row) || this.isDeleteExpired(row)) {
			throw new BizError('Inbox key mailbox is disabled or expired', 403);
		}

		return row;
	},

	selectPublicEmailById(c, mail, emailId) {
		return orm(c).select({
			emailId: email.emailId,
			sendEmail: email.sendEmail,
			name: email.name,
			subject: email.subject,
			code: email.code,
			text: email.text,
			content: email.content,
			recipient: email.recipient,
			toEmail: email.toEmail,
			toName: email.toName,
			createTime: email.createTime,
			status: email.status
		}).from(email).where(and(
			eq(email.emailId, emailId),
			sql`${email.toEmail} COLLATE NOCASE = ${mail}`,
			eq(email.type, emailConst.type.RECEIVE),
			eq(email.isDel, isDel.NORMAL),
			ne(email.status, emailConst.status.SAVING)
		)).get();
	},

	resolveDomain(c, domain) {
		let domains = c.env.domain;
		if (typeof domains === 'string') {
			try {
				domains = JSON.parse(domains);
			} catch (e) {
				domains = domains.split(',').map(item => item.trim()).filter(Boolean);
			}
		}

		if (!Array.isArray(domains)) {
			domains = [];
		}

		if (domain) {
			if (!domains.includes(domain)) {
				throw new BizError('Domain is not configured');
			}
			return domain;
		}

		const resolved = domains.find(item => item === 'bianyu.cyou') || domains[0];
		if (!resolved) {
			throw new BizError('No email domain is configured');
		}
		return resolved;
	},

	daysToTime(days, permanent = false) {
		if (permanent || days === null || days === undefined || days === '') {
			return null;
		}

		days = Number(days);
		if (!Number.isFinite(days) || days <= 0) {
			return null;
		}

		return formatDetailDate(toUtc().add(days, 'day'));
	},

	isReceiveExpired(row) {
		return !!row.receiveExpireTime && toUtc(row.receiveExpireTime).isBefore(toUtc());
	},

	isDeleteExpired(row) {
		return !!row.deleteTime && toUtc(row.deleteTime).isBefore(toUtc());
	},

	randomString(length) {
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		const bytes = new Uint8Array(length);
		crypto.getRandomValues(bytes);
		let value = '';
		for (let i = 0; i < length; i++) {
			value += chars[bytes[i] % chars.length];
		}
		return value;
	},

	toPublicEmail(mail) {
		return {
			emailId: mail.emailId,
			sendEmail: mail.sendEmail,
			name: mail.name,
			subject: mail.subject,
			code: mail.code,
			text: mail.text,
			content: mail.content,
			recipient: mail.recipient,
			toEmail: mail.toEmail,
			toName: mail.toName,
			createTime: mail.createTime,
			status: mail.status
		};
	},

	extractCode(mail) {
		const text = [
			mail.subject || '',
			mail.text || '',
			emailUtils.htmlToText(mail.content || '')
		].join('\n');
		const match = text.match(/(?:^|\D)(\d{4,8})(?!\d)/);
		return match ? match[1] : null;
	}
};

export default inboxKeyService
