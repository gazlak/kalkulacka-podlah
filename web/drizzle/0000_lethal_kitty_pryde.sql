CREATE TABLE "calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"number" text,
	"status" text DEFAULT 'koncept' NOT NULL,
	"sent_to" text,
	"job" jsonb NOT NULL,
	"groups" jsonb NOT NULL,
	"pattern_id" integer,
	"discount" jsonb NOT NULL,
	"vat_rate" double precision NOT NULL,
	"extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calculations_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calculation_id" uuid,
	"user_id" uuid,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"ok" boolean NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patterns" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"texture" text NOT NULL,
	"tint" text NOT NULL,
	"photo_file_id" text,
	"material_per_m2" double precision NOT NULL,
	"waste_pct" double precision NOT NULL,
	"labor_per_tread" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"riser_surcharge" double precision NOT NULL,
	"transport" double precision NOT NULL,
	"vat_default" double precision NOT NULL,
	"vat_options" jsonb NOT NULL,
	"round_to" double precision NOT NULL,
	"extras_enabled" boolean DEFAULT false NOT NULL,
	"extras" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'pozván' NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"name" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"ico" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"logo_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_log" ADD CONSTRAINT "mail_log_calculation_id_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_log" ADD CONSTRAINT "mail_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calculations_owner_idx" ON "calculations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");