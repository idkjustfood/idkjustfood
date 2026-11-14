CREATE TABLE "meal_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_meal" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"date" text NOT NULL,
	"slot" text NOT NULL,
	"recipe_id" text NOT NULL,
	"servings" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plan_meal_slot_unique" UNIQUE("plan_id","date","slot")
);
--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_meal" ADD CONSTRAINT "meal_plan_meal_plan_id_meal_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_meal" ADD CONSTRAINT "meal_plan_meal_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_plan_userId_idx" ON "meal_plan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meal_plan_organizationId_idx" ON "meal_plan" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "meal_plan_meal_recipeId_idx" ON "meal_plan_meal" USING btree ("recipe_id");