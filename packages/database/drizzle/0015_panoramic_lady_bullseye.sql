CREATE TABLE "stored_file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stored_file_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stored_file_userId_idx" ON "stored_file" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stored_file_organizationId_idx" ON "stored_file" USING btree ("organization_id");