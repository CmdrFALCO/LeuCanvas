# SemantiCanvas MCP Server

MCP (Model Context Protocol) server that exposes your SemantiCanvas knowledge base to Claude Desktop, Claude Code, and other MCP-compatible clients.

## Features

- **Semantic Search**: Search notes by meaning, not just keywords
- **Note Creation**: Create new notes with automatic duplicate detection
- **Related Notes**: Find semantically related content
- **Tag Filtering**: List and filter notes by tags

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Data Location

The MCP server reads/writes notes from:
- **Notes file**: `~/.semanticanvas/notes.json` (exported from SemantiCanvas browser app)
- **Pending file**: `~/.semanticanvas/pending.json` (new notes created via MCP, to be imported by browser app)

## Tools

### search_notes
Semantically search through your knowledge base.

```json
{
  "query": "how do embeddings work",
  "limit": 10,
  "minSimilarity": 0.5
}
```

### create_note
Create a new note with automatic duplicate detection.

```json
{
  "title": "My Note Title",
  "content": "Note content here...",
  "tags": ["tag1", "tag2"]
}
```

### get_note
Retrieve a specific note by ID.

```json
{
  "id": "note-id-here"
}
```

### find_related
Find notes related to a specific note or text.

```json
{
  "noteId": "note-id-here",
  "limit": 5
}
```
or
```json
{
  "text": "some text to find related notes for",
  "limit": 5
}
```

### list_notes
List all notes with optional tag filtering and pagination.

```json
{
  "tags": ["AI", "ML"],
  "limit": 50,
  "offset": 0
}
```

## Claude Desktop Configuration

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "semanticanvas": {
      "command": "node",
      "args": ["C:\\Projects\\LeuCanvas-1\\mcp-server\\dist\\index.js"]
    }
  }
}
```

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Architecture

```
Browser App (IndexedDB)
        |
        | export on changes
        v
~/.semanticanvas/notes.json
        |
        | read on startup
        v
MCP Server (Node.js)
        |
        | embeddings in memory
        v
Vector Index (Map<id, number[]>)
```

## Embedding Model

Uses `Xenova/all-MiniLM-L6-v2` (384 dimensions) via Transformers.js for client-side embedding generation.
