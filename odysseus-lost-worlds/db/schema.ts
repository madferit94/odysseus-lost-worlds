import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const runs = sqliteTable('runs', {
 id: text('id').primaryKey(), playerKey: text('player_key'), startedAt: integer('started_at').notNull(),
 submittedAt: integer('submitted_at'), nickname: text('nickname'),
 score: integer('score'), elapsed: integer('elapsed'), normalKills: integer('normal_kills'),
 bossKills: integer('boss_kills'), damageTaken: integer('damage_taken'), retries: integer('retries'),
}, t => [index('idx_runs_ranking').on(t.score,t.elapsed,t.submittedAt)]);

// Anonymous page-load IDs prevent duplicate counting when requests are retried.
export const pageViews = sqliteTable('page_views', {
 id: text('id').primaryKey(), viewedAt: integer('viewed_at').notNull(),
});

export const playSessions=sqliteTable('play_sessions',{
 id:text('id').primaryKey(),tokenHash:text('token_hash').notNull(),startedAt:integer('started_at').notNull(),
 version:text('version').notNull(),difficulty:text('difficulty').notNull(),source:text('source').notNull(),
 isTest:integer('is_test').notNull(),consentVersion:text('consent_version').notNull(),
},t=>[index('idx_play_sessions_started').on(t.startedAt)]);
export const playEvents=sqliteTable('play_events',{
 sessionId:text('session_id').notNull().references(()=>playSessions.id),seq:integer('seq').notNull(),receivedAt:integer('received_at').notNull(),
 name:text('name').notNull(),activeMs:integer('active_ms').notNull(),stage:integer('stage').notNull(),attempt:integer('attempt').notNull(),
 hp:integer('hp').notNull(),energy:integer('energy').notNull(),lives:integer('lives').notNull(),damageTaken:integer('damage_taken').notNull(),
 normalKills:integer('normal_kills').notNull(),bossKills:integer('boss_kills').notNull(),retries:integer('retries').notNull(),
 god:text('god').notNull(),boss:text('boss').notNull(),outcome:text('outcome').notNull(),durationMs:integer('duration_ms').notNull(),
},t=>[primaryKey({columns:[t.sessionId,t.seq]}),index('idx_play_events_received').on(t.receivedAt)]);
