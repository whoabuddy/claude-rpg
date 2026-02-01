# Quest: Claude RPG v2.1 - Complete Remaining Features

## Goal

Complete the remaining features after the v2 launch, focusing on utility features (audio transcription, repo cloning, scratchpad) and deeper RPG integration.

## Status

**Created:** 2026-01-29
**Status:** active

## Linked Issues

| Issue | Title | Priority | Complexity |
|-------|-------|----------|------------|
| #151 | Deepen RPG integration | High | Large |
| #153 | Transcribe audio file | Medium | Small |
| #154 | Paste GitHub link to clone into dev | Medium | Small |
| #156 | Scratchpad for notes | Medium | Medium |

## Repositories

- `whoabuddy/claude-rpg` (primary)

## Strategy

Build utility features first (phases 1-3) to establish patterns and deliver quick wins, then tackle the larger RPG integration (phases 4-6) incrementally. Each utility feature is small and self-contained, while RPG features build on each other.

## Phases Overview

1. **Add audio file transcription page** - #153 (full)
2. **Add GitHub repo clone endpoint** - #154 (full)
3. **Add scratchpad foundation** - #156 (partial: storage + basic UI)
4. **Deepen persona progression** - #151 (partial: tiers, badges, traits)
5. **Add persona health and challenges** - #151 (partial: health/morale, daily challenges)
6. **Complete scratchpad workflow** - #156 (full: voice, triage, GitHub integration)
7. **Add project aggregation and narrative** - #151 (remaining: team stats, narrative generator)

## Notes

- whisper.cpp is already set up locally
- VoiceButton and transcription hook exist in v1 server
- Persona types exist but need expansion for RPG depth
- Database schema may need migrations for new fields
