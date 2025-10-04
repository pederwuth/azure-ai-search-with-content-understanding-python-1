# Chapter Extraction Feature

## Overview

This enhancement adds chapter extraction capabilities to the `search_with_visual_document.ipynb` notebook using Azure AI Content Understanding. The notebook now extracts document structure, including chapters, sections, and their metadata, while maintaining the existing figure analysis functionality.

## Architecture

### Hybrid Approach

The notebook uses a combination of services for optimal results:

1. **Azure Content Understanding (Custom Document Analyzer)**

   - Extracts chapter structure and metadata
   - Uses `documentIntelligencePreprocess` with `prebuilt-layout` as foundation
   - Applies custom language prompts for chapter detection

2. **Azure Document Intelligence (prebuilt-layout)**

   - Detects figure locations with precise bounding boxes
   - Provides span offsets for content insertion
   - Extracts document text as markdown

3. **Azure Content Understanding (Custom Image Analyzer)**
   - Analyzes cropped figures
   - Extracts structured insights from charts and diagrams

## New Files

### `analyzer_templates/document_with_chapters.json`

A custom Content Understanding analyzer template that:

- Preprocesses documents with Document Intelligence `prebuilt-layout`
- Extracts chapter information including:
  - Title
  - Number/identifier
  - Hierarchy level (1 for main chapters, 2 for subsections, etc.)
  - Summary (2-3 sentence overview)
  - Key topics (3-5 main themes)
  - Page start/end numbers
- Extracts document-level metadata (title and summary)

## Modified Cells in Notebook

### New Cell: Document Analyzer Creation

Creates a Content Understanding analyzer for chapter extraction using the custom template.

### Enhanced Cell: Document Analysis

Now performs a 4-step process:

1. **Extract chapters** with Content Understanding
2. **Extract layout and figures** with Document Intelligence
3. **Analyze figures** with Content Understanding
4. **Save enhanced document** with all metadata

### Enhanced Cell: Load Cached Data

Loads chapters and document metadata along with the main content.

### Enhanced Cell: Chunking

- Enriches chunks with chapter metadata
- Adds document-level metadata to all chunks
- Shows statistics about chapter coverage

### Enhanced Cell: Indexing

- Indexes enriched chunks with chapter metadata
- Provides progress feedback

### Enhanced Cell: Retrieval

- Displays chapter information for retrieved documents
- Shows chapter title, topics, and page ranges

## Chapter Metadata Schema

Each chunk can include the following metadata:

```python
{
    # Chapter-specific metadata
    "chapter_title": str,        # e.g., "Executive Summary"
    "chapter_number": str,       # e.g., "1", "Chapter 1", "I"
    "chapter_level": int,        # 1 for main chapters, 2+ for subsections
    "chapter_summary": str,      # Brief chapter summary
    "chapter_topics": str,       # Comma-separated key topics
    "page_start": int,           # Starting page number
    "page_end": int,             # Ending page number

    # Document-level metadata
    "document_title": str,       # Overall document title
    "document_summary": str      # Overall document summary
}
```

## Benefits

1. **Enhanced Search Context**: Search results include chapter information
2. **Better RAG Responses**: LLM can cite specific chapters in answers
3. **Chapter-Scoped Queries**: Ability to filter results by chapter
4. **Richer Metadata**: Each chunk knows its place in the document structure
5. **Backward Compatible**: All existing functionality preserved

## Usage Example

```python
# After running the notebook, you can:

# 1. See chapter structure
print(f"Document has {len(chapters)} chapters")
for chapter in chapters:
    print(f"- {chapter['title']} (Pages {chapter['page_start']}-{chapter['page_end']})")

# 2. Query with chapter context
query = "What was the crude oil production?"
results = retriever.invoke(query)

# Results now include chapter metadata
for doc in results:
    print(f"Found in: {doc.metadata.get('chapter_title')}")
    print(f"Topics: {doc.metadata.get('chapter_topics')}")
```

## Customization

### Modify Chapter Extraction

Edit `analyzer_templates/document_with_chapters.json` to:

- Change the chapter detection prompt
- Add additional fields (e.g., authors, dates, references)
- Modify hierarchy levels
- Extract different document structures

### Adjust Chunking Strategy

Modify the `find_chapter_for_chunk()` function to:

- Use more sophisticated matching algorithms
- Consider page numbers for chapter assignment
- Handle nested sections differently

## Technical Details

### Why Hybrid Approach?

- **Document Intelligence** excels at figure detection with precise bounding boxes
- **Content Understanding** excels at reasoning and extracting inferred fields like chapters
- Using both provides the best of each service

### Performance Considerations

- Chapter extraction adds ~10-30 seconds (one-time per document)
- Figure analysis time unchanged
- Indexing time slightly increased due to richer metadata

## Future Enhancements

Potential improvements:

- Automatic chapter-scoped filtering in queries
- Chapter hierarchy visualization
- Cross-chapter relationship detection
- Table of contents generation
- Citation with chapter references in RAG responses

## Support

For issues or questions about this feature, please refer to:

- [Azure Content Understanding Documentation](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/)
- [Azure Document Intelligence Documentation](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)
