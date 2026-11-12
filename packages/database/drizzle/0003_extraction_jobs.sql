CREATE TABLE "extraction_job" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"kind" text NOT NULL,
	"url" text,
	"text" text,
	"image" "bytea",
	"image_type" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"error" text,
	"recipe_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extraction_job" ADD CONSTRAINT "extraction_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_job" ADD CONSTRAINT "extraction_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_job" ADD CONSTRAINT "extraction_job_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extraction_job_userId_idx" ON "extraction_job" USING btree ("user_id");