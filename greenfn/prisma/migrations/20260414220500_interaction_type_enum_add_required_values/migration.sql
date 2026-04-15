-- Expand: add required InteractionType categories while preserving legacy values.
DO $$
BEGIN
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
END $$;
