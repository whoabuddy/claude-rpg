# Changelog

## [2.2.0](https://github.com/whoabuddy/claude-rpg/compare/v2.1.0...v2.2.0) (2026-02-01)


### Features

* terminal reliability, personas, and UI improvements ([#191](https://github.com/whoabuddy/claude-rpg/issues/191)) ([fb28556](https://github.com/whoabuddy/claude-rpg/commit/fb28556a9afb956aa5080a2bf3b7afdb4fa96a65))
* terminal responsiveness, notifications, and voice improvements ([#192](https://github.com/whoabuddy/claude-rpg/issues/192)) ([e8041f5](https://github.com/whoabuddy/claude-rpg/commit/e8041f541acb33ec2e2126bb4f4d06ca1fe837ce))
* **terminal:** improve capture reliability and reduce bandwidth ([#194](https://github.com/whoabuddy/claude-rpg/issues/194)) ([bcd16c1](https://github.com/whoabuddy/claude-rpg/commit/bcd16c155f61e8968300b63f679238b119824bbc))
* v2.2 issue cleanup - fix bugs, consolidate pages, enhance UI ([#185](https://github.com/whoabuddy/claude-rpg/issues/185)) ([d2da04f](https://github.com/whoabuddy/claude-rpg/commit/d2da04f713141bc14105853210c58020f00c8d93))
* v2.3 cleanup - fixes, perf, and code quality ([#190](https://github.com/whoabuddy/claude-rpg/issues/190)) ([d17af74](https://github.com/whoabuddy/claude-rpg/commit/d17af7494d95aa9902d6a35f965e6a822a60ecea))


### Bug Fixes

* **hooks:** handle Claude Code event type field names ([#193](https://github.com/whoabuddy/claude-rpg/issues/193)) ([e7baf4c](https://github.com/whoabuddy/claude-rpg/commit/e7baf4cb4531a12d99feb6976be087be904c14f2))
* **notifications:** handle browsers that don't support Notification constructor ([#196](https://github.com/whoabuddy/claude-rpg/issues/196)) ([b49b000](https://github.com/whoabuddy/claude-rpg/commit/b49b000ba1c3e530250fafdce5ab835ecb148a04))
* **terminal:** capture current content instead of stale cache ([#198](https://github.com/whoabuddy/claude-rpg/issues/198)) ([6415bfc](https://github.com/whoabuddy/claude-rpg/commit/6415bfccadc76704fb47d1012d95064fd5be2f42))
* **terminal:** disable diffs until per-client tracking implemented ([#195](https://github.com/whoabuddy/claude-rpg/issues/195)) ([22dddff](https://github.com/whoabuddy/claude-rpg/commit/22dddffe4c5ca1009a51561862664bffb0cfceff))
* **ui:** correct header title and subtitle order ([#189](https://github.com/whoabuddy/claude-rpg/issues/189)) ([09ed03d](https://github.com/whoabuddy/claude-rpg/commit/09ed03d8538561808f0f6df540570b5bb119edc8)), closes [#186](https://github.com/whoabuddy/claude-rpg/issues/186)

## [2.1.0](https://github.com/whoabuddy/claude-rpg/compare/v2.0.0...v2.1.0) (2026-01-30)


### Features

* White Rabbit font and quest data cleanup ([#181](https://github.com/whoabuddy/claude-rpg/issues/181)) ([9e687d3](https://github.com/whoabuddy/claude-rpg/commit/9e687d37968f1b21ffb77cde2715eae82f54c1a4))

## [2.0.0](https://github.com/whoabuddy/claude-rpg/compare/v1.11.1...v2.0.0) (2026-01-30)


### ⚠ BREAKING CHANGES

* Complete rewrite of server and client architecture

### Features

* v2.0.0 architecture rewrite ([#175](https://github.com/whoabuddy/claude-rpg/issues/175)) ([9b34d87](https://github.com/whoabuddy/claude-rpg/commit/9b34d87767abb80e9b1eefb54882be7937e4169b))
* v2.0.0 stability and reliability improvements ([#162](https://github.com/whoabuddy/claude-rpg/issues/162)) ([57f5424](https://github.com/whoabuddy/claude-rpg/commit/57f5424fb27dbfbeae4ad82b35f1771d47775ed8))


### Bug Fixes

* **server:** capture terminal content to actual bottom of scrollback ([#174](https://github.com/whoabuddy/claude-rpg/issues/174)) ([af77c5e](https://github.com/whoabuddy/claude-rpg/commit/af77c5e36b66e1d65878a240924abbb5512d9832))

## [2.0.0] - 2026-01-30

### Major Release: Stability and Reliability Improvements

This release focuses on fixing critical issues identified in v1.x, ensuring stable operation through Cloudflare tunnels, and completing unimplemented features. All core data flows are now working correctly with comprehensive test coverage.

### Added

#### WebSocket Heartbeat System
- **feat(server):** add heartbeat tracking to WebSocket handlers ([10d35a5](https://github.com/whoabuddy/claude-rpg/commit/10d35a5))
- **feat(server):** create heartbeat module for connection keepalive ([f894384](https://github.com/whoabuddy/claude-rpg/commit/f894384))
- **feat(server):** wire heartbeat into server lifecycle ([eeea877](https://github.com/whoabuddy/claude-rpg/commit/eeea877))

Implements ping/pong mechanism to keep WebSocket connections alive through reverse proxies and tunnels. Prevents silent connection timeouts after ~100s of inactivity.

#### Avatar System Improvements
- **feat(server):** add /api/avatars/:seed endpoint to serve cached avatars ([d6d13a6](https://github.com/whoabuddy/claude-rpg/commit/d6d13a6))

Local caching endpoint for Bitcoin faces avatars, reducing external API calls and improving reliability.

### Fixed

#### Terminal Content Data Flow
- **fix(client):** update usePaneTerminal hook to use Zustand store ([04d60ff](https://github.com/whoabuddy/claude-rpg/commit/04d60ff))
- **feat(server):** add terminal capture and broadcast to polling loop ([b9f1bb8](https://github.com/whoabuddy/claude-rpg/commit/b9f1bb8))
- **fix(server):** correct terminal_output broadcast message structure ([b657506](https://github.com/whoabuddy/claude-rpg/commit/b657506))
- **fix(server):** update TerminalOutputMessage type to use payload wrapper ([13bf89d](https://github.com/whoabuddy/claude-rpg/commit/13bf89d))

Restored terminal content visibility by fixing broken data pipeline. Terminal content now flows from tmux poller → WebSocket → Zustand store → React components correctly.

#### Avatar Loading
- **fix(server):** use correct bitcoinfaces API and add local caching ([1e99495](https://github.com/whoabuddy/claude-rpg/commit/1e99495))
- **fix(client):** add error handling to PaneAvatar component ([c01ef70](https://github.com/whoabuddy/claude-rpg/commit/c01ef70))
- **fix(server):** remove unused getFallbackAvatarUrl export ([09ae644](https://github.com/whoabuddy/claude-rpg/commit/09ae644))

Fixed avatar API endpoint (now uses `/api/get-image/<seed>`), added local disk caching, removed dicebear fallback. UI now shows initials gracefully when avatars fail to load.

#### Security and Configuration
- **fix(server):** use request origin for CORS instead of wildcard ([8158c04](https://github.com/whoabuddy/claude-rpg/commit/8158c04))

Replaced overly permissive `*` CORS with request origin validation for better security.

#### Feature Completion
- **fix(server):** enforce challenge XP service initialization ([e453020](https://github.com/whoabuddy/claude-rpg/commit/e453020))

Properly initialized challenge XP service that was previously unimplemented, enabling challenge tracking.

### Documentation

- **docs(server):** document why tmux session attached status is hardcoded ([fdc14dd](https://github.com/whoabuddy/claude-rpg/commit/fdc14dd))

Added explanation for tmux attachment status implementation decision.

### Chore

- **chore(server):** replace console.error with logger in whisper module ([971efc2](https://github.com/whoabuddy/claude-rpg/commit/971efc2))

Standardized logging across all modules for consistency.

### Breaking Changes

None. This release maintains full backward compatibility with v1.x databases and configurations.

### Testing

- All 185 tests passing
- Full build verification completed
- Manual testing through Cloudflare tunnel confirmed stable

### Migration Notes

No migration required. Existing installations will work without changes.

---

## [1.11.1](https://github.com/whoabuddy/claude-rpg/compare/v1.11.0...v1.11.1) (2026-01-29)


### Bug Fixes

* address critical audit findings ([#160](https://github.com/whoabuddy/claude-rpg/issues/160)) ([d4a82cc](https://github.com/whoabuddy/claude-rpg/commit/d4a82cc69be8131aaf3465eb71b3453c12f4764f))

## [1.11.0](https://github.com/whoabuddy/claude-rpg/compare/v1.10.0...v1.11.0) (2026-01-29)


### Features

* add personas, scratchpad, and projects features ([#158](https://github.com/whoabuddy/claude-rpg/issues/158)) ([a75e32b](https://github.com/whoabuddy/claude-rpg/commit/a75e32bb05c719764da40d31ea271227f8c23c25))

## [1.10.0](https://github.com/whoabuddy/claude-rpg/compare/v1.9.0...v1.10.0) (2026-01-29)


### Features

* v2 - Modern server and client rewrite ([#155](https://github.com/whoabuddy/claude-rpg/issues/155)) ([244d45d](https://github.com/whoabuddy/claude-rpg/commit/244d45d94d8cfea6cdb0f6a15e545e3f7bd39116))

## [1.9.0](https://github.com/whoabuddy/claude-rpg/compare/v1.8.1...v1.9.0) (2026-01-29)


### Features

* **quests:** add archive system for manual quest completion ([#108](https://github.com/whoabuddy/claude-rpg/issues/108)) ([731f7f0](https://github.com/whoabuddy/claude-rpg/commit/731f7f09d2756dbf7fd9fb389b30b0cc18f0c972))

## [1.8.1](https://github.com/whoabuddy/claude-rpg/compare/v1.8.0...v1.8.1) (2026-01-28)


### Bug Fixes

* resolve remaining issues ([#100](https://github.com/whoabuddy/claude-rpg/issues/100), [#101](https://github.com/whoabuddy/claude-rpg/issues/101), [#102](https://github.com/whoabuddy/claude-rpg/issues/102)) ([#105](https://github.com/whoabuddy/claude-rpg/issues/105)) ([0d4c551](https://github.com/whoabuddy/claude-rpg/commit/0d4c551e3f0d5ba4b0bc2bbbadd03107d2790f80))

## [1.8.0](https://github.com/whoabuddy/claude-rpg/compare/v1.7.0...v1.8.0) (2026-01-28)


### Features

* resolve all 11 open issues ([#89](https://github.com/whoabuddy/claude-rpg/issues/89)-99) ([#103](https://github.com/whoabuddy/claude-rpg/issues/103)) ([e223db7](https://github.com/whoabuddy/claude-rpg/commit/e223db75665a50a83ec57050993168344fe203e7))

## [1.7.0](https://github.com/whoabuddy/claude-rpg/compare/v1.6.1...v1.7.0) (2026-01-27)


### Features

* add quest tracking with server, data model, and UI ([#76](https://github.com/whoabuddy/claude-rpg/issues/76)) ([17bb494](https://github.com/whoabuddy/claude-rpg/commit/17bb494094c5a582002e976baf1986b965b75470))
* **ui:** game HUD button layouts & responsive design ([#74](https://github.com/whoabuddy/claude-rpg/issues/74)) ([80e9625](https://github.com/whoabuddy/claude-rpg/commit/80e9625f9b85f7ce8f88aca87ce63a3aeb737082))


### Bug Fixes

* usability bugs and UI polish ([#66](https://github.com/whoabuddy/claude-rpg/issues/66), [#67](https://github.com/whoabuddy/claude-rpg/issues/67), [#68](https://github.com/whoabuddy/claude-rpg/issues/68), [#77](https://github.com/whoabuddy/claude-rpg/issues/77), [#78](https://github.com/whoabuddy/claude-rpg/issues/78)) ([#79](https://github.com/whoabuddy/claude-rpg/issues/79)) ([d5c672a](https://github.com/whoabuddy/claude-rpg/commit/d5c672a5a4f963337a826b421f0ae05c86cd699d))

## [1.6.1](https://github.com/whoabuddy/claude-rpg/compare/v1.6.0...v1.6.1) (2026-01-26)


### Bug Fixes

* add missing features to FullScreenPane and slim down PaneCard ([76b0a6f](https://github.com/whoabuddy/claude-rpg/commit/76b0a6f0e64357dce6162c04768ddbb895ff73e5))
* wire ActionButton into PaneCard, use StatusIndicator in FullScreenPane ([14cac30](https://github.com/whoabuddy/claude-rpg/commit/14cac3064ad0a025eb045dcbeb926a2fc3e4df67))

## [1.6.0](https://github.com/whoabuddy/claude-rpg/compare/v1.5.0...v1.6.0) (2026-01-26)


### Features

* add window rename with duplicate name prevention ([a4bda83](https://github.com/whoabuddy/claude-rpg/commit/a4bda83d08805a7fecd0b794a5361477738e1d5a))
* resilient prompt sending with last-prompt recovery ([c46feda](https://github.com/whoabuddy/claude-rpg/commit/c46fedaf71a3b8bd3da2ec7e47bd00d52edfee15))


### Bug Fixes

* update hooks setup for new Claude Code matcher format ([8d7ad51](https://github.com/whoabuddy/claude-rpg/commit/8d7ad512de81149432e96cdafc2796671ba6704f))

## [1.5.0](https://github.com/whoabuddy/claude-rpg/compare/v1.4.0...v1.5.0) (2026-01-26)


### Features

* production deploy with dev backend proxy ([a83eff9](https://github.com/whoabuddy/claude-rpg/commit/a83eff9253904771a7a1247e6385a929a2410181))


### Bug Fixes

* correct compiled output paths for dist/server/server/ layout ([4cc9b07](https://github.com/whoabuddy/claude-rpg/commit/4cc9b07af089f5dec97b240baef5508191d108ab))

## [1.4.0](https://github.com/whoabuddy/claude-rpg/compare/v1.3.1...v1.4.0) (2026-01-26)


### Features

* RPG feature flag, terminal reliability, input safety, ANSI rendering ([8c12164](https://github.com/whoabuddy/claude-rpg/commit/8c12164c69d12405a42bded4c05f2f06f6161f3c))
* smart polling with tmux control mode integration ([#57](https://github.com/whoabuddy/claude-rpg/issues/57)) ([1918fe4](https://github.com/whoabuddy/claude-rpg/commit/1918fe4447a11f53ae370a5c9cd76002bf2d2af4))


### Bug Fixes

* disable control mode causing tmux scrollback issues ([852ebc0](https://github.com/whoabuddy/claude-rpg/commit/852ebc0a9693cb95d4aa79c35d4046cac338ea8a))
* optimize re-renders, extract cleanup helper, add disconnect banner ([343ed4d](https://github.com/whoabuddy/claude-rpg/commit/343ed4d75953b7bed69922c0bb84c58ff059b4b7))
* resolve stuck 'working' status by fixing reconciliation timing ([d7f25e5](https://github.com/whoabuddy/claude-rpg/commit/d7f25e5108455f38fc0e17e5a1b75478c19fc397))
* terminal update reliability and mobile layout ([26ea6b6](https://github.com/whoabuddy/claude-rpg/commit/26ea6b674c318a1b0d5681bcbb4d313b779658dd))

## [1.3.1](https://github.com/whoabuddy/claude-rpg/compare/v1.3.0...v1.3.1) (2026-01-23)


### Bug Fixes

* prevent O(n²) startup hang with large event history ([2e7771e](https://github.com/whoabuddy/claude-rpg/commit/2e7771e36c032db1988245b2f515b37437c8d31e))
* resolve memory leaks causing SIGILL after overnight use ([b53cc78](https://github.com/whoabuddy/claude-rpg/commit/b53cc780b7d29946718f1f64fb75153d7ec955f7)), closes [#51](https://github.com/whoabuddy/claude-rpg/issues/51)

## [1.3.0](https://github.com/whoabuddy/claude-rpg/compare/v1.2.0...v1.3.0) (2026-01-23)


### Features

* add create window button and remove pro mode toggle ([1c4aef4](https://github.com/whoabuddy/claude-rpg/commit/1c4aef41e7a837cec5f7c74114ba10150074fd6b))
* add multi-VM deployment scripts ([b281293](https://github.com/whoabuddy/claude-rpg/commit/b281293e6c3f4407b8e9df15b2171ef283a8f8e0))


### Bug Fixes

* improve leaderboard layout and prompt display ([212e05e](https://github.com/whoabuddy/claude-rpg/commit/212e05e90f0755967122bd5287140bf40a10a291))
* show /clear in Prompt field when session is cleared ([1759ef6](https://github.com/whoabuddy/claude-rpg/commit/1759ef64eee7dea0f4147a07dcd16dd911d8bc58))
* use full event history for competition stats ([6be7868](https://github.com/whoabuddy/claude-rpg/commit/6be7868a657c8e431e4a3631c8cf95671450b54e)), closes [#49](https://github.com/whoabuddy/claude-rpg/issues/49)

## [1.2.0](https://github.com/whoabuddy/claude-rpg/compare/v1.1.0...v1.2.0) (2026-01-22)


### Features

* terminal-first prompt detection for permission and question prompts ([854c2fa](https://github.com/whoabuddy/claude-rpg/commit/854c2fac5b680dfb445c159cb18a2e4b8bdc9b9c))

## [1.1.0](https://github.com/whoabuddy/claude-rpg/compare/v1.0.2...v1.1.0) (2026-01-22)


### Features

* add tmux pane management controls (split, close, start-claude) ([d8066d5](https://github.com/whoabuddy/claude-rpg/commit/d8066d5bf071bac18b8d5c5342be47eff64cca97)), closes [#1](https://github.com/whoabuddy/claude-rpg/issues/1)


### Bug Fixes

* make pane management buttons mobile-friendly ([029c885](https://github.com/whoabuddy/claude-rpg/commit/029c88562efc8d9d7898897fb609c2748c52ad31))

## [1.0.2](https://github.com/whoabuddy/claude-rpg/compare/v1.0.1...v1.0.2) (2026-01-22)


### Bug Fixes

* correct session status after /clear and improve mobile GitHub links ([#42](https://github.com/whoabuddy/claude-rpg/issues/42), [#41](https://github.com/whoabuddy/claude-rpg/issues/41)) ([734277b](https://github.com/whoabuddy/claude-rpg/commit/734277b5ec5c9913c9736b0d203d66fad56fd334))

## [1.0.1](https://github.com/whoabuddy/claude-rpg/compare/v1.0.0...v1.0.1) (2026-01-21)


### Bug Fixes

* prevent false notifications and make button widths consistent ([#38](https://github.com/whoabuddy/claude-rpg/issues/38), [#39](https://github.com/whoabuddy/claude-rpg/issues/39)) ([70ef26e](https://github.com/whoabuddy/claude-rpg/commit/70ef26e2aabbf54ac4ce2fcd8d11b00eb915dd75))
* show server connection error instead of misleading tmux message ([86324cf](https://github.com/whoabuddy/claude-rpg/commit/86324cfe20111b31fe5c573ba27693c4f9b82a66))
