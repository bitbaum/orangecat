-- Index projects into the search corpus (Phase 4 of build↔find).
--
-- Projects are the "what's being built" side of the market — including work
-- published from Loki. They fit the generic indexable branch (title +
-- description, gated on status='active'); this just reconciles their writes
-- into content_embeddings via the same webhook the supply tables use, so a
-- project becomes discoverable by MEANING, not only exact keyword. Idempotent.
DROP TRIGGER IF EXISTS trg_embed_project_ins ON public.projects;
CREATE TRIGGER trg_embed_project_ins
  AFTER INSERT OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_embedding_reindex('project');

DROP TRIGGER IF EXISTS trg_embed_project_upd ON public.projects;
CREATE TRIGGER trg_embed_project_upd
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  WHEN (
    old.title IS DISTINCT FROM new.title
    OR old.description IS DISTINCT FROM new.description
    OR old.status IS DISTINCT FROM new.status
  )
  EXECUTE FUNCTION public.notify_embedding_reindex('project');
