CREATE TABLE "money_bill" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"title" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"category_id" text,
	"repeat" text NOT NULL,
	"next_due" text,
	"day_of_month" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_budget" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"category_id" text,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_category" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"key" text,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_expense" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"amount_cents" integer NOT NULL,
	"category_id" text,
	"date" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"paid_by" text NOT NULL,
	"bill_id" text,
	"receipt_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"file_id" text,
	"status" text NOT NULL,
	"shop" text,
	"date" text,
	"total_cents" integer,
	"expense_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_savings_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_savings_goal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"target_cents" integer NOT NULL,
	"target_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"currency" text NOT NULL,
	"categories_seeded" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "money_bill" ADD CONSTRAINT "money_bill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_bill" ADD CONSTRAINT "money_bill_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_bill" ADD CONSTRAINT "money_bill_category_id_money_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."money_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_budget" ADD CONSTRAINT "money_budget_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_budget" ADD CONSTRAINT "money_budget_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_budget" ADD CONSTRAINT "money_budget_category_id_money_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."money_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_category" ADD CONSTRAINT "money_category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_category" ADD CONSTRAINT "money_category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_expense" ADD CONSTRAINT "money_expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_expense" ADD CONSTRAINT "money_expense_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_expense" ADD CONSTRAINT "money_expense_category_id_money_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."money_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_expense" ADD CONSTRAINT "money_expense_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_expense" ADD CONSTRAINT "money_expense_bill_id_money_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."money_bill"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_receipt" ADD CONSTRAINT "money_receipt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_receipt" ADD CONSTRAINT "money_receipt_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_receipt" ADD CONSTRAINT "money_receipt_file_id_stored_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."stored_file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_savings_entry" ADD CONSTRAINT "money_savings_entry_goal_id_money_savings_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."money_savings_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_savings_goal" ADD CONSTRAINT "money_savings_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_savings_goal" ADD CONSTRAINT "money_savings_goal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_settings" ADD CONSTRAINT "money_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_settings" ADD CONSTRAINT "money_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "money_bill_userId_idx" ON "money_bill" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "money_bill_organizationId_idx" ON "money_bill" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "money_budget_userId_idx" ON "money_budget" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "money_budget_organizationId_idx" ON "money_budget" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "money_category_userId_idx" ON "money_category" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "money_category_organizationId_idx" ON "money_category" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "money_expense_userId_idx" ON "money_expense" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "money_expense_organizationId_idx" ON "money_expense" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "money_expense_date_idx" ON "money_expense" USING btree ("date");--> statement-breakpoint
CREATE INDEX "money_receipt_userId_idx" ON "money_receipt" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "money_receipt_organizationId_idx" ON "money_receipt" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "money_savings_entry_goalId_idx" ON "money_savings_entry" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "money_savings_goal_userId_idx" ON "money_savings_goal" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "money_savings_goal_organizationId_idx" ON "money_savings_goal" USING btree ("organization_id");