# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A song list website designed for Virtual YouTubers (Vup/Vtuber), built with React and deployed to GitHub Pages.

## Architecture

The project consists of two main components:

### 1. Local Management Tool (`/admin`)
An HTML-based admin interface for the site owner to:
- **Song Metadata Management**: Upload/read Excel files containing partial song info (song name, artist), then fetch complete metadata from music platforms (title, artist, album, release date, lyrics, language) with manual confirmation
- **Resource Organization**: Store metadata locally in `Resources/` folder, organized by `artist/album/` structure
- **Visual Customization**: Upload background image and streamer avatar
- **Link Configuration**: Set two links displayed below the avatar (typically social media profiles)
- **Static Site Generation**: Generate the deployable static site based on Resources folder content and settings

### 2. Generated Static Site (`/dist`)
A React-based static website with:
- Song list sorted by artist's first letter (pinyin/initial)
- Language filtering
- Search functionality (song name, artist, lyrics)
- One-click copy: clicking a song copies "点歌 {歌名} - {歌手}" to clipboard

## Directory Structure

```
/
├── admin/              # Local management tool (HTML/JS)
├── src/                # React source for generated site
├── Resources/          # Local song metadata storage
│   └── {artist}/
│       └── {album}/
│           └── {song}.json
├── dist/               # Generated static site output
└── public/             # Static assets (background, avatar, etc.)
```

## Metadata Format

Each song stored as JSON in `Resources/{artist}/{album}/{song}.json`:
```json
{
  "title": "歌曲名",
  "artist": "歌手",
  "album": "专辑",
  "releaseDate": "2024-01-01",
  "lyrics": "歌词内容",
  "language": "中文/日语/英语/..."
}
```

## Development Commands

```bash
# Install dependencies
npm install

# Run local admin tool
npm run admin

# Development server for generated site
npm run dev

# Build static site for production
npm run build

# Generate site from Resources (triggers build)
npm run generate

# Deploy to GitHub Pages
npm run deploy
```

## Key Implementation Notes

- **Music API**: Use free public music APIs (e.g., NetEase Cloud Music API) for metadata fetching
- **Excel Parsing**: Use SheetJS (xlsx) library for reading Excel files
- **Pinyin Sorting**: Use pinyin-pro or similar library for Chinese character sorting
- **Clipboard API**: Use modern Clipboard API for copy functionality
- **GitHub Pages**: Use gh-pages package for deployment
