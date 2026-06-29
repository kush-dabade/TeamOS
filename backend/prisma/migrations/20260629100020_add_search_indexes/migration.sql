-- Full Text Search index for projects
CREATE INDEX "Project_search_idx"
ON "Project"
USING GIN (
    to_tsvector(
        'simple',
        "name" || ' ' || coalesce("description", '')
    )
);

-- Full Text Search index for tasks
CREATE INDEX "Task_search_idx"
ON "Task"
USING GIN (
    to_tsvector(
        'simple',
        "title" || ' ' || coalesce("description", '')
    )
);