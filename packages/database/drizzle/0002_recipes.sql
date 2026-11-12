CREATE TABLE "recipe" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"servings" integer NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"nutrition" jsonb NOT NULL,
	"source" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_userId_idx" ON "recipe" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_organizationId_idx" ON "recipe" USING btree ("organization_id");