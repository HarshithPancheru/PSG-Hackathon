# server/ README

This is the simple local Node.js backend for the hackathon prototype.

## What this server provides

- Socket.IO events for signaling, transcripts, MOM generation (see API spec).
- REST endpoints for health check, listing rooms, requesting MOM, and posting mock transcripts.
- In-memory store (no DB). Meant for local hackathon/demo only.

## How to run

1. Install dependencies (if not done already)
```bash
cd server
npm install express socket.io
