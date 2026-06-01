import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const inboxKey = sqliteTable('inbox_key', {
	inboxKeyId: integer('inbox_key_id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull(),
	accessKey: text('access_key').notNull(),
	status: integer('status').notNull().default(0),
	receiveExpireTime: text('receive_expire_time'),
	deleteTime: text('delete_time'),
	createTime: text('create_time').notNull().default(sql`CURRENT_TIMESTAMP`),
	updateTime: text('update_time').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export default inboxKey
