ALTER TABLE "meal_plan_meal" DROP CONSTRAINT "meal_plan_meal_slot_unique";--> statement-breakpoint
CREATE INDEX "meal_plan_meal_day_idx" ON "meal_plan_meal" USING btree ("plan_id","date");--> statement-breakpoint
ALTER TABLE "meal_plan_meal" ADD CONSTRAINT "meal_plan_meal_recipe_unique" UNIQUE("plan_id","date","slot","recipe_id");