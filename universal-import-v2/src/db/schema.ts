import { pgTable, text, timestamp, jsonb, integer, uuid, varchar } from 'drizzle-orm/pg-core';

// 规则表
export const rules = pgTable('rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  fileType: varchar('file_type', { length: 20 }).notNull(), // excel | pdf | word
  config: jsonb('config').notNull(), // RuleConfig JSON
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 导入批次表
export const importBatches = pgTable('import_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  ruleId: uuid('rule_id').references(() => rules.id),
  totalCount: integer('total_count').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  failCount: integer('fail_count').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | processing | completed | failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 运单表
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalCode: varchar('external_code', { length: 255 }),
  storeName: varchar('store_name', { length: 500 }),
  receiverName: varchar('receiver_name', { length: 255 }),
  receiverPhone: varchar('receiver_phone', { length: 50 }),
  receiverAddress: text('receiver_address'),
  skuCode: varchar('sku_code', { length: 255 }).notNull(),
  skuName: varchar('sku_name', { length: 500 }).notNull(),
  skuQuantity: integer('sku_quantity').notNull(),
  skuSpec: varchar('sku_spec', { length: 500 }),
  remark: text('remark'),
  batchId: uuid('batch_id').references(() => importBatches.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Types
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
