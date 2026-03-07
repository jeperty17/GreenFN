CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_advisor_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_advisor_id', true), '');
$$;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PipelineStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NextStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactChannel" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_is_owner ON "User";
CREATE POLICY user_is_owner ON "User"
FOR ALL
USING ("id" = app.current_advisor_id())
WITH CHECK ("id" = app.current_advisor_id());

DROP POLICY IF EXISTS contact_is_owner ON "Contact";
CREATE POLICY contact_is_owner ON "Contact"
FOR ALL
USING ("advisorId" = app.current_advisor_id())
WITH CHECK ("advisorId" = app.current_advisor_id());

DROP POLICY IF EXISTS pipeline_stage_is_owner ON "PipelineStage";
CREATE POLICY pipeline_stage_is_owner ON "PipelineStage"
FOR ALL
USING ("advisorId" = app.current_advisor_id())
WITH CHECK ("advisorId" = app.current_advisor_id());

DROP POLICY IF EXISTS tag_is_owner ON "Tag";
CREATE POLICY tag_is_owner ON "Tag"
FOR ALL
USING ("advisorId" = app.current_advisor_id())
WITH CHECK ("advisorId" = app.current_advisor_id());

DROP POLICY IF EXISTS message_template_is_owner ON "MessageTemplate";
CREATE POLICY message_template_is_owner ON "MessageTemplate"
FOR ALL
USING ("advisorId" = app.current_advisor_id())
WITH CHECK ("advisorId" = app.current_advisor_id());

DROP POLICY IF EXISTS interaction_via_contact_owner ON "Interaction";
CREATE POLICY interaction_via_contact_owner ON "Interaction"
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "Interaction"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "Interaction"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
);

DROP POLICY IF EXISTS next_step_via_contact_owner ON "NextStep";
CREATE POLICY next_step_via_contact_owner ON "NextStep"
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "NextStep"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "NextStep"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
);

DROP POLICY IF EXISTS conversation_via_contact_owner ON "Conversation";
CREATE POLICY conversation_via_contact_owner ON "Conversation"
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "Conversation"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "Conversation"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
);

DROP POLICY IF EXISTS policy_via_contact_owner ON "Policy";
CREATE POLICY policy_via_contact_owner ON "Policy"
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "Policy"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "Policy"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
);

DROP POLICY IF EXISTS goal_via_contact_owner ON "Goal";
CREATE POLICY goal_via_contact_owner ON "Goal"
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "Goal"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "Goal"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
);

DROP POLICY IF EXISTS contact_tag_via_contact_owner ON "ContactTag";
CREATE POLICY contact_tag_via_contact_owner ON "ContactTag"
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "ContactTag"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "ContactTag"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
);

DROP POLICY IF EXISTS contact_channel_via_contact_owner ON "ContactChannel";
CREATE POLICY contact_channel_via_contact_owner ON "ContactChannel"
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "ContactChannel"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."id" = "ContactChannel"."contactId"
      AND c."advisorId" = app.current_advisor_id()
  )
);

DROP POLICY IF EXISTS message_draft_via_next_step_owner ON "MessageDraft";
CREATE POLICY message_draft_via_next_step_owner ON "MessageDraft"
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM "NextStep" ns
    JOIN "Contact" c ON c."id" = ns."contactId"
    WHERE ns."id" = "MessageDraft"."nextStepId"
      AND c."advisorId" = app.current_advisor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "NextStep" ns
    JOIN "Contact" c ON c."id" = ns."contactId"
    WHERE ns."id" = "MessageDraft"."nextStepId"
      AND c."advisorId" = app.current_advisor_id()
  )
);
