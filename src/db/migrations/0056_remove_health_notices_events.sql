-- Removes three automation wave 2 features the owner dropped on 11 Nov 2026: client health and the
-- SLA ladder (client_health_scores, sla_escalations), the notice desk (notice_cases) and company
-- events (company_events). All four tables came from 0051_automation and nothing else references
-- them. Their rows are deleted with them. Expiries (expiry_items, expiry_alerts) stay: they now
-- show on every role's compliance calendar.
DROP TABLE IF EXISTS "notice_cases" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "company_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "client_health_scores" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sla_escalations" CASCADE;
