CREATE TABLE "file_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stored_file" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "file_folder" ADD CONSTRAINT "file_folder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_folder" ADD CONSTRAINT "file_folder_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_folder_userId_idx" ON "file_folder" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "file_folder_organizationId_idx" ON "file_folder" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_folder_id_file_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."file_folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stored_file_folderId_idx" ON "stored_file" USING btree ("folder_id");