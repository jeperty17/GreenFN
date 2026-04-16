-- Forward-only corrective migration: ensure required InteractionType values exist.
DO $$
BEGIN
  IF to_regtype('"InteractionType"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumlabel = 'WHATSAPP_DM'
        AND enumtypid = to_regtype('"InteractionType"')
    ) THEN
      ALTER TYPE "InteractionType" ADD VALUE 'WHATSAPP_DM';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumlabel = 'GENERAL_NOTE'
        AND enumtypid = to_regtype('"InteractionType"')
    ) THEN
      ALTER TYPE "InteractionType" ADD VALUE 'GENERAL_NOTE';
    END IF;
  END IF;
END $$;
