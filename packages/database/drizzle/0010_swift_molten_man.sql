CREATE TABLE "pantry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantry_item" (
	"id" text PRIMARY KEY NOT NULL,
	"pantry_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pantry" ADD CONSTRAINT "pantry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry" ADD CONSTRAINT "pantry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_pantry_id_pantry_id_fk" FOREIGN KEY ("pantry_id") REFERENCES "public"."pantry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_organizationId_idx" ON "pantry" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_personal_userId_idx" ON "pantry" USING btree ("user_id") WHERE "pantry"."organization_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_item_pantryId_key_idx" ON "pantry_item" USING btree ("pantry_id","key");