---
created_date: 2025-06-05
last_modified_date: 2025-06-05
last_modified_summary: Initial documentation standards guide
---

# Documentation Standards

## Required Fields

Every documentation file must include the following frontmatter:

```yaml
---
created_date: YYYY-MM-DD
last_modified_date: YYYY-MM-DD
last_modified_summary: Brief description of changes
---
```

## Documentation Rules

1. **Check for Existing Documentation**
   - Before creating new documentation, search for similar existing documentation
   - Use the search functionality in your IDE or repository
   - If similar documentation exists, update it instead of creating new files

2. **Update Process**
   - Update the `last_modified_date` whenever changes are made
   - Provide a clear summary of changes in `last_modified_summary`
   - Keep the summary concise but informative

3. **File Organization**
   - Place documentation in appropriate directories under `docs/`
   - Use clear, descriptive filenames
   - Follow the established directory structure

4. **Content Guidelines**
   - Use clear, concise language
   - Include examples where appropriate
   - Keep documentation up-to-date with code changes
   - Use proper markdown formatting

## Using the Template

1. Copy the template from `docs/development/templates/documentation_template.md`
2. Fill in the required frontmatter fields
3. Follow the template structure for consistency

## Best Practices

- Keep documentation close to the code it documents
- Update documentation when updating related code
- Include code examples where relevant
- Use proper formatting and structure
- Link related documentation
- Include references to external resources when applicable
