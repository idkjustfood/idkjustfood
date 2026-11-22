CREATE TABLE "note" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wish" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"person_id" text,
	"title" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wish_person" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish" ADD CONSTRAINT "wish_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish" ADD CONSTRAINT "wish_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish" ADD CONSTRAINT "wish_person_id_wish_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."wish_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish_person" ADD CONSTRAINT "wish_person_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish_person" ADD CONSTRAINT "wish_person_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_userId_idx" ON "note" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_organizationId_idx" ON "note" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wish_userId_idx" ON "wish" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wish_organizationId_idx" ON "wish" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wish_personId_idx" ON "wish" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "wish_person_userId_idx" ON "wish_person" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wish_person_organizationId_idx" ON "wish_person" USING btree ("organization_id");