-- Allow unassigning a delivery lead from a project.
ALTER TABLE "engagements" ALTER COLUMN "intern_id" DROP NOT NULL;
