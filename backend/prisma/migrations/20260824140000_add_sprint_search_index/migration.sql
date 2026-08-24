-- Full Text Search index for sprints
CREATE INDEX "Sprint_search_idx"
ON "Sprint"
USING GIN (
    to_tsvector(
        'simple',
        "name" || ' ' || coalesce("goal", '')
    )
);
