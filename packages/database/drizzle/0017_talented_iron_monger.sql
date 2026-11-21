CREATE TABLE "calendar_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"title" text NOT NULL,
	"color" text NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_entry" ADD CONSTRAINT "calendar_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entry" ADD CONSTRAINT "calendar_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_entry_userId_idx" ON "calendar_entry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "calendar_entry_organizationId_idx" ON "calendar_entry" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calendar_entry_date_idx" ON "calendar_entry" USING btree ("date");