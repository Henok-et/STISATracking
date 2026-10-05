-- CreateEnum
CREATE TYPE "ResultLevel" AS ENUM ('IMPACT', 'OUTCOME', 'SECTORIAL_PRIORITY', 'STRATEGIC_PRIORITY');

-- CreateEnum
CREATE TYPE "IndicatorDataType" AS ENUM ('INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY', 'BOOLEAN', 'TEXT', 'URL', 'CATEGORICAL');

-- CreateEnum
CREATE TYPE "CalculationMethod" AS ENUM ('PERCENTAGE_CHANGE', 'PERCENTAGE_POINT_CHANGE', 'ABSOLUTE_COUNT', 'ABSOLUTE_VALUE', 'SHARE_OF_TOTAL', 'INDEX_SCORE', 'RATIO', 'BINARY_ACHIEVEMENT', 'CUSTOM', 'UNDEFINED');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_IS_BETTER', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "Provenance" AS ENUM ('SOURCE_DOCUMENT', 'INFERRED_FROM_WORDING', 'PLATFORM_ASSIGNED', 'NOT_PROVIDED');

-- CreateEnum
CREATE TYPE "UnitOfAnalysis" AS ENUM ('COUNTRY', 'CONTINENTAL', 'MIXED');

-- CreateEnum
CREATE TYPE "IndicatorFlag" AS ENUM ('NO_BASELINE_IN_SOURCE', 'NO_TARGET_IN_SOURCE', 'NO_OFFICIAL_CODE_IN_SOURCE', 'NO_DEFINITION_IN_SOURCE', 'NO_METHODOLOGY_IN_SOURCE', 'COMPOUND_STATEMENT', 'DUPLICATE_OF_ANOTHER_ROW', 'OVERLAPS_ANOTHER_ROW', 'REQUIRES_DISAGGREGATION', 'CONTINENTAL_LEVEL_WORDING', 'UNIT_NOT_SPECIFIED', 'AMBIGUOUS_MEASUREMENT_BASIS', 'DIRECTION_INFERRED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FOCAL_POINT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ValueState" AS ENUM ('NOT_REPORTED', 'PENDING_VALIDATION', 'REPORTED', 'NOT_APPLICABLE', 'INVALID');

-- CreateEnum
CREATE TYPE "CyclePhase" AS ENUM ('PHASE_1', 'PHASE_2');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'SUBMISSION_CREATED', 'SUBMISSION_VALUE_CHANGED', 'SUBMISSION_SUBMITTED', 'SUBMISSION_REVIEW_STARTED', 'SUBMISSION_REVISION_REQUESTED', 'SUBMISSION_UNLOCKED', 'SUBMISSION_APPROVED', 'SUBMISSION_PUBLISHED', 'SUBMISSION_UNPUBLISHED', 'USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED', 'USER_COUNTRY_ASSIGNED', 'USER_PASSWORD_RESET', 'INDICATOR_CREATED', 'INDICATOR_UPDATED', 'INDICATOR_DEACTIVATED', 'INDICATOR_VERSION_CREATED', 'COUNTRY_UPDATED', 'REPORTING_CYCLE_CREATED', 'REPORTING_CYCLE_UPDATED', 'EXPORT_GENERATED');

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "iso2" TEXT NOT NULL,
    "iso3" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "resultLevel" "ResultLevel" NOT NULL,
    "resultStatement" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicators" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "officialName" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "definition" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "unitProvenance" "Provenance" NOT NULL,
    "dataType" "IndicatorDataType" NOT NULL,
    "dataTypeProvenance" "Provenance" NOT NULL,
    "calculationMethod" "CalculationMethod" NOT NULL,
    "calculationProvenance" "Provenance" NOT NULL,
    "direction" "Direction" NOT NULL,
    "directionProvenance" "Provenance" NOT NULL,
    "unitOfAnalysis" "UnitOfAnalysis" NOT NULL,
    "flags" "IndicatorFlag"[],
    "ambiguityNote" TEXT,
    "relatedCodes" TEXT[],
    "sourcePage" INTEGER NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sourceRequired" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_versions" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "officialName" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "definition" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "dataType" "IndicatorDataType" NOT NULL,
    "calculationMethod" "CalculationMethod" NOT NULL,
    "direction" "Direction" NOT NULL,
    "unitOfAnalysis" "UnitOfAnalysis" NOT NULL,
    "flags" "IndicatorFlag"[],
    "ambiguityNote" TEXT,
    "required" BOOLEAN NOT NULL,
    "sourceRequired" BOOLEAN NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "changeReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_cycles" (
    "id" TEXT NOT NULL,
    "phase" "CyclePhase" NOT NULL,
    "implementationStartYear" INTEGER NOT NULL,
    "implementationEndYear" INTEGER NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'PLANNED',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FOCAL_POINT',
    "countryId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "organisation" TEXT,
    "phone" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "reportingCycleId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "reportedCount" INTEGER NOT NULL DEFAULT 0,
    "expectedCount" INTEGER NOT NULL DEFAULT 0,
    "completenessPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "revisionRequestedAt" TIMESTAMP(3),
    "revisionRequestedById" TEXT,
    "revisionNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_values" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "indicatorVersionId" TEXT NOT NULL,
    "dataAvailable" BOOLEAN NOT NULL DEFAULT false,
    "baselineValue" DECIMAL(20,6),
    "targetValue" DECIMAL(20,6),
    "actualValue" DECIMAL(20,6),
    "booleanValue" BOOLEAN,
    "textValue" TEXT,
    "categoricalValue" TEXT,
    "baselineYear" INTEGER,
    "currencyCode" TEXT,
    "notes" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "validationStatus" "ValueState" NOT NULL DEFAULT 'NOT_REPORTED',
    "validationMessages" TEXT[],
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "actorEmail" TEXT,
    "actorRole" "UserRole",
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "countryId" TEXT,
    "submissionId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_throttles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "auth_throttles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- CreateIndex
CREATE INDEX "countries_regionId_idx" ON "countries"("regionId");

-- CreateIndex
CREATE INDEX "countries_active_idx" ON "countries"("active");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_code_key" ON "sectors"("code");

-- CreateIndex
CREATE INDEX "sectors_resultLevel_idx" ON "sectors"("resultLevel");

-- CreateIndex
CREATE INDEX "sectors_sortOrder_idx" ON "sectors"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "indicators_code_key" ON "indicators"("code");

-- CreateIndex
CREATE INDEX "indicators_sectorId_idx" ON "indicators"("sectorId");

-- CreateIndex
CREATE INDEX "indicators_active_idx" ON "indicators"("active");

-- CreateIndex
CREATE INDEX "indicators_sortOrder_idx" ON "indicators"("sortOrder");

-- CreateIndex
CREATE INDEX "indicator_versions_indicatorId_idx" ON "indicator_versions"("indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_versions_indicatorId_version_key" ON "indicator_versions"("indicatorId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_cycles_reportingYear_key" ON "reporting_cycles"("reportingYear");

-- CreateIndex
CREATE INDEX "reporting_cycles_status_idx" ON "reporting_cycles"("status");

-- CreateIndex
CREATE INDEX "reporting_cycles_reportingYear_idx" ON "reporting_cycles"("reportingYear");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_countryId_idx" ON "users"("countryId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");

-- CreateIndex
CREATE INDEX "submissions_status_idx" ON "submissions"("status");

-- CreateIndex
CREATE INDEX "submissions_reportingCycleId_status_idx" ON "submissions"("reportingCycleId", "status");

-- CreateIndex
CREATE INDEX "submissions_countryId_idx" ON "submissions"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_countryId_reportingCycleId_key" ON "submissions"("countryId", "reportingCycleId");

-- CreateIndex
CREATE INDEX "submission_values_indicatorId_idx" ON "submission_values"("indicatorId");

-- CreateIndex
CREATE INDEX "submission_values_validationStatus_idx" ON "submission_values"("validationStatus");

-- CreateIndex
CREATE INDEX "submission_values_submissionId_validationStatus_idx" ON "submission_values"("submissionId", "validationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "submission_values_submissionId_indicatorId_key" ON "submission_values"("submissionId", "indicatorId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_countryId_idx" ON "audit_logs"("countryId");

-- CreateIndex
CREATE INDEX "audit_logs_submissionId_idx" ON "audit_logs"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_throttles_key_key" ON "auth_throttles"("key");

-- CreateIndex
CREATE INDEX "auth_throttles_windowStart_idx" ON "auth_throttles"("windowStart");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_versions" ADD CONSTRAINT "indicator_versions_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_versions" ADD CONSTRAINT "indicator_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reportingCycleId_fkey" FOREIGN KEY ("reportingCycleId") REFERENCES "reporting_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_revisionRequestedById_fkey" FOREIGN KEY ("revisionRequestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_values" ADD CONSTRAINT "submission_values_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_values" ADD CONSTRAINT "submission_values_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "indicators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_values" ADD CONSTRAINT "submission_values_indicatorVersionId_fkey" FOREIGN KEY ("indicatorVersionId") REFERENCES "indicator_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_values" ADD CONSTRAINT "submission_values_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
